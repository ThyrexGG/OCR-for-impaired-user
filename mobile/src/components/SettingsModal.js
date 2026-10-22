import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Check, Contrast, Eye, Headphones, Moon, RotateCcw, Scan, Sliders, Sun, X, ZoomIn, ZoomOut } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import AccessiblePressable from './AccessiblePressable'
import AccessibleSwitch from './AccessibleSwitch'
import PillSegmented from './PillSegmented'
import NeoButton from './NeoButton'
import { clearOcrCache } from '../services/cache'
import { CLOUD_API_AVAILABLE } from '../services/cloudApi'

const TABS = [
  { key: 'visual', label: 'ការមើលឃើញ', Icon: Eye },
  { key: 'audio', label: 'ការស្តាប់ & សំឡេង', Icon: Headphones },
  { key: 'ocr', label: 'ម៉ាស៊ីនស្កេន', Icon: Scan },
  { key: 'interaction', label: 'ការញ័រ', Icon: Sliders },
]

// App.vue's OCR engine radio cards (Settings > OCR tab).
const OCR_ENGINES = [
  {
    value: 'tesseract',
    free: true,
    badge: 'ឥតគិតថ្លៃ (Default)',
    name: 'Tesseract.js (ស្កេនក្នុងម៉ាស៊ីន)',
    desc: 'ដំណើរការផ្ទាល់ក្នុងទូរស័ព្ទ មិនត្រូវការ API Key និងមិនបាត់បង់ឯកជនភាព',
  },
  {
    value: 'google-vision',
    badge: 'Cloud API',
    name: 'Google Cloud Vision API',
    desc: 'កម្រិតភាពជាក់លាក់ខ្ពស់បំផុតសម្រាប់អក្សរពុម្ពខ្មែរស្មុគស្មាញ (ត្រូវការអ៊ីនធឺណិត)',
  },
  {
    value: 'azure-read',
    badge: 'Cloud API',
    name: 'Microsoft Azure AI Vision',
    desc: 'សមត្ថភាពអានឯកសារក្រដាស និងវិក័យប័ត្រ (ត្រូវការ Subscription Key)',
  },
]

const LINE_SPACING_OPTIONS = [
  { value: 1.6, label: '1.6x' },
  { value: 1.85, label: '1.85x' },
  { value: 2.1, label: '2.1x' },
]

