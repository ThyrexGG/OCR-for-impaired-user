import { Image, StyleSheet, Text, View } from 'react-native'
import { HelpCircle, Languages, Settings } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import NeoButton from './NeoButton'

// Web equivalent's hardcoded (non-token) header button colors — App.css's
// `.header-btn` / `.lang-toggle-btn` and their `[data-theme="dark"]` overrides.
const HEADER_PALETTE = {
  light: { border: '#0F172A', shadow: '#1D4ED8', bg: '#FFFFFF', text: '#0F172A', langBg: '#E0F2FE', langText: '#0369A1' },
  dark: { border: '#E2E8F0', shadow: '#3B82F6', bg: '#111B2E', text: '#FFFFFF', langBg: '#0C4A6E', langText: '#BAE6FD' },
}

/**
 * Ports App.vue's `.assistive-header` at its ≤480px breakpoint — the only
 * one relevant here, since this app IS that mobile viewport: brand caption
 * hidden, and only the Language-toggle + Settings buttons show (the web app
 * marks its Voice/Help header buttons `desktop-only` at this width; Voice
 * lives in Settings > Audio here too, but Help stays reachable from the
 * header since hiding it would strand this app's actual assistive purpose).
 */
export default function AppHeader() {
  const { colors, fonts, currentTheme } = useTheme()
  const { openHelp, openSettings, addToast, triggerHaptic } = useApp()
  const palette = HEADER_PALETTE[currentTheme === 'dark' ? 'dark' : 'light']
  const styles = createStyles(colors)

  const handleToggleLang = () => {
    triggerHaptic('light')
    addToast('ភាសាអង់គ្លេសកំពុងអភិវឌ្ឍ សូមរង់ចាំបន្តិច (English translation coming soon)', 'info')
  }

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.logoGem}>
          <Image source={require('../assets/logo.png')} style={styles.logoImg} resizeMode="contain" />
          <View style={styles.pulseDot} />
        </View>
        <Text style={[styles.brandName, { fontFamily: fonts.sansBold }]}>songKHEM</Text>
      </View>

      <View style={styles.actions}>
        <NeoButton
          offsetX={0}
          offsetY={3}
          bg={palette.langBg}
          borderColor={palette.border}
          shadowColor={palette.shadow}
          contentStyle={styles.headerBtn}
          accessibilityLabel="ភាសាបច្ចុប្បន្ន៖ ខ្មែរ (ចុចដើម្បីប្តូរទៅ English)"
          onPress={handleToggleLang}
          speakOnPress={false}
        >
          <Languages size={18} color={palette.langText} />
          <Text style={[styles.headerBtnText, { color: palette.langText, fontFamily: fonts.sansBold }]}>ខ្មែរ</Text>
        </NeoButton>

        <NeoButton
          offsetX={0}
          offsetY={3}
          bg={palette.bg}
          borderColor={palette.border}
          shadowColor={palette.shadow}
          contentStyle={styles.headerBtn}
          accessibilityLabel="របៀបប្រើប្រាស់ (Help / How to Use)"
          onPress={openHelp}
          speakOnPress={false}
        >
          <HelpCircle size={20} color={palette.text} />
        </NeoButton>

        <NeoButton
          offsetX={0}
          offsetY={3}
          bg={palette.bg}
          borderColor={palette.border}
          shadowColor={palette.shadow}
          contentStyle={styles.headerBtn}
          accessibilityLabel="បើកការកំណត់លទ្ធភាពប្រើប្រាស់ (Settings)"
          onPress={openSettings}
          speakOnPress={false}
        >
          <Settings size={20} color={palette.text} />
          <Text style={[styles.headerBtnText, { color: palette.text, fontFamily: fonts.sansBold }]}>កំណត់</Text>
        </NeoButton>
      </View>
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: colors.bgSurface,
      borderBottomWidth: 2,
      borderBottomColor: colors.borderSubtle,
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logoGem: {
      width: 36,
      height: 36,
      borderRadius: colors.radii.md,
      backgroundColor: colors.bgSurfaceElevated,
      borderWidth: 1.5,
      borderColor: colors.borderMedium,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    logoImg: { width: 26, height: 26 },
    pulseDot: {
      position: 'absolute',
      top: 3,
      right: 3,
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.success,
    },
    brandName: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 38,
      paddingHorizontal: 10,
    },
    headerBtnText: { fontSize: 13, fontWeight: '700' },
  })
