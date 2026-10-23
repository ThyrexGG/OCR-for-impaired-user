import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { AlertCircle, Sparkles } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useOcr } from '../context/OcrContext'

/**
 * Ported from HomeScreen.vue's `.ocr-processing-card` — shown in place of
 * whichever screen (Camera or Upload) triggered OCR, matching the web app
 * where both tabs share one processing/error overlay.
 */
export default function ProcessingCard() {
  const { colors, fonts } = useTheme()
  const { isLongProcessing, ocrProgress } = useOcr()
  const beamX = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(beamX, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [beamX])

  const styles = createStyles(colors)
  const translateX = beamX.interpolate({ inputRange: [0, 1], outputRange: [-160, 260] })

  return (
    <View style={styles.card} accessibilityLiveRegion="assertive">
      <View style={styles.glowIcon}>
        <Sparkles size={36} color={colors.accentText} />
      </View>
      <Text style={[styles.title, { fontFamily: fonts.khmer }]}>កំពុងស្កេនឯកសារ</Text>
      <Text style={[styles.desc, { fontFamily: fonts.khmer }]}>កំពុងស្រង់អត្ថបទខ្មែរ... សូមរង់ចាំបន្តិច។</Text>

      {/* Real % once the engine reports it; indeterminate shimmer before that */}
      <View style={styles.beamTrack}>
        {ocrProgress > 0 ? (
          <View style={[styles.beamFillStatic, { width: `${ocrProgress}%` }]} />
        ) : (
          <Animated.View style={[styles.beamFill, { transform: [{ translateX }] }]} />
        )}
      </View>
      {ocrProgress > 0 && (
        <Text style={[styles.progressText, { fontFamily: fonts.khmer }]}>ដំណើរការ៖ {ocrProgress}%</Text>
      )}

      {isLongProcessing && (
        <View style={styles.timeoutNotice}>
          <AlertCircle size={18} color={colors.accent} />
          <Text style={[styles.timeoutText, { fontFamily: fonts.khmer }]}>ដំណើរការនេះអាចចំណាយពេលបន្តិច សូមកុំបិទទំព័រ។</Text>
        </View>
      )}
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    // HomeScreen.css `.ocr-processing-card` at ≤640px (glass-card on --surface-1).
    card: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: 20,
      gap: 18,
      marginVertical: 10,
      borderWidth: 2,
      borderColor: colors.borderMedium,
      borderRadius: 16,
      backgroundColor: colors.surfaces.surface1,
    },
    glowIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      ...colors.shadows.glow,
    },
    title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
    desc: { fontSize: 18.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 30 },
    beamTrack: {
      width: '100%',
      maxWidth: 320,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.bgSurfaceElevated,
      overflow: 'hidden',
      marginTop: 4,
    },
    beamFill: {
      width: '50%',
      height: '100%',
      borderRadius: 3,
      backgroundColor: colors.accent,
    },
    beamFillStatic: { height: '100%', borderRadius: 3, backgroundColor: colors.accent },
    progressText: { fontSize: 16, fontWeight: '600', color: colors.brand, textAlign: 'center' },
    timeoutNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: colors.accentSubtle,
      borderWidth: 1.5,
      borderColor: colors.borderMedium,
      borderRadius: colors.radii.md,
      marginTop: 6,
    },
    timeoutText: { flex: 1, color: colors.brandLight, fontWeight: '600', fontSize: 16.5, lineHeight: 24 },
  })
