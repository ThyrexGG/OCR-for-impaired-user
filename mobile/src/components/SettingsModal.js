import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, Contrast, Eye, Headphones, Moon, RotateCcw, Sliders, Sun, Vibrate, X, ZoomIn, ZoomOut } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import AccessiblePressable from './AccessiblePressable'
import AccessibleSwitch from './AccessibleSwitch'
import PillSegmented from './PillSegmented'

// Only what a user needs: how the app looks, how it reads, and vibration. One scrolling page (no tabs), so a
// TalkBack user can swipe through every setting in order. The scan engine, API keys, in-app talk-back and
// explore-by-touch are hidden for now (see IN_APP_TALKBACK / USER_ENGINE_SETTINGS in AppContext).

const VOICE_RATE_OPTIONS = [
  { value: 1, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
]

const LINE_SPACING_OPTIONS = [
  { value: 1.6, label: '1.6x' },
  { value: 1.85, label: '1.85x' },
  { value: 2.1, label: '2.1x' },
]

const THEMES = [
  { key: 'light', label: 'ផ្ទៃភ្លឺច្បាស់', Icon: Sun },
  { key: 'contrast', label: 'កម្រិតពណ៌ខ្ពស់', Icon: Contrast },
  { key: 'dark', label: 'ងងឹតរលោង', Icon: Moon },
]

export default function SettingsModal() {
  const { colors, fonts, currentTheme, setTheme, fontScale, changeFontScale, resetFontScale, lineSpacing, setLineSpacing, isBoldText, toggleBoldText } = useTheme()
  const {
    isSettingsOpen,
    closeSettings,
    voiceRate,
    setVoiceRate,
    isAutoReadEnabled,
    toggleAutoRead,
    isHapticsEnabled,
    toggleHaptics,
    isAppVoiceOnly,
    toggleAppVoiceOnly,
  } = useApp()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors, insets)

  return (
    <Modal visible={isSettingsOpen} transparent animationType="slide" onRequestClose={closeSettings}>
      <Pressable accessible={false} style={styles.backdrop} onPress={closeSettings}>
        <Pressable accessible={false} style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Sliders size={22} color={colors.accent} />
              <Text style={[styles.title, { fontFamily: fonts.khmer }]} accessibilityRole="header">ការកំណត់</Text>
            </View>
            <AccessiblePressable style={styles.closeBtn} accessibilityLabel="បិទផ្ទាំងការកំណត់" onPress={closeSettings}>
              <X size={22} color={colors.textSecondary} />
            </AccessiblePressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <SectionHeader Icon={Eye} label="ការមើលឃើញ" colors={colors} fonts={fonts} />
            <SettingItem title="ទំហំអក្សរ" desc="ពង្រីក ឬបង្រួមអក្សរទាំងអស់ក្នុងកម្មវិធី" colors={colors} fonts={fonts}>
              <View style={styles.scalerRow}>
                <AccessiblePressable style={styles.scaleBtn} disabled={fontScale <= 0.9} accessibilityLabel="បន្ថយទំហំអក្សរ" onPress={() => changeFontScale(-0.1)}>
                  <ZoomOut size={18} color={colors.textPrimary} />
                </AccessiblePressable>
                <AccessiblePressable style={styles.scaleIndicator} accessibilityLabel="កំណត់ទំហំអក្សរឡើងវិញ ១០០%" onPress={resetFontScale}>
                  <RotateCcw size={14} color={colors.textPrimary} />
                  <Text style={styles.scaleIndicatorText}>{Math.round(fontScale * 100)}%</Text>
                </AccessiblePressable>
                <AccessiblePressable style={styles.scaleBtn} disabled={fontScale >= 1.6} accessibilityLabel="បង្កើនទំហំអក្សរ" onPress={() => changeFontScale(0.1)}>
                  <ZoomIn size={18} color={colors.textPrimary} />
                </AccessiblePressable>
              </View>
            </SettingItem>

            <SettingItem title="ពណ៌" desc="ជ្រើសរើសកម្រិតពណ៌ដែលស័ក្តិសមនឹងភ្នែករបស់អ្នក" colors={colors} fonts={fonts}>
              <View style={styles.themeGrid}>
                {THEMES.map(({ key, label, Icon }) => (
                  <AccessiblePressable
                    key={key}
                    style={[styles.themeCard, currentTheme === key && styles.themeCardActive]}
                    accessibilityLabel={label}
                    accessibilityState={{ selected: currentTheme === key }}
                    onPress={() => setTheme(key)}
                  >
                    <Icon size={20} color={currentTheme === key ? colors.accent : colors.textSecondary} />
                    <Text style={[styles.themeCardLabel, { fontFamily: fonts.khmer }]}>{label}</Text>
                  </AccessiblePressable>
                ))}
              </View>
            </SettingItem>

            <SettingItem title="អក្សរដិត" desc="បង្កើនកម្រាស់អក្សរខ្មែរឱ្យងាយអានជាងមុន" colors={colors} fonts={fonts} row>
              <AccessibleSwitch value={isBoldText} onValueChange={toggleBoldText} accessibilityLabel="អក្សរដិត" />
            </SettingItem>

            <SettingItem title="គម្លាតជួរ" desc="ផ្តល់គម្លាតធំទូលាយសម្រាប់ជើងអក្សរ និងស្រៈខ្មែរ" colors={colors} fonts={fonts}>
              <PillSegmented options={LINE_SPACING_OPTIONS} value={lineSpacing} onChange={setLineSpacing} />
            </SettingItem>

            <SectionHeader Icon={Headphones} label="ការស្តាប់" colors={colors} fonts={fonts} />
            <SettingItem title="អានស្វ័យប្រវត្តិ" desc="ចាប់ផ្តើមអានជាសំឡេងភ្លាមៗបន្ទាប់ពីស្កេនឯកសាររួច" colors={colors} fonts={fonts} row>
              <AccessibleSwitch value={isAutoReadEnabled} onValueChange={toggleAutoRead} accessibilityLabel="អានស្វ័យប្រវត្តិ" />
            </SettingItem>
            <SettingItem
              title="ប្រើតែសំឡេង songKHEM"
              desc="បើកពេលសំឡេងរបស់ទូរស័ព្ទមិនអានភាសាខ្មែរ ឬអានមិនត្រឹមត្រូវ។ កម្មវិធីនឹងនិយាយដោយសំឡេង songKHEM ជានិច្ច សូម្បីពេលបើក TalkBack ក៏ដោយ"
              colors={colors}
              fonts={fonts}
              row
            >
              <AccessibleSwitch value={isAppVoiceOnly} onValueChange={toggleAppVoiceOnly} accessibilityLabel="ប្រើតែសំឡេង songKHEM" />
            </SettingItem>
            {/* Only the songKHEM voice follows this speed; with the phone's voice, TalkBack's own speed applies */}
            {isAppVoiceOnly && (
              <SettingItem title="ល្បឿនសំឡេងណែនាំ" desc="ល្បឿននិយាយរបស់សំឡេងណែនាំ មិនប៉ះពាល់ល្បឿនអានឯកសារទេ" colors={colors} fonts={fonts}>
                <PillSegmented options={VOICE_RATE_OPTIONS} value={voiceRate} onChange={setVoiceRate} />
              </SettingItem>
            )}

            <SectionHeader Icon={Vibrate} label="ការញ័រ" colors={colors} fonts={fonts} />
            <SettingItem title="ការញ័រ" desc="ញ័រទូរស័ព្ទពេលចាប់បានឯកសារ និងពេលចុចប៊ូតុង" colors={colors} fonts={fonts} row>
              <AccessibleSwitch value={isHapticsEnabled} onValueChange={toggleHaptics} accessibilityLabel="ការញ័រ" />
            </SettingItem>
          </ScrollView>

          <View style={styles.footer}>
            <AccessiblePressable style={styles.doneBtn} accessibilityLabel="រួចរាល់" hapticIntensity="light" onPress={closeSettings}>
              <Check size={18} color={colors.accentText} />
              <Text style={[styles.doneBtnText, { fontFamily: fonts.khmer }]}>រួចរាល់</Text>
            </AccessiblePressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function SectionHeader({ Icon, label, colors, fonts }) {
  return (
    <View style={[itemStyles.section, { borderBottomColor: colors.borderSubtle }]}>
      <Icon size={18} color={colors.accent} />
      <Text style={[itemStyles.sectionText, { color: colors.accent, fontFamily: fonts.khmer }]} accessibilityRole="header">
        {label}
      </Text>
    </View>
  )
}

function SettingItem({ title, desc, colors, fonts, row, children }) {
  return (
    <View style={[itemStyles.item, row && itemStyles.itemRow]}>
      <View style={itemStyles.labelCol}>
        <Text style={[itemStyles.title, { color: colors.textPrimary, fontFamily: fonts.khmer }]}>{title}</Text>
        <Text style={[itemStyles.desc, { color: colors.textSecondary, fontFamily: fonts.khmer }]}>{desc}</Text>
      </View>
      {children}
    </View>
  )
}

const itemStyles = StyleSheet.create({
  section: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1.5 },
  sectionText: { fontSize: 16, fontWeight: '800' },
  item: { gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  labelCol: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700' },
  desc: { fontSize: 13, lineHeight: 20 },
})

const createStyles = (colors, insets) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: {
      maxHeight: '85%',
      backgroundColor: colors.bgSurface,
      borderTopLeftRadius: colors.radii.xl,
      borderTopRightRadius: colors.radii.xl,
      borderWidth: 2,
      borderColor: colors.borderMedium,
      overflow: 'hidden',
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 2, borderBottomColor: colors.borderSubtle },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    closeBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: colors.radii.sm },
    body: { paddingHorizontal: 18 },
    bodyContent: { gap: 18, paddingTop: 4, paddingBottom: 18 },
    scalerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    scaleBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgSurfaceElevated, borderWidth: 1.5, borderColor: colors.borderSubtle, borderRadius: colors.radii.sm },
    scaleIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 72, height: 44, justifyContent: 'center', backgroundColor: colors.bgSurfaceElevated, borderWidth: 1.5, borderColor: colors.borderSubtle, borderRadius: colors.radii.sm },
    scaleIndicatorText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    themeGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    themeCard: { flexGrow: 1, minWidth: 96, alignItems: 'center', gap: 4, paddingVertical: 14, backgroundColor: colors.bgSurfaceElevated, borderWidth: 1.5, borderColor: colors.borderMedium, borderRadius: colors.radii.md },
    themeCardActive: { borderColor: colors.accent, backgroundColor: colors.accentSubtle },
    themeCardLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    // The sheet is drawn behind the system navigation bar / gesture pill, so the Done button needs that clearance
    footer: { padding: 18, paddingBottom: 18 + Math.max(insets.bottom, 16), borderTopWidth: 1.5, borderTopColor: colors.borderSubtle },
    doneBtn: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: colors.radii.md },
    doneBtnText: { color: colors.accentText, fontWeight: '700', fontSize: 15 },
  })
