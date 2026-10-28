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
import { DocCamera, isDocCameraSupported } from '../services/nativeDocCamera'
import { useTourTarget } from '../context/TourContext'
import { DocumentTracker, detectDocument } from '../utils/documentDetector'

const SEARCHING_MESSAGE = 'សូមតម្រង់កាមេរ៉ាទៅកាន់ឯកសារ...'
const FOUND_MESSAGE = 'ឃើញឯកសារហើយ សូមចុចថត'
const OUTLINE_COLOR = '#EF4444'
// The detected outline is a touch tight; cut slightly outside it so the page's edge text is never clipped
const CROP_MARGIN = 1.03

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
  const { speakAccessibility, triggerHaptic } = useApp()
  const { captureAndScan, isProcessing } = useOcr()
  const isFocused = useIsFocused()
  const [permission, requestPermission] = useCameraPermissions()
  const frameTourRef = useTourTarget('camera-view')
  const shutterTourRef = useTourTarget('shutter')
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
  const steadyRef = useRef(false)
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
    steadyRef.current = false
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
      speakAccessibility(TP.cameraDenied.km)
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
        const { width, height, data } = event.nativeEvent
        const bin = globalThis.atob(data)
        const luma = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) luma[i] = bin.charCodeAt(i)
        const { corners, steady } = trackerRef.current.update(detectDocument(luma, width, height))
        setOutline((prev) => (prev === null && corners === null ? prev : corners))
        if (steady !== steadyRef.current) {
          steadyRef.current = steady
          setGuidanceMessage(steady ? FOUND_MESSAGE : SEARCHING_MESSAGE)
          if (steady) triggerHaptic('light')
        }
      } catch (e) {
        console.warn('Page detection error:', e)
      }
    },
    [isProcessing, triggerHaptic]
  )

  const handleDocCameraError = useCallback((event) => {
    console.warn('Document camera unavailable, using the plain camera:', event?.nativeEvent?.message)
    setDocCameraFailed(true)
  }, [])

  const handleDocCapture = useCallback(async () => {
    if (!docRef.current || isCapturing || isProcessing) return
    setIsCapturing(true)
    try {
      const page = trackerRef.current.corners
      const flat = page ? withMargin(page).flatMap((p) => [p.x, p.y]) : null
      const { uri, fullUri } = await docRef.current.capture(flat)
      const ok = await captureAndScan({ uri, name: `scan_${Date.now()}.jpg`, mimeType: 'image/jpeg' })
      // The cut-out came back unreadable (a wrong outline can crop the text away): read the whole photo instead
      if (ok === false && fullUri) {
        await captureAndScan({ uri: fullUri, name: `scan_${Date.now()}.jpg`, mimeType: 'image/jpeg' })
      }
    } catch (e) {
      console.warn('Capture error:', e)
    } finally {
      setIsCapturing(false)
    }
  }, [captureAndScan, isCapturing, isProcessing])

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
        <View style={[styles.guidanceBanner, isContrast && styles.guidanceBannerContrast]} accessibilityLiveRegion="assertive">
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
