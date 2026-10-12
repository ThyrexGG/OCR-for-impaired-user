import { Image, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowRight, Sparkles, ShieldCheck, Zap } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import AccessiblePressable from '../components/AccessiblePressable'

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

  return (
    <SafeAreaView style={[styles.wrapper, { backgroundColor: colors.bgPage }]}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.logoGem}>
            <Image source={require('../assets/logo.png')} style={styles.logoImg} resizeMode="contain" accessibilityLabel="songKHEM Logo" />
          </View>
          <Text style={[styles.title, { fontFamily: fonts.title }]}>songKHEM</Text>
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
          accessibilityLabel="ចាប់ផ្តើមប្រើភ្លាមៗ"
          onPress={() => navigation.replace('Main')}
        >
          <Text style={[styles.ctaLabel, { fontFamily: fonts.khmer }]}>ចាប់ផ្តើមប្រើភ្លាមៗ</Text>
          <ArrowRight size={24} color={colors.accentText} />
        </AccessiblePressable>

        <Text style={[styles.footerNote, { fontFamily: fonts.khmer }]}>រចនាឡើងសម្រាប់អ្នកមានពិការភាពគំហើញ</Text>
      </View>
    </SafeAreaView>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
    card: {
      width: '100%',
      maxWidth: 500,
      paddingVertical: 28,
      paddingHorizontal: 20,
      borderWidth: 2,
      borderColor: colors.borderMedium,
      borderRadius: 4,
      backgroundColor: colors.bgSurface,
      gap: 16,
      ...colors.shadows.lg,
    },
    header: { alignItems: 'center', gap: 12 },
    logoGem: {
      width: 80,
      height: 80,
      borderRadius: 4,
      backgroundColor: colors.bgSurfaceElevated,
      borderWidth: 2,
      borderColor: colors.borderMedium,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginBottom: 4,
      ...colors.shadows.glow,
    },
    logoImg: { width: 60, height: 60 },
    title: { fontSize: 33, fontWeight: '800', color: colors.accent, lineHeight: 40, letterSpacing: -0.3 },
    subtitle: { fontSize: 17.5, color: colors.textSecondary, lineHeight: 31, textAlign: 'center' },
    featuresList: {
      gap: 12,
      paddingVertical: 18,
      paddingHorizontal: 20,
      backgroundColor: colors.bgSurfaceElevated,
      borderWidth: 1.5,
      borderColor: colors.borderSubtle,
      borderRadius: 4,
    },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    featureIcon: { flexShrink: 0 },
    featureText: { flex: 1, fontSize: 18, fontWeight: '600', color: colors.textPrimary, lineHeight: 30 },
    ctaButton: {
      width: '100%',
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: colors.accent,
      borderWidth: 2,
      borderColor: colors.accentHover,
      borderRadius: 4,
      ...colors.shadows.glow,
    },
    ctaLabel: { fontSize: 20.5, fontWeight: '700', color: colors.accentText },
    footerNote: { textAlign: 'center', fontSize: 16, color: colors.textMuted, lineHeight: 26 },
  })
