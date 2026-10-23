import { Image, StyleSheet, Text, View } from 'react-native'
import { HelpCircle, Languages, Settings, Volume2, VolumeX } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import AccessiblePressable from './AccessiblePressable'
import { TP } from '../services/talkPhrases'

/**
 * The web app's header (App.vue `.assistive-header`) at phone width: logo tile +
 * "SongKhem" on the left, three round 44px icon buttons on the right.
 */
export default function AppHeader() {
  const { colors, fonts, currentTheme } = useTheme()
  const { openHelp, openSettings, addToast, triggerHaptic, isUiVoiceEnabled, toggleUiVoice } = useApp()
  const s = colors.surfaces
  const styles = createStyles(colors, currentTheme)

  const handleToggleLang = () => {
    triggerHaptic('light')
    addToast('ភាសាអង់គ្លេសកំពុងអភិវឌ្ឍ សូមរង់ចាំបន្តិច (English translation coming soon)', 'info')
  }

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.logoGem}>
          <Image source={require('../assets/logo.png')} style={styles.logoImg} resizeMode="contain" />
        </View>
        <Text style={[styles.brandName, { fontFamily: fonts.sansBold }]}>SongKhem</Text>
      </View>

      <View style={styles.actions}>
        {/* Always reachable, always first: the one switch a user must be able to find by touch */}
        <AccessiblePressable
          style={[styles.roundBtn, isUiVoiceEnabled && styles.roundBtnOn]}
          accessibilityLabel={isUiVoiceEnabled ? TP.voiceBtnOn.km : TP.voiceBtnOff.km}
          speakOnPress={false}
          onPress={toggleUiVoice}
        >
          {isUiVoiceEnabled ? <Volume2 size={20} color="#FFFFFF" /> : <VolumeX size={20} color={s.onSurface} />}
        </AccessiblePressable>
        <AccessiblePressable
          style={styles.roundBtn}
          accessibilityLabel="ភាសាបច្ចុប្បន្ន៖ ខ្មែរ (ចុចដើម្បីប្តូរទៅ English)"
          speakOnPress={false}
          onPress={handleToggleLang}
        >
          <Languages size={20} color={s.onSurface} />
        </AccessiblePressable>
        <AccessiblePressable style={styles.roundBtn} accessibilityLabel="របៀបប្រើប្រាស់ (Help / How to Use)" speakOnPress={false} onPress={openHelp}>
          <HelpCircle size={20} color={s.onSurface} />
        </AccessiblePressable>
        <AccessiblePressable style={styles.roundBtn} accessibilityLabel="បើកការកំណត់លទ្ធភាពប្រើប្រាស់ (Settings)" speakOnPress={false} onPress={openSettings}>
          <Settings size={20} color={s.onSurface} />
        </AccessiblePressable>
      </View>
    </View>
  )
}

const createStyles = (colors, theme) => {
  const s = colors.surfaces
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: theme === 'dark' ? s.surface1 : '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: s.divider,
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logoGem: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: s.divider,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    logoImg: { width: 30, height: 30 },
    brandName: { fontSize: 19, fontWeight: '800', color: s.onSurface, letterSpacing: -0.2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    roundBtnOn: { backgroundColor: s.primary, borderColor: s.primary },
    roundBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme === 'dark' ? s.surface2 : '#F8FAFC',
      borderWidth: 1,
      borderColor: s.divider,
    },
  })
}