export default function SettingsModal() {
  const { colors, fonts, currentTheme, setTheme, fontScale, changeFontScale, resetFontScale, lineSpacing, setLineSpacing, isBoldText, toggleBoldText } = useTheme()
  const {
    isSettingsOpen,
    closeSettings,
    isUiVoiceEnabled,
    toggleUiVoice,
    isAutoReadEnabled,
    toggleAutoRead,
    isHapticsEnabled,
    toggleHaptics,
    testHaptics,
    ocrConfig,
    saveOcrConfig,
    triggerHaptic,
    speakAccessibility,
    addToast,
  } = useApp()
  const [activeTab, setActiveTab] = useState('visual')
  const [draftConfig, setDraftConfig] = useState(ocrConfig)
  const styles = createStyles(colors)

  // Reset the draft form fields to the persisted values each time the sheet opens.
  useEffect(() => {
    if (isSettingsOpen) setDraftConfig(ocrConfig)
  }, [isSettingsOpen, ocrConfig])

  const patchDraft = (field) => (text) => setDraftConfig((prev) => ({ ...prev, [field]: text }))

  const effectiveProvider = draftConfig.provider || (CLOUD_API_AVAILABLE ? 'google-vision' : 'tesseract')

  // Fields auto-save on blur and engine cards on tap, like App.vue's
  // `@blur` / `@change="saveOcrConfig"` (no separate Save button there).
  const commitDraft = () => saveOcrConfig({ ...draftConfig, provider: effectiveProvider })

  const selectEngine = (value) => {
    const next = { ...draftConfig, provider: value }
    setDraftConfig(next)
    saveOcrConfig(next)
  }

  const handleClearCache = async () => {
    await clearOcrCache()
    triggerHaptic('light')
    speakAccessibility('បានសម្អាត Cache ឯកសារស្កេនរួចរាល់')
    addToast('បានសម្អាត Cache ឯកសារស្កេនរួចរាល់', 'success')
  }

  return (
    <Modal visible={isSettingsOpen} transparent animationType="slide" onRequestClose={closeSettings}>
      <Pressable style={styles.backdrop} onPress={closeSettings}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Sliders size={22} color={colors.accent} />
              <Text style={[styles.title, { fontFamily: fonts.khmer }]}>ការកំណត់លទ្ធភាពប្រើប្រាស់</Text>
            </View>
            <AccessiblePressable style={styles.closeBtn} accessibilityLabel="បិទផ្ទាំងការកំណត់" onPress={closeSettings}>
              <X size={22} color={colors.textSecondary} />
            </AccessiblePressable>
          </View>

          <View style={styles.tabs}>
            {TABS.map(({ key, label, Icon }) => (
              <AccessiblePressable
                key={key}
                style={[styles.tabPill, activeTab === key && styles.tabPillActive]}
                accessibilityLabel={label}
                onPress={() => setActiveTab(key)}
              >
                <Icon size={16} color={activeTab === key ? colors.accentText : colors.textSecondary} />
                <Text style={[styles.tabPillText, activeTab === key && { color: colors.accentText }, { fontFamily: fonts.khmer }]}>{label}</Text>
              </AccessiblePressable>
            ))}
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ gap: 18 }}>
            {activeTab === 'visual' && (
              <>
                <SettingItem title="ទំហំអក្សរទូទៅ (Text Scaling)" desc="ពង្រីក ឬបង្រួមអក្សរទាំងអស់ក្នុងកម្មវិធី" fonts={fonts}>
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

                <SettingItem title="ទម្រង់ពណ៌កម្រិតខ្ពស់ (Contrast Themes)" desc="ជ្រើសរើសកម្រិតពណ៌ដែលស័ក្តិសមនឹងភ្នែករបស់អ្នក" fonts={fonts}>
                  <View style={styles.themeGrid}>
                    {[
                      { key: 'light', label: 'ផ្ទៃភ្លឺច្បាស់', sub: 'Royal Light', Icon: Sun },
                      { key: 'contrast', label: 'កម្រិតពណ៌ខ្ពស់', sub: 'Ultra Contrast', Icon: Contrast },
                      { key: 'dark', label: 'ងងឹតរលោង', sub: 'Midnight Dark', Icon: Moon },
                    ].map(({ key, label, sub, Icon }) => (
                      <AccessiblePressable
                        key={key}
                        style={[styles.themeCard, currentTheme === key && styles.themeCardActive]}
                        accessibilityLabel={label}
                        onPress={() => setTheme(key)}
                      >
                        <Icon size={20} color={currentTheme === key ? colors.accent : colors.textSecondary} />
                        <Text style={[styles.themeCardLabel, { fontFamily: fonts.khmer }]}>{label}</Text>
                        <Text style={styles.themeCardSub}>{sub}</Text>
                      </AccessiblePressable>
                    ))}
                  </View>
                </SettingItem>

                <SettingItem title="អក្សរដិតច្បាស់ (Bold Typography)" desc="បង្កើនកម្រាស់អក្សរខ្មែរឱ្យងាយអានជាងមុន" fonts={fonts} row>
                  <AccessibleSwitch value={isBoldText} onValueChange={toggleBoldText} accessibilityLabel="បើកបិទអក្សរដិត" />
                </SettingItem>

                <SettingItem title="គម្លាតជួរដេក (Line Spacing)" desc="ផ្តល់គម្លាតធំទូលាយសម្រាប់ជើងអក្សរ និងស្រៈខ្មែរ" fonts={fonts}>
                  <PillSegmented options={LINE_SPACING_OPTIONS} value={lineSpacing} onChange={setLineSpacing} />
                </SettingItem>
              </>
            )}

            {activeTab === 'audio' && (
              <>
                <SettingItem title="សំឡេងជំនួយបញ្ជា (Spoken UI Guidance)" desc="ប្រព័ន្ធនឹងអានឈ្មោះប៊ូតុងនៅពេលចុច" fonts={fonts} row>
                  <AccessibleSwitch value={isUiVoiceEnabled} onValueChange={toggleUiVoice} accessibilityLabel="បើកបិទសំឡេងជំនួយបញ្ជា UI" />
                </SettingItem>
                <SettingItem title="អានស្វ័យប្រវត្តិ (Auto-Read After Scan)" desc="ចាប់ផ្តើមអានជាសំឡេងភ្លាមៗបន្ទាប់ពីស្កេនឯកសាររួច" fonts={fonts} row>
                  <AccessibleSwitch value={isAutoReadEnabled} onValueChange={toggleAutoRead} accessibilityLabel="បើកបិទការអានស្វ័យប្រវត្តិ" />
                </SettingItem>
                <SettingItem
                  title="សំឡេងខ្មែរ Neural កម្រិតខ្ពស់ (Azure Speech - ស្រេចចិត្ត)"
                  desc="សំឡេង Piseth & Sreymom មានស្រាប់។ បញ្ចូល Key តែពេលចង់ប្រើគណនី Azure ផ្ទាល់ខ្លួនប៉ុណ្ណោះ"
                  fonts={fonts}
                >
                  <View style={styles.apiFields}>
                    <TextInput
                      style={styles.textInput}
                      value={draftConfig.azureTtsKey}
                      onChangeText={patchDraft('azureTtsKey')}
                      onEndEditing={commitDraft}
                      placeholder="Azure TTS Subscription Key"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                    <TextInput
                      style={styles.textInput}
                      value={draftConfig.azureTtsEndpoint}
                      onChangeText={patchDraft('azureTtsEndpoint')}
                      onEndEditing={commitDraft}
                      placeholder="Azure TTS Endpoint (ស្រេចចិត្ត)"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </View>
                </SettingItem>
              </>
            )}

            {activeTab === 'ocr' && (
              <>
                <SettingItem
                  title="ម៉ាស៊ីនស្រង់អត្ថបទ (OCR Engine)"
                  desc="ជ្រើសរើសបច្ចេកវិទ្យាសម្រាប់ស្កេនស្រង់អក្សរខ្មែរ និងអង់គ្លេស"
                  fonts={fonts}
                >
                  <View style={styles.engineOptions}>
                    {OCR_ENGINES.map((engine) => {
                      const selected = effectiveProvider === engine.value
                      return (
                        <AccessiblePressable
                          key={engine.value}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={engine.name}
                          style={[styles.engineCard, selected && styles.engineCardSelected]}
                          onPress={() => selectEngine(engine.value)}
                        >
                          <View style={[styles.engineBadge, engine.free ? styles.engineBadgeFree : styles.engineBadgeCloud]}>
                            <Text style={[styles.engineBadgeText, engine.free ? styles.engineBadgeFreeText : styles.engineBadgeCloudText, { fontFamily: fonts.khmer }]}>
                              {engine.badge}
                            </Text>
                          </View>
                          <Text style={[styles.engineName, { fontFamily: fonts.khmer }]}>{engine.name}</Text>
                          <Text style={[styles.engineDesc, { fontFamily: fonts.khmer }]}>{engine.desc}</Text>
                        </AccessiblePressable>
                      )
                    })}
                  </View>
                </SettingItem>

                {effectiveProvider === 'google-vision' && (
                  <SettingItem title="Google Vision API Credentials" desc="ស្រេចចិត្ត — ទុកទទេដើម្បីប្រើម៉ាស៊ីនស្កេនរបស់ songKHEM" fonts={fonts}>
                    <TextInput
                      style={styles.textInput}
                      value={draftConfig.googleApiKey}
                      onChangeText={patchDraft('googleApiKey')}
                      onEndEditing={commitDraft}
                      placeholder="Google Vision API Key (AIza...)"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </SettingItem>
                )}

                {effectiveProvider === 'azure-read' && (
                  <SettingItem title="Azure Computer Vision Credentials" desc="បញ្ចូល Subscription Key និង Endpoint ពី Azure Portal" fonts={fonts}>
                    <View style={styles.apiFields}>
                      <TextInput
                        style={styles.textInput}
                        value={draftConfig.azureVisionKey}
                        onChangeText={patchDraft('azureVisionKey')}
                        onEndEditing={commitDraft}
                        placeholder="Azure Computer Vision Key"
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry
                        autoCapitalize="none"
                      />
                      <TextInput
                        style={styles.textInput}
                        value={draftConfig.azureVisionEndpoint}
                        onChangeText={patchDraft('azureVisionEndpoint')}
                        onEndEditing={commitDraft}
                        placeholder="Endpoint URL (ឧ. https://eastus.api.cognitive.microsoft.com/)"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        keyboardType="url"
                      />
                    </View>
                  </SettingItem>
                )}

                <SettingItem
                  title="សម្អាត Cache ឯកសារ (Clear Scanned Cache)"
                  desc="លុបចោលលទ្ធផលស្កេនដែលបានរក្សាទុកក្នុងទូរស័ព្ទ ដើម្បីស្កេនឡើងវិញថ្មីស្រឡាង"
                  fonts={fonts}
                >
                  <NeoButton
                    style={styles.clearCacheWrap}
                    offsetX={-3}
                    offsetY={3}
                    bg="#FFFFFF"
                    borderColor="#0F172A"
                    shadowColor="#1D4ED8"
                    contentStyle={styles.clearCacheBtn}
                    accessibilityLabel="សម្អាត Cache ឯកសារស្កេនទាំងអស់"
                    onPress={handleClearCache}
                  >
                    <RotateCcw size={16} color="#0F172A" />
                    <Text style={[styles.clearCacheText, { fontFamily: fonts.khmer }]}>សម្អាត Cache</Text>
                  </NeoButton>
                </SettingItem>
              </>
            )}

            {activeTab === 'interaction' && (
              <>
              <SettingItem title="ការញ័រផ្តល់ដំណឹង (Haptic Feedback)" desc="ញ័រទូរស័ព្ទពេលចាប់បានឯកសារ និងពេលចុចប៊ូតុង" fonts={fonts} row>
                <AccessibleSwitch value={isHapticsEnabled} onValueChange={toggleHaptics} accessibilityLabel="បើកបិទការញ័រផ្តល់ដំណឹង" />
              </SettingItem>
              <SettingItem title="សាកល្បងការញ័រ (Test Vibration)" desc="ចុចដើម្បីពិនិត្យថាទូរស័ព្ទញ័រឬអត់" fonts={fonts}>
                <NeoButton
                  bg="#FFFFFF"
                  borderColor="#0F172A"
                  shadowColor="#1D4ED8"
                  contentStyle={styles.clearCacheBtn}
                  accessibilityLabel="សាកល្បងការញ័រ"
                  onPress={testHaptics}
                  speakOnPress={false}
                >
                  <Sliders size={16} color="#0F172A" />
                  <Text style={[styles.clearCacheText, { fontFamily: fonts.khmer }]}>សាកល្បងការញ័រ</Text>
                </NeoButton>
              </SettingItem>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <AccessiblePressable style={styles.doneBtn} accessibilityLabel="រួចរាល់ (Done)" hapticIntensity="light" onPress={closeSettings}>
              <Check size={18} color={colors.accentText} />
              <Text style={[styles.doneBtnText, { fontFamily: fonts.khmer }]}>រួចរាល់ (Done)</Text>
            </AccessiblePressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function SettingItem({ title, desc, fonts, row, children }) {
  return (
    <View style={[itemStyles.item, row && itemStyles.itemRow]}>
      <View style={itemStyles.labelCol}>
        <Text style={[itemStyles.title, { fontFamily: fonts.khmer }]}>{title}</Text>
        <Text style={[itemStyles.desc, { fontFamily: fonts.khmer }]}>{desc}</Text>
      </View>
      {children}
    </View>
  )
}

const itemStyles = StyleSheet.create({
  item: { gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  labelCol: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700' },
  desc: { fontSize: 12, opacity: 0.7 },
})

const createStyles = (colors) =>
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
    title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    closeBtn: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: colors.radii.sm },
    tabs: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
    tabPill: {
      flexGrow: 1,
      minWidth: '45%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 40,
      backgroundColor: colors.bgSurfaceElevated,
      borderWidth: 1.5,
      borderColor: colors.borderSubtle,
      borderRadius: colors.radii.sm,
    },
    tabPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    tabPillText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    body: { paddingHorizontal: 18, paddingTop: 4 },
    scalerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    scaleBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgSurfaceElevated, borderWidth: 1.5, borderColor: colors.borderSubtle, borderRadius: colors.radii.sm },
    scaleIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 72, height: 44, justifyContent: 'center', backgroundColor: colors.bgSurfaceElevated, borderWidth: 1.5, borderColor: colors.borderSubtle, borderRadius: colors.radii.sm },
    scaleIndicatorText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    themeGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    themeCard: { flexGrow: 1, minWidth: 96, alignItems: 'center', gap: 4, paddingVertical: 14, backgroundColor: colors.bgSurfaceElevated, borderWidth: 1.5, borderColor: colors.borderMedium, borderRadius: colors.radii.md },
    themeCardActive: { borderColor: colors.accent, backgroundColor: colors.accentSubtle },
    themeCardLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
    themeCardSub: { fontSize: 10, color: colors.textMuted },
    textInput: {
      minHeight: 46,
      paddingHorizontal: 14,
      backgroundColor: colors.bgSurfaceElevated,
      borderWidth: 1.5,
      borderColor: colors.borderMedium,
      borderRadius: colors.radii.sm,
      color: colors.textPrimary,
      fontSize: 14,
    },
    apiFields: { gap: 10 },
    engineOptions: { gap: 10 },
    engineCard: {
      gap: 4,
      padding: 14,
      backgroundColor: colors.bgSurfaceElevated,
      borderWidth: 2,
      borderColor: colors.borderSubtle,
      borderRadius: 4,
    },
    engineCardSelected: { borderColor: colors.accent, backgroundColor: colors.accentSubtle },
    engineBadge: { alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4 },
    engineBadgeFree: { backgroundColor: colors.successSubtle },
    engineBadgeCloud: { backgroundColor: colors.accentSubtle },
    engineBadgeText: { fontSize: 12, fontWeight: '800' },
    engineBadgeFreeText: { color: colors.success },
    engineBadgeCloudText: { color: colors.accent },
    engineName: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    engineDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    clearCacheWrap: { alignSelf: 'flex-start', marginLeft: 3 },
    clearCacheBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 42, paddingHorizontal: 16 },
    clearCacheText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    footer: { padding: 18, borderTopWidth: 1.5, borderTopColor: colors.borderSubtle },
    doneBtn: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: colors.radii.md },
    doneBtnText: { color: colors.accentText, fontWeight: '700', fontSize: 15 },
  })
