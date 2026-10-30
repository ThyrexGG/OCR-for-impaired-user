import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import Svg, { Polygon } from 'react-native-svg'
import { useIsFocused } from '@react-navigation/native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { RefreshCw, Scan, ShieldAlert, Upload } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import { useOcr } from '../context/OcrContext'
import { navigateToUpload } from '../navigation/navigationRef'
import AccessiblePressable from './AccessiblePressable'
import NeoButton from './NeoButton'
import { TP } from '../services/talkPhrases'
import { DocCamera, isDocCameraSupported, listenVolumeShutter } from '../services/nativeDocCamera'
import { useTour, useTourTarget } from '../context/TourContext'
import { DocumentTracker, assessFraming, detectDocument } from '../utils/documentDetector'

const SEARCHING_MESSAGE = 'សូមតម្រង់កាមេរ៉ាទៅកាន់ឯកសារ'
// What the camera tells the user, one short sentence each. Directions are relative to the page, so they make
// sense with the phone held flat over it. All are short enough to be recorded into the voice pack, so they
// play even without internet.
const GUIDE = {
  search: SEARCHING_MESSAGE,
  left: 'រំកិលទូរស័ព្ទទៅឆ្វេងបន្តិច',
  right: 'រំកិលទូរស័ព្ទទៅស្តាំបន្តិច',
  up: 'រំកិលទូរស័ព្ទទៅខាងលើឯកសារបន្តិច',
  down: 'រំកិលទូរស័ព្ទទៅខាងក្រោមឯកសារបន្តិច',
  further: 'លើកទូរស័ព្ទឱ្យខ្ពស់បន្តិច',
  closer: 'ដាក់ទូរស័ព្ទឱ្យជិតឯកសារបន្តិច',
  blur: 'កាន់ទូរស័ព្ទឱ្យនឹង',
  found: 'ល្អ កាន់ឱ្យនឹង កំពុងថត',
}
const DARK_MESSAGE = 'ងងឹតពេក កំពុងបើកពន្លឺ'
// Pacing, so the voice guides calmly instead of chattering:
const FRAMES_TO_CHANGE = 2 // the on-screen banner follows a new state after ~0.2s
const SPEAK_HOLD_MS = 1500 // a direction is only spoken once it has held this long (not for a passing wobble)
const SPEAK_GAP_MS = 5000 // at least this long between two spoken directions
const SAY_AGAIN_MS = 10000 // a direction that still applies is repeated no sooner than this
const FOUND_SAY_MS = 600 // "good, hold still" comes quicker: the photo follows
// Taking the photo by itself: page fully in view, outline steady and the picture sharp for this long (time to
// hear "good, hold still, taking the photo" first)
const AUTO_SHOT_MS = 2800
const REARM_MS = 1000 // after an automatic photo, the page must be gone this long before the next one
// Sharpness: a frame is crisp when it scores near the best seen lately (the scale differs between phones)
const SHARP_RATIO = 0.6
const SHARP_MIN = 2.5
const SHARP_PEAK_DECAY = 0.985
// Brightness (0-255 average of the picture) below this for DARK_FRAMES frames turns the torch on
const DARK_LUMA = 55
const DARK_FRAMES = 8
const OUTLINE_COLOR = '#EF4444'
// The detected outline can sit a little inside the paper; cut well outside it so edge text is never clipped
const CROP_MARGIN = 1.06

const withMargin = (corners) => {
  const cx = corners.reduce((sum, p) => sum + p.x, 0) / 4
  const cy = corners.reduce((sum, p) => sum + p.y, 0) / 4
  const clamp = (v) => Math.min(1, Math.max(0, v))
  return corners.map((p) => ({ x: clamp(cx + (p.x - cx) * CROP_MARGIN), y: clamp(cy + (p.y - cy) * CROP_MARGIN) }))
}

/**
 * Ports DocumentUploader.vue's "camera-assistant-view" (View A): permission
 * recovery box, live viewfinder with HUD corner brackets + guidance banner,
 * and the circular iPhone-style shutter button. getUserMedia + <video> +
 * <canvas>.toBlob become expo-camera's CameraView + takePictureAsync.
 *
 * On Android the viewfinder is our own camera view (modules/songkhem-docscan): it finds the page in the live
 * picture, draws a red outline that follows it, and the photo is cut down to just that page, straightened.
 * expo-camera's plain viewfinder stays as the fallback everywhere else.
 */
