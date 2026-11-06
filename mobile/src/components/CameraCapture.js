import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
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

/**
 * Ports DocumentUploader.vue's "camera-assistant-view" (View A): permission
 * recovery box, live viewfinder with HUD corner brackets + guidance banner,
 * and the circular iPhone-style shutter button. getUserMedia + <video> +
 * <canvas>.toBlob become expo-camera's CameraView + takePictureAsync.
 */
export default function CameraCapture() {
  const { colors, fonts } = useTheme()
  const { speakAccessibility, triggerHaptic } = useApp()
  const { captureAndScan, isProcessing } = useOcr()
  const isFocused = useIsFocused()
  const [permission, requestPermission] = useCameraPermissions()
  const [guidanceMessage, setGuidanceMessage] = useState(
    'កាមេរ៉ាត្រៀមរួចជាស្រេច។ សូមតម្រង់ទៅកាន់ឯកសារ។'
  )
  const [isCornerLocked, setIsCornerLocked] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const cameraRef = useRef(null)
  const guidanceTimerRef = useRef(null)

  const styles = createStyles(colors)
  const isGranted = permission?.granted

  // Simple camera framing & readiness cue (honest framing guidance, not
  // simulated AI detection) — ported from startGuidanceSimulation().
  useEffect(() => {
    if (!isGranted || !isFocused) return

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
  }, [isGranted, isFocused])

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
    <View style={styles.frame}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* Guidance banner (no scan border: the whole viewfinder is captured) */}
      <View style={styles.guidanceBanner} accessibilityLiveRegion="assertive">
        <View style={[styles.guidancePulseIcon, { backgroundColor: colors.accentSubtle }]}>
          <Scan size={20} color={colors.accent} />
        </View>
        <Text style={[styles.guidanceText, { fontFamily: fonts.khmer }]}>{guidanceMessage}</Text>
      </View>

      {/* Circular iPhone-style shutter button */}
      <View style={styles.actionsDeck}>
        <AccessiblePressable
          style={styles.shutterButton}
          accessibilityLabel="ថតរូបភាពឯកសារ (Capture document)"
          disabled={isProcessing || isCapturing}
          speakOnPress={false}
          hapticIntensity="medium"
          onPress={handleCapture}
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
      borderRadius: colors.radii.xl,
      overflow: 'hidden',
      backgroundColor: '#000000',
    },
    centered: { alignItems: 'center', justifyContent: 'center' },
    guidanceBanner: {
      position: 'absolute',
      top: 14,
      left: 14,
      right: 14,
      backgroundColor: '#0B111E',
      borderWidth: 1.5,
      borderColor: '#4466F6',
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    guidancePulseIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    guidanceText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      lineHeight: 23,
    },
    actionsDeck: {
      position: 'absolute',
      bottom: 20,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    shutterButton: {
      width: 76,
      height: 76,
      padding: 5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderWidth: 4,
      borderColor: '#FFFFFF',
      borderRadius: 38,
    },
    shutterRing: {
      width: '100%',
      height: '100%',
      borderRadius: 34,
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
