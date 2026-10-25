import { useEffect } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowRight, Sparkles, ShieldCheck, Zap } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import AccessiblePressable from '../components/AccessiblePressable'
import { useApp } from '../context/AppContext'

// LoginScreen.vue's Khmer copy (t('featureInstant') etc.).
const FEATURES = [
  { Icon: Zap, text: 'ស្កេន និងអានជាសំឡេងភ្លាមៗ' },
  { Icon: Sparkles, text: 'រំលេចពាក្យពេលកំពុងអាន' },
  { Icon: ShieldCheck, text: 'ឥតគិតថ្លៃ និងមិនបាច់ចុះឈ្មោះ' },
]

// Ports LoginScreen.vue + LoginScreen.css at its ≤640px breakpoint.
export default function WelcomeScreen({ navigation }) {
  const { colors, fonts } = useTheme()
  const styles = createStyles(colors)
  const { prefsLoaded, speakWelcome } = useApp()

  useEffect(() => {
    if (prefsLoaded) speakWelcome()
  }, [prefsLoaded, speakWelcome])

  return (
    <SafeAreaView style={[styles.wrapper, { backgroundColor: colors.bgPage }]}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.logoGem}>
            <Image source={require('../assets/logo.png')} style={styles.logoImg} resizeMode="contain" accessibilityLabel="songKHEM Logo" />
          </View>
          <Text style={[styles.title, { fontFamily: fonts.title }]}>SongKhem</Text>
          <Text style={[styles.subtitle, { fontFamily: fonts.khmer }]}>ជំនួយការមើលឃើញ និងអានឯកសារជាសំឡេង</Text>
        </View>

        <View style={styles.featuresList} accessibilityRole="list" accessibilityLabel="Key Features">
          {FEATURES.map(({ Icon, text }) => (
            <View key={text} style={styles.featureItem} accessibilityRole="text">
              <Icon size={20} color={colors.accent} style={styles.featureIcon} />
              <Text style={[styles.featureText, { fontFamily: fonts.khmer }]}>{text}</Text>
            </View>
          ))}
        </View>

        <AccessiblePressable
          style={styles.ctaButton}
          hapticIntensity="medium"
          accessibilityLabel="ចាប់ផ្តើមប្រើភ្លាម"
          onPress={() => navigation.replace('Main')}
        >
          <Text style={[styles.ctaLabel, { fontFamily: fonts.khmer }]}>ចាប់ផ្តើមប្រើភ្លាម</Text>
          <ArrowRight size={24} color={colors.accentText} />
        </AccessiblePressable>

        <Text style={[styles.footerNote, { fontFamily: fonts.khmer }]}>រចនាឡើងសម្រាប់អ្នកមានពិការភាពគំហើញ</Text>
      </View>
    </SafeAreaView>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    card: {
      width: '100%',
      maxWidth: 500,
      paddingVertical: 28,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: colors.surfaces.divider,
      borderRadius: 24,
      backgroundColor: colors.bgSurface,
      gap: 18,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 4,
    },
    header: { alignItems: 'center', gap: 12 },
    logoGem: {
      width: 76,
      height: 76,
      borderRadius: 20,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.surfaces.divider,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginBottom: 2,
      shadowColor: '#4466F6',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 5,
    },
    logoImg: { width: 56, height: 56 },
    title: { fontSize: 30, fontWeight: '700', color: colors.accent, lineHeight: 38, letterSpacing: -0.2 },
    subtitle: { fontSize: 17, color: colors.textPrimary, lineHeight: 30, textAlign: 'center' },
    featuresList: {
      gap: 12,
      paddingVertical: 16,
      paddingHorizontal: 18,
      backgroundColor: colors.bgPage,
      borderWidth: 1,
      borderColor: colors.surfaces.divider,
      borderRadius: 16,
    },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    featureIcon: { flexShrink: 0 },
    featureText: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.textPrimary, lineHeight: 28 },
    ctaButton: {
      width: '100%',
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 22,
      paddingVertical: 14,
      backgroundColor: colors.accent,
      borderRadius: 29,
      shadowColor: '#4466F6',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 6,
    },
    ctaLabel: { fontSize: 19, fontWeight: '700', color: colors.accentText },
    footerNote: { textAlign: 'center', fontSize: 15, color: colors.textMuted, lineHeight: 24 },
  })
