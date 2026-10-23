import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { ArrowLeft, BookOpen, Camera, Check, Copy, Fingerprint, Pause, Play, RotateCcw, RotateCw, Settings, Upload, Volume2, X } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import { useOcr } from '../context/OcrContext'
import { useTts } from '../context/TtsContext'
import { tokenizeText } from '../utils/textTokenizer'
import { buildSummaryPoints } from '../utils/summary'
import AccessiblePressable from '../components/AccessiblePressable'
import useScreenIntro from '../utils/useScreenIntro'
import { TP } from '../services/talkPhrases'

const ORANGE = '#EA580C'
const ORANGE_ACTIVE = '#D97706'
const HIGHLIGHT = '#FEF08A'

// The web app's reader mode (DocumentReader.vue): top bar, the text with a
// karaoke highlight, a floating actions button, and a bottom player bar with
// rewind / play / forward / voice. No global header or tab bar here.
export default function ReaderScreen({ navigation }) {
  const { colors, fonts, currentTheme, fontScale, lineSpacing, isBoldText } = useTheme()
  const { triggerHaptic, speakAccessibility, announce, addToast, openSettings, isAutoReadEnabled } = useApp()
  const { extractedText } = useOcr()
  const { isSpeaking, activeWordIndex, togglePlayback, stopSpeech, jumpWords, seekToWord, voices, selectedVoiceName, selectVoice, speedPresets, rate, setSpeedPreset } = useTts()
  const insets = useSafeAreaInsets()
  const s = colors.surfaces
  const styles = useMemo(() => createStyles(s, currentTheme, insets), [s, currentTheme, insets])

  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [isVoiceOpen, setIsVoiceOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const scrollRef = useRef(null)
  const paragraphY = useRef({})

  const paragraphs = useMemo(() => tokenizeText(extractedText), [extractedText])
  const hasText = !!(extractedText && extractedText.trim())
  // With auto-read on, the scan result and the reading itself already say what is happening
  useScreenIntro(() => (hasText && !isAutoReadEnabled ? TP.readerReady.km : null), { interrupt: false })
  const summaryPoints = useMemo(() => buildSummaryPoints(extractedText), [extractedText])

  // Follow the highlight only while audio is playing, so manual scrolling is never hijacked
  useEffect(() => {
    if (!isSpeaking || activeWordIndex < 0) return
    const para = paragraphs.find((p) => p.sentences.some((sn) => sn.words.some((w) => w.globalIndex === activeWordIndex)))
    const y = para ? paragraphY.current[para.index] : undefined
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 40), animated: true })
  }, [activeWordIndex, isSpeaking, paragraphs])

  const handleBack = useCallback(() => {
    stopSpeech()
    triggerHaptic('light')
    speakAccessibility('ត្រឡប់ទៅការស្កេន')
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('Camera')
  }, [navigation, stopSpeech, triggerHaptic, speakAccessibility])

  const handleCopy = async () => {
    setIsActionsOpen(false)
    if (!hasText) return
    await Clipboard.setStringAsync(extractedText)
    triggerHaptic('success')
    setIsCopied(true)
    addToast('បានចម្លង', 'success')
    setTimeout(() => setIsCopied(false), 2500)
  }

  const openSummary = () => {
    setIsActionsOpen(false)
    setIsSummaryOpen(true)
    triggerHaptic('medium')
    announce('បានបើកផ្ទាំងសង្ខេបខ្លឹមសារសំខាន់ៗ')
  }

  const fontSize = 22 * fontScale

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* 1. Top bar */}
      <View style={styles.topBar}>
        <AccessiblePressable style={styles.iconBtn} accessibilityLabel="ត្រឡប់ក្រោយ" speakOnPress={false} onPress={handleBack}>
          <ArrowLeft size={24} color={s.onSurface} />
        </AccessiblePressable>
        <Text style={[styles.topTitle, { fontFamily: fonts.khmerBold }]} accessibilityRole="header">
          អានឯកសារ
        </Text>
        <AccessiblePressable style={styles.iconBtn} accessibilityLabel="បើកការកំណត់" speakOnPress={false} onPress={openSettings}>
          <Settings size={22} color={s.onSurface} />
        </AccessiblePressable>
      </View>

      {/* 2. Reading area */}
      {hasText ? (
        <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.textPage} onScrollBeginDrag={() => setIsActionsOpen(false)}>
          {paragraphs.map((para) => (
            <Text
              key={para.index}
              onLayout={(e) => {
                paragraphY.current[para.index] = e.nativeEvent.layout.y
              }}
              style={[styles.paragraph, { fontFamily: isBoldText ? fonts.khmerBold : fonts.khmer, fontSize, lineHeight: fontSize * lineSpacing }]}
            >
              {para.sentences.flatMap((sn) =>
                sn.words.map((w) => (
                  <Text
                    key={w.globalIndex}
                    onPress={() => {
                      triggerHaptic('light')
                      seekToWord(w.globalIndex)
                    }}
                    accessibilityRole="button"
                    style={activeWordIndex === w.globalIndex ? styles.activeWord : null}
                  >
                    {w.text + ' '}
                  </Text>
                ))
              )}
            </Text>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { fontFamily: fonts.khmerBold }]}>មិនទាន់មានឯកសារអានទេ</Text>
          <Text style={[styles.emptySub, { fontFamily: fonts.khmer }]}>សូមថតរូបភាព ឬជ្រើសរើសឯកសារដើម្បីចាប់ផ្តើមអាន</Text>
          <View style={styles.emptyRow}>
            <AccessiblePressable style={[styles.heroBtn, { backgroundColor: s.primary }]} accessibilityLabel="ស្កេនរូបភាព" onPress={() => navigation.navigate('Camera')}>
              <Camera size={20} color="#FFFFFF" />
              <Text style={[styles.heroBtnText, { fontFamily: fonts.khmerBold }]}>ស្កេនរូបភាព</Text>
            </AccessiblePressable>
            <AccessiblePressable style={[styles.heroBtn, { backgroundColor: s.surface2 }]} accessibilityLabel="ជ្រើសរើសឯកសារ" onPress={() => navigation.navigate('Upload')}>
              <Upload size={20} color={s.onTonal} />
              <Text style={[styles.heroBtnText, { fontFamily: fonts.khmerBold, color: s.onTonal }]}>ជ្រើសរើសឯកសារ</Text>
            </AccessiblePressable>
          </View>
        </View>
      )}

      {/* 3. Floating actions (summarize / copy) */}
      {hasText && (
        <View style={styles.fabAnchor} pointerEvents="box-none">
          {isActionsOpen && (
            <View style={styles.pills}>
              <AccessiblePressable style={styles.pill} accessibilityLabel="សង្ខេបខ្លឹមសារ" speakOnPress={false} onPress={openSummary}>
                <BookOpen size={18} color={s.primary} />
                <Text style={[styles.pillText, { fontFamily: fonts.khmerBold }]}>សង្ខេប</Text>
              </AccessiblePressable>
              <AccessiblePressable style={styles.pill} accessibilityLabel="ចម្លងអត្ថបទ" speakOnPress={false} onPress={handleCopy}>
                {isCopied ? <Check size={18} color={s.primary} /> : <Copy size={18} color={s.primary} />}
                <Text style={[styles.pillText, { fontFamily: fonts.khmerBold }]}>ចម្លង</Text>
              </AccessiblePressable>
            </View>
          )}
          <AccessiblePressable
            style={styles.fab}
            accessibilityLabel="មុខងារបន្ថែម (សង្ខេប និងចម្លង)"
            accessibilityState={{ expanded: isActionsOpen }}
            speakOnPress={false}
            hapticIntensity="medium"
            onPress={() => setIsActionsOpen((o) => !o)}
          >
            <Fingerprint size={26} color="#FFFFFF" />
          </AccessiblePressable>
        </View>
      )}

      {/* 4. Bottom player bar */}
      {hasText && (
        <View style={styles.playerBar}>
          <View style={styles.cluster}>
            <AccessiblePressable style={styles.roundBtn} accessibilityLabel="ថយក្រោយ ៥ ពាក្យ" speakOnPress={false} onPress={() => jumpWords(-5)}>
              <RotateCcw size={22} color={s.primary} />
            </AccessiblePressable>
            <AccessiblePressable
              style={[styles.playBtn, isSpeaking && { backgroundColor: ORANGE_ACTIVE }]}
              accessibilityLabel={isSpeaking ? 'ផ្អាកការអាន' : 'ចាប់ផ្តើមអាន'}
              speakOnPress={false}
              hapticIntensity="medium"
              onPress={togglePlayback}
            >
              {isSpeaking ? <Pause size={28} color="#FFFFFF" fill="#FFFFFF" /> : <Play size={28} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 3 }} />}
            </AccessiblePressable>
            <AccessiblePressable style={styles.roundBtn} accessibilityLabel="ទៅមុខ ៥ ពាក្យ" speakOnPress={false} onPress={() => jumpWords(5)}>
              <RotateCw size={22} color={s.primary} />
            </AccessiblePressable>
            <AccessiblePressable style={styles.roundBtn} accessibilityLabel="ជ្រើសរើសសំឡេង និងល្បឿន" speakOnPress={false} onPress={() => setIsVoiceOpen(true)}>
              <Volume2 size={22} color={s.primary} />
            </AccessiblePressable>
          </View>
        </View>
      )}

      {/* Summary dialog */}
      <Modal visible={isSummaryOpen} transparent animationType="fade" onRequestClose={() => setIsSummaryOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsSummaryOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <SheetHeader styles={styles} fonts={fonts} s={s} title="សង្ខេបខ្លឹមសារ" Icon={BookOpen} onClose={() => setIsSummaryOpen(false)} />
            <ScrollView style={styles.summaryScroll}>
              {summaryPoints.map((pt, i) => (
                <View key={i} style={styles.summaryRow}>
                  <View style={styles.bullet} />
                  <Text style={[styles.summaryText, { fontFamily: fonts.khmer }]}>{pt}</Text>
                </View>
              ))}
            </ScrollView>
            <AccessiblePressable
              style={[styles.sheetCta, { backgroundColor: s.primary }]}
              accessibilityLabel="អានសង្ខេបជាសំឡេង"
              speakOnPress={false}
              onPress={() => speakAccessibility(summaryPoints.join('. '))}
            >
              <Volume2 size={20} color="#FFFFFF" />
              <Text style={[styles.sheetCtaText, { fontFamily: fonts.khmerBold }]}>អានសង្ខេបជាសំឡេង</Text>
            </AccessiblePressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Voice & speed dialog */}
      <Modal visible={isVoiceOpen} transparent animationType="fade" onRequestClose={() => setIsVoiceOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsVoiceOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <SheetHeader styles={styles} fonts={fonts} s={s} title="សំឡេង និងល្បឿនអាន" Icon={Volume2} onClose={() => setIsVoiceOpen(false)} />
            <ScrollView style={styles.voiceScroll}>
              {voices.map((v) => {
                const on = v.name === selectedVoiceName
                return (
                  <AccessiblePressable
                    key={v.name}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={v.label}
                    style={[styles.voiceRow, on && { backgroundColor: s.surface2, borderColor: s.primary }]}
                    speakOnPress={false}
                    onPress={() => selectVoice(v.name)}
                  >
                    <Text style={[styles.voiceText, { fontFamily: on ? fonts.khmerBold : fonts.khmer }]}>{v.label}</Text>
                    {on && <Check size={20} color={s.primary} />}
                  </AccessiblePressable>
                )
              })}
            </ScrollView>
            <Text style={[styles.speedLabel, { fontFamily: fonts.khmerBold }]}>ល្បឿនអាន</Text>
            <View style={styles.speedRow}>
              {speedPresets.map((sp) => (
                <AccessiblePressable
                  key={sp}
                  accessibilityLabel={`ល្បឿនអាន ${sp} ដង`}
                  speakOnPress={false}
                  style={[styles.speedPill, rate === sp && { backgroundColor: s.primary, borderColor: s.primary }]}
                  onPress={() => setSpeedPreset(sp)}
                >
                  <Text style={[styles.speedText, rate === sp && styles.speedTextOn]}>{sp}x</Text>
                </AccessiblePressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

function SheetHeader({ styles, fonts, s, title, Icon, onClose }) {
  return (
    <View style={styles.sheetHeader}>
      <View style={styles.sheetTitleRow}>
        <View style={styles.gem}>
          <Icon size={20} color={s.primary} />
        </View>
        <Text style={[styles.sheetTitle, { fontFamily: fonts.khmerBold }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <AccessiblePressable style={styles.closeBtn} accessibilityLabel="បិទ" speakOnPress={false} onPress={onClose}>
        <X size={20} color={s.onSurface} />
      </AccessiblePressable>
    </View>
  )
}

const createStyles = (s, theme, insets) => {
  const surface = theme === 'dark' ? s.surface1 : '#FFFFFF'
  return StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: s.bg },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: surface, borderBottomWidth: 1, borderBottomColor: s.divider },
    topTitle: { fontSize: 19, color: s.onSurface },
    iconBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    textPage: { padding: 20, paddingBottom: 190, gap: 18 },
    paragraph: { color: s.onSurface, fontWeight: '600' },
    activeWord: { backgroundColor: HIGHLIGHT, color: '#0F172A' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
    emptyTitle: { fontSize: 22, color: s.onSurface, textAlign: 'center' },
    emptySub: { fontSize: 16, color: s.onSurfaceMuted, textAlign: 'center', lineHeight: 26 },
    emptyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 12 },
    heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, paddingHorizontal: 20, borderRadius: 25 },
    heroBtnText: { color: '#FFFFFF', fontSize: 16 },
    fabAnchor: { position: 'absolute', right: 16, bottom: 104 + insets.bottom, alignItems: 'flex-end', gap: 10 },
    fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: s.primary, elevation: 6, shadowColor: s.primary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    pills: { gap: 8, alignItems: 'flex-end' },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 18, borderRadius: 23, backgroundColor: surface, borderWidth: 1, borderColor: s.divider, elevation: 4, shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
    pillText: { fontSize: 16, color: s.onSurface },
    playerBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12 + insets.bottom, backgroundColor: surface, borderTopWidth: 1, borderTopColor: s.divider },
    cluster: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 },
    roundBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: theme === 'dark' ? s.surface2 : '#EEF2FF' },
    playBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: ORANGE, elevation: 6, shadowColor: ORANGE, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center', padding: 18 },
    sheet: { width: '100%', maxWidth: 440, borderRadius: 24, padding: 18, gap: 12, backgroundColor: surface },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
    gem: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: s.surface2 },
    sheetTitle: { fontSize: 19, color: s.onSurface, flexShrink: 1 },
    closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme === 'dark' ? s.surface2 : '#F1F5F9' },
    summaryScroll: { maxHeight: 340 },
    summaryRow: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
    bullet: { width: 8, height: 8, borderRadius: 4, marginTop: 11, backgroundColor: s.primary },
    summaryText: { flex: 1, fontSize: 18, lineHeight: 30, color: s.onSurface },
    sheetCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 25 },
    sheetCtaText: { color: '#FFFFFF', fontSize: 17 },
    voiceScroll: { maxHeight: 300 },
    voiceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 56, paddingHorizontal: 14, marginBottom: 8, borderRadius: 16, borderWidth: 1.5, borderColor: s.divider },
    voiceText: { flex: 1, fontSize: 16, lineHeight: 24, color: s.onSurface },
    speedLabel: { fontSize: 16, color: s.onSurface },
    speedRow: { flexDirection: 'row', gap: 8 },
    speedPill: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1.5, borderColor: s.divider },
    speedText: { fontSize: 15, fontWeight: '800', color: s.onSurface },
    speedTextOn: { color: '#FFFFFF' },
  })
}