export default function CameraCapture() {
  const { colors, fonts, currentTheme } = useTheme()
  const { speakGuidance, triggerHaptic } = useApp()
  const { captureAndScan, isProcessing } = useOcr()
  const isFocused = useIsFocused()
  const [permission, requestPermission] = useCameraPermissions()
  const frameTourRef = useTourTarget('camera-view')
  const shutterTourRef = useTourTarget('shutter')
  const { phase: tourPhase } = useTour()
  const [guidanceMessage, setGuidanceMessage] = useState(
    isDocCameraSupported ? SEARCHING_MESSAGE : 'កាមេរ៉ាត្រៀមរួចជាស្រេច។ សូមតម្រង់ទៅកាន់ឯកសារ។'
  )
  const [isCornerLocked, setIsCornerLocked] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  // Set when our camera view can't start on this phone, which drops back to the plain camera
  const [docCameraFailed, setDocCameraFailed] = useState(false)
  const [outline, setOutline] = useState(null)
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 })
  const cameraRef = useRef(null)
  const docRef = useRef(null)
  const trackerRef = useRef(new DocumentTracker())
  // What the banner shows now: 'search' | 'found' | 'blur' | a direction key in GUIDE
  const framingRef = useRef({ key: 'search', candidate: null, count: 0, spokenAt: {} })
  // Speech pacing and the automatic photo: when the current state began, when anything was last said, the
  // sharpness peak, dark-frame count, whether the torch is on and whether an automatic photo may be taken
  const paceRef = useRef(null)
  const resetPace = () => {
    paceRef.current = { key: 'search', since: Date.now(), lastSpokeAt: 0, spokenAt: {}, peak: 0, darkFrames: 0, torch: false, armed: true, goneSince: 0 }
  }
  if (!paceRef.current) resetPace()
  const autoShootRef = useRef(null)
  const guidanceTimerRef = useRef(null)

  const styles = createStyles(colors)
  const isContrast = currentTheme === 'contrast'
  const isGranted = permission?.granted
  const useDocCamera = isDocCameraSupported && !docCameraFailed

  // Simple camera framing & readiness cue (honest framing guidance, not
  // simulated AI detection) — ported from startGuidanceSimulation().
  useEffect(() => {
    if (useDocCamera || !isGranted || !isFocused) return

    setGuidanceMessage('សូមតម្រង់កាមេរ៉ាទៅកាន់ឯកសារ...')
    setIsCornerLocked(false)

    let ticks = 0
    guidanceTimerRef.current = setInterval(() => {
      ticks += 1
      if (isProcessing) return
      if (ticks === 2) {
        setIsCornerLocked(true)
        setGuidanceMessage('កាមេរ៉ាត្រៀមរួចរាល់ សូមចុចថត')
        triggerHaptic('light')
      }
    }, 1200)

    return () => {
      if (guidanceTimerRef.current) clearInterval(guidanceTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDocCamera, isGranted, isFocused])

  // Start every visit to the tab with no outline and nothing remembered about the last page
  useEffect(() => {
    trackerRef.current.reset()
    framingRef.current = { key: 'search', candidate: null, count: 0, spokenAt: {} }
    resetPace()
    setOutline(null)
    setGuidanceMessage(SEARCHING_MESSAGE)
  }, [isFocused])

  // The web app's startCamera() calls getUserMedia on mount, which is what
  // triggers the browser's permission prompt; do the same here so a fresh
  // install asks for the camera instead of opening straight onto the
  // "permission denied" recovery box.
  useEffect(() => {
    if (isFocused && permission && permission.status === 'undetermined') {
      requestPermission()
    }
  }, [isFocused, permission, requestPermission])

  // Without the camera there is nothing to see: say so, and say what to do
  useEffect(() => {
    if (isFocused && permission && !permission.granted && permission.status !== 'undetermined') {
      speakGuidance(TP.cameraDenied.km)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, permission?.granted, permission?.status])

  // Once Android stops showing the prompt ("Don't allow" twice), the only
  // way back is the app's system settings page.
  const handleRetryPermission = useCallback(() => {
    if (permission?.canAskAgain) requestPermission()
    else Linking.openSettings()
  }, [permission, requestPermission])

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing || isProcessing) return
    setIsCapturing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92 })
      await captureAndScan({ uri: photo.uri, name: `scan_${Date.now()}.jpg`, mimeType: 'image/jpeg' })
    } catch (e) {
      console.warn('Capture error:', e)
    } finally {
      setIsCapturing(false)
    }
  }, [captureAndScan, isCapturing, isProcessing])

  // A new brightness picture from the camera view: look for the page, steady the outline, and cue the user
  // (haptic + the live-region banner a screen reader announces) when a page is lined up
  const handleFrame = useCallback(
    (event) => {
      if (isProcessing) return
      try {
        const { width, height, data, sharpness = 0 } = event.nativeEvent
        const bin = globalThis.atob(data)
        const luma = new Uint8Array(bin.length)
        let lumaSum = 0
        for (let i = 0; i < bin.length; i++) {
          luma[i] = bin.charCodeAt(i)
          lumaSum += luma[i]
        }
        const { corners, steady } = trackerRef.current.update(detectDocument(luma, width, height))
        setOutline((prev) => (prev === null && corners === null ? prev : corners))
        const now = Date.now()
        const p = paceRef.current

        // A dark room: turn the torch on once, and say so
        p.darkFrames = lumaSum / luma.length < DARK_LUMA ? p.darkFrames + 1 : 0
        if (!p.torch && p.darkFrames >= DARK_FRAMES) {
          p.torch = true
          docRef.current?.setTorch?.(true)
          p.lastSpokeAt = now
          speakGuidance(DARK_MESSAGE)
        }

        // Crisp or shaky: compared with the best this camera has managed lately
        p.peak = Math.max(sharpness, p.peak * SHARP_PEAK_DECAY)
        const sharp = sharpness >= SHARP_MIN && sharpness >= p.peak * SHARP_RATIO

        // Tell the user how to move until the whole page is in view, then to hold still until the picture is sharp
        const { hint } = assessFraming(corners)
        const f = framingRef.current
        const key = !corners ? 'search' : hint || (steady ? (sharp ? 'found' : 'blur') : f.key)

        // The banner (and a light buzz) follows quickly
        if (key === f.key) {
          f.candidate = null
        } else if (key === f.candidate && ++f.count >= FRAMES_TO_CHANGE) {
          f.key = key
          f.candidate = null
          setGuidanceMessage(GUIDE[key])
          triggerHaptic(key === 'found' ? 'success' : key === 'search' ? 'selection' : 'light')
        } else if (key !== f.candidate) {
          f.candidate = key
          f.count = 1
        }

        // The voice is slower: a state must have held a moment, never right after something else was said, and
        // the same direction is only repeated while it still applies, every few seconds
        if (f.key !== p.key) {
          p.key = f.key
          p.since = now
        }
        const held = now - p.since
        const isNew = p.lastKey !== p.key
        const due = isNew ? held >= (p.key === 'found' ? FOUND_SAY_MS : SPEAK_HOLD_MS) : p.key !== 'found' && now - (p.spokenAt[p.key] || 0) >= SAY_AGAIN_MS
        if (due && (p.key === 'found' || now - p.lastSpokeAt >= SPEAK_GAP_MS)) {
          p.lastKey = p.key
          p.lastSpokeAt = now
          p.spokenAt[p.key] = now
          speakGuidance(GUIDE[p.key])
        }

        // Take the photo by itself once the page has been lined up, steady and sharp for a moment. After that,
        // the next automatic photo waits until the page has been taken away, so it is not scanned twice.
        if (p.key === 'search') {
          if (!p.goneSince) p.goneSince = now
          if (!p.armed && now - p.goneSince >= REARM_MS) p.armed = true
        } else {
          p.goneSince = 0
        }
        if (p.key === 'found' && p.armed && held >= AUTO_SHOT_MS && autoShootRef.current) {
          p.armed = false
          autoShootRef.current()
        }
      } catch (e) {
        console.warn('Page detection error:', e)
      }
    },
    [isProcessing, triggerHaptic, speakGuidance]
  )

  const handleDocCameraError = useCallback((event) => {
    console.warn('Document camera unavailable, using the plain camera:', event?.nativeEvent?.message)
    setDocCameraFailed(true)
  }, [])

  const handleDocCapture = useCallback(async () => {
    if (!docRef.current || isCapturing || isProcessing) return
    setIsCapturing(true)
    try {
      // Cut down to the page only when the whole page is steady and clearly inside the picture; otherwise keep the
      // whole photo, so no text can be cut away
      const page = trackerRef.current.corners
      // 'blur' also has the whole page lined up (it only waits for a sharper picture)
      const safe = page && ['found', 'blur'].includes(framingRef.current.key) && assessFraming(page).cropSafe
      const flat = safe ? withMargin(page).flatMap((p) => [p.x, p.y]) : null
      const { uri, fullUri } = await docRef.current.capture(flat)
      const result = await captureAndScan({ uri, name: `scan_${Date.now()}.jpg`, mimeType: 'image/jpeg' }, { quietNoText: !!fullUri })
      // No text in the cut-out (a wrong outline can crop the text away): read the whole photo instead. Other
      // failures (no internet, limits) would fail the same way again, and have already been announced.
      if (result === 'no_text' && fullUri) {
        await captureAndScan({ uri: fullUri, name: `scan_${Date.now()}.jpg`, mimeType: 'image/jpeg' })
      }
    } catch (e) {
      console.warn('Capture error:', e)
    } finally {
      setIsCapturing(false)
    }
  }, [captureAndScan, isCapturing, isProcessing])

  // Either volume button is a shutter while this tab is showing, the way the phone's own camera app works;
  // easier to find by feel than the button on screen. Not during the guided tour, which is spoken.
  const shutterRef = useRef(null)
  shutterRef.current = isCapturing || isProcessing ? null : useDocCamera ? handleDocCapture : handleCapture
  autoShootRef.current = useDocCamera && isFocused && tourPhase === 'closed' && !isCapturing && !isProcessing ? handleDocCapture : null
  useEffect(() => {
    if (!isFocused || !isGranted || tourPhase !== 'closed') return
    return listenVolumeShutter(() => {
      const shoot = shutterRef.current
      if (!shoot) return
      triggerHaptic('medium')
      shoot()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, isGranted, tourPhase])

  if (!permission || (!isGranted && permission.status === 'undetermined')) {
    return <View style={[styles.frame, styles.centered]} />
  }

  // Bottom-tab screens stay mounted when you switch away (React Navigation
  // doesn't unmount them), but CameraView's native SurfaceView/TextureView
  // layer composites outside React's normal z-order — left mounted, it can
  // visually and touch-wise interfere with whatever tab is actually showing.
  // Tearing it down (not just hiding it) when this tab loses focus avoids
  // that entirely.
  if (!isFocused) {
    return <View style={styles.frame} />
  }

  if (!isGranted) {
    return (
      <View style={styles.errorBox}>
        <ShieldAlert size={36} color={colors.danger} style={styles.errorIcon} />
        <Text style={[styles.errorHeading, { fontFamily: fonts.khmer }]}>
          មិនអាចបើកកាមេរ៉ាបានទេ
        </Text>
        <Text style={[styles.errorExplanation, { fontFamily: fonts.khmer }]}>
          កម្មវិធីត្រូវការសិទ្ធិប្រើប្រាស់កាមេរ៉ាដើម្បីស្កេនឯកសារ។ ប្រសិនបើអ្នកបានបដិសេធ សូមអនុញ្ញាតតាមវិធីខាងក្រោម៖
        </Text>
        <View style={styles.instructionsList}>
          <Text style={[styles.instructionItem, { fontFamily: fonts.khmer }]}>1. បើកកម្មវិធីកំណត់ (Settings) ក្នុងទូរស័ព្ទរបស់អ្នក។</Text>
          <Text style={[styles.instructionItem, { fontFamily: fonts.khmer }]}>2. ចូល កម្មវិធី (Apps) → songKHEM → សិទ្ធិ (Permissions) → កាមេរ៉ា → Allow។</Text>
          <Text style={[styles.instructionItem, { fontFamily: fonts.khmer }]}>3. ត្រឡប់មកទីនេះវិញ ហើយចុច "ព្យាយាមម្តងទៀត" ខាងក្រោម។</Text>
        </View>
        <View style={styles.errorActions}>
          <NeoButton
            bg="#4466F6"
            borderColor="#0F172A"
            shadowColor="#0F172A"
            contentStyle={styles.errorBtn}
            accessibilityLabel="ព្យាយាមបើកកាមេរ៉ាម្តងទៀត (Try Camera Again)"
            onPress={handleRetryPermission}
          >
            <RefreshCw size={18} color="#FFFFFF" />
            <Text style={[styles.errorBtnText, { color: '#FFFFFF', fontFamily: fonts.khmer }]}>ព្យាយាមបើកកាមេរ៉ាម្តងទៀត</Text>
          </NeoButton>
          <NeoButton
            offsetX={-3}
            offsetY={3}
            bg="#FFFFFF"
            borderColor="#0F172A"
            shadowColor="#4466F6"
            contentStyle={styles.errorBtn}
            accessibilityLabel="ផ្ទុករូបភាព ឬ PDF ជំនួសវិញ (Upload File Instead)"
            onPress={navigateToUpload}
          >
            <Upload size={18} color="#0F172A" />
            <Text style={[styles.errorBtnText, { color: '#0F172A', fontFamily: fonts.khmer }]}>ផ្ទុករូបភាព ឬ PDF ជំនួសវិញ</Text>
          </NeoButton>
        </View>
      </View>
    )
  }

  return (
    <View ref={frameTourRef} collapsable={false} style={styles.frame} onLayout={(e) => setViewSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {useDocCamera ? (
        <DocCamera ref={docRef} style={StyleSheet.absoluteFill} onFrame={handleFrame} onError={handleDocCameraError} />
      ) : (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      )}

      {/* Red outline that follows the page found in the camera view */}
      {useDocCamera && outline && viewSize.w > 0 && (
        <Svg style={StyleSheet.absoluteFill} width={viewSize.w} height={viewSize.h} pointerEvents="none">
          <Polygon
            points={outline.map((p) => `${p.x * viewSize.w},${p.y * viewSize.h}`).join(' ')}
            fill="none"
            stroke={OUTLINE_COLOR}
            strokeWidth={4}
            strokeLinejoin="round"
          />
        </Svg>
      )}

      {/* Guidance chip (DocumentUploader.css .guidance-banner): a centred pill, one line */}
      <View style={styles.guidanceWrap} pointerEvents="none">
        <View
          style={[styles.guidanceBanner, isContrast && styles.guidanceBannerContrast]}
          accessibilityLiveRegion={useDocCamera ? 'none' : 'assertive'}
        >
          <View style={styles.guidancePulseIcon}>
            <Scan size={18} color={isContrast ? '#FFFF00' : '#A8C7FA'} />
          </View>
          <Text style={[styles.guidanceText, isContrast && { color: '#FFFF00' }]} numberOfLines={1}>
            {guidanceMessage}
          </Text>
        </View>
      </View>

      {/* Circular iPhone-style shutter button */}
      <View style={styles.actionsDeck}>
        <AccessiblePressable
          ref={shutterTourRef}
          style={styles.shutterButton}
          accessibilityLabel="ថតរូបភាពឯកសារ (Capture document)"
          disabled={isProcessing || isCapturing}
          speakOnPress={false}
          hapticIntensity="medium"
          onPress={useDocCamera ? handleDocCapture : handleCapture}
        >
          <View style={styles.shutterRing} />
        </AccessiblePressable>
      </View>
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    frame: {
      flex: 1,
      borderRadius: colors.radii.md,
      overflow: 'hidden',
      backgroundColor: '#000000',
      borderWidth: 2,
      borderColor: colors.borderSubtle,
    },
    centered: { alignItems: 'center', justifyContent: 'center' },
    guidanceWrap: { position: 'absolute', top: 14, left: 12, right: 12, alignItems: 'center' },
    guidanceBanner: {
      maxWidth: '100%',
      backgroundColor: 'rgba(23,27,34,0.85)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
      borderRadius: 9999,
      paddingVertical: 8,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      elevation: 6,
    },
    guidanceBannerContrast: { backgroundColor: '#000000', borderWidth: 2, borderColor: '#FFFF00', elevation: 0 },
    guidancePulseIcon: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(168,199,250,0.16)',
    },
    guidanceText: {
      flexShrink: 1,
      fontSize: 13.6,
      fontWeight: '500',
      color: '#FFFFFF',
      lineHeight: 18,
      letterSpacing: 0.1,
    },
    actionsDeck: {
      position: 'absolute',
      bottom: 14,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    shutterButton: {
      width: 64,
      height: 64,
      padding: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 4,
      borderColor: '#FFFFFF',
      borderRadius: 32,
      elevation: 6,
    },
    shutterRing: {
      width: '100%',
      height: '100%',
      borderRadius: 28,
      backgroundColor: '#FFFFFF',
    },
    // DocumentUploader.css `.camera-error-box` at ≤640px (column, 20/16 pad).
    errorBox: {
      padding: 20,
      paddingHorizontal: 16,
      gap: 14,
      backgroundColor: colors.bgSurfaceElevated,
      borderWidth: 2,
      borderColor: colors.danger,
      borderRadius: 16,
    },
    errorIcon: { alignSelf: 'flex-start' },
    errorHeading: {
      fontSize: 21,
      fontWeight: '800',
      color: colors.danger,
    },
    errorExplanation: {
      fontSize: 17,
      color: colors.textPrimary,
      lineHeight: 27,
    },
    instructionsList: { gap: 6, paddingLeft: 8 },
    instructionItem: { fontSize: 16, color: colors.textSecondary, lineHeight: 25 },
    errorActions: {
      gap: 14,
      marginTop: 8,
      alignItems: 'center',
      paddingLeft: 4,
    },
    errorBtn: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 20,
    },
    errorBtnText: { fontWeight: '700', fontSize: 18 },
  })
