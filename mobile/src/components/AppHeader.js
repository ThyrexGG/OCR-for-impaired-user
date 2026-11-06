import { Image, StyleSheet, Text, View } from 'react-native'
import { HelpCircle, Languages, Settings } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import AccessiblePressable from './AccessiblePressable'
import { useTourTarget } from '../context/TourContext'
import { shellFor } from '../theme/shell'

/**
 * The web app's header (App.vue `.assistive-header`) at phone width: logo tile +
 * "SongKhem" on the left, three round 44px icon buttons on the right.
 */
export default function AppHeader() {
  const { colors, fonts, currentTheme } = useTheme()
  const { openHelp, openSettings, addToast, triggerHaptic } = useApp()
  const s = colors.surfaces
  const langRef = useTourTarget('lang')
  const helpRef = useTourTarget('help')
  const settingsRef = useTourTarget('settings')
  const shell = shellFor(currentTheme)
  const styles = createStyles(shell)

  const handleToggleLang = () => {
    triggerHaptic('light')
    addToast('ភាសាអង់គ្លេសកំពុងអភិវឌ្ឍ សូមរង់ចាំបន្តិច (English translation coming soon)', 'info')
  }

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.logoGem}>
          <Image source={require('../assets/logo-mark.png') /* the website's header logo (public/logo.png) */} style={styles.logoImg} resizeMode="contain" />
        </View>
        <Text style={styles.brandName}>SongKhem</Text>
      </View>

      <View style={styles.actions}>
        <AccessiblePressable
          style={styles.roundBtn}
          accessibilityLabel="ភាសាបច្ចុប្បន្ន៖ ខ្មែរ (ចុចដើម្បីប្តូរទៅ English)"
          speakOnPress={false}
          onPress={handleToggleLang}
          ref={langRef}
        >
          <Languages size={22} color={shell.icon} />
        </AccessiblePressable>
        <AccessiblePressable style={styles.roundBtn} accessibilityLabel="របៀបប្រើប្រាស់ (Help / How to Use)" speakOnPress={false} onPress={openHelp} ref={helpRef}>
          <HelpCircle size={22} color={shell.icon} />
        </AccessiblePressable>
        <AccessiblePressable style={styles.roundBtn} accessibilityLabel="បើកការកំណត់លទ្ធភាពប្រើប្រាស់ (Settings)" speakOnPress={false} onPress={openSettings} ref={settingsRef}>
          <Settings size={22} color={shell.icon} />
        </AccessiblePressable>
      </View>
    </View>
  )
}

// App.css .assistive-header / .brand-logo-gem / .brand-name / .header-btn
const createStyles = (shell) =>
  StyleSheet.create({
    header: {
      height: 64,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      backgroundColor: shell.headerBg,
      borderBottomWidth: shell.headerBorderWidth,
      borderBottomColor: shell.headerBorder,
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoGem: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    logoImg: { width: 32, height: 32 },
    brandName: { fontSize: 20, fontWeight: '600', color: shell.brand, letterSpacing: -0.2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    roundBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: shell.iconBtnBorder ? 2 : 0,
      borderColor: shell.iconBtnBorder || 'transparent',
    },
  })
