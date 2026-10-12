import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { findNodeHandle, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import {
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  FileText,
  Pause,
  Sparkles,
  Upload,
  Volume2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import { useOcr } from '../context/OcrContext'
import { useTts } from '../context/TtsContext'
import { tokenizeText } from '../utils/textTokenizer'
import AccessiblePressable from './AccessiblePressable'
import NeoButton from './NeoButton'
import TtsControls from './TtsControls'
import { navigateToCamera, navigateToUpload } from '../navigation/navigationRef'

const HIGHLIGHT_MODES = [
  { key: 'word', label: 'ពាក្យ' },
  { key: 'sentence', label: 'ប្រយោគ' },
  { key: 'paragraph', label: 'កថាខណ្ឌ' },
]

// Web equivalent's hardcoded (non-token) colors — OcrPanel.css's document
// card / reading card / toolbar, most of which don't vary by theme at all
// (only the card backgrounds get a `[data-theme="dark"]` override).
const PALETTE = {
  light: { ink: '#0F172A', secondaryBg: '#EEF2FF', secondaryText: '#2563EB', cardBg: '#FFFFFF', cardBorder: '#E2E8F0', toolbarBg: '#F8FAFC', controlBorder: '#CBD5E1', text: '#0F172A', accent: '#2563EB', muted: '#64748B' },
  dark: { ink: '#FFFFFF', secondaryBg: '#1E293B', secondaryText: '#93C5FD', cardBg: '#111B2E', cardBorder: '#1E293B', toolbarBg: '#0B132B', controlBorder: '#334155', text: '#FFFFFF', accent: '#60A5FA', muted: '#94A3B8' },
}

const wordCount = (text) => (text ? text.trim().split(/\s+/).filter((w) => w.length > 0).length : 0)

// Ported verbatim (Khmer strings) from OcrPanel.vue's VOCABULARY_DB.
const VOCABULARY_DB = [
  { term: 'ពិការភាពគំហើញ', meaning: 'ស្ថានភាពដែលភ្នែកមើលមិនឃើញច្បាស់ ឬពិការទាំងស្រុង ដែលត្រូវការឧបករណ៍ជំនួយក្នុងការអាន។' },
  { term: 'បច្ចេកវិទ្យាជំនួយ', meaning: 'ឧបករណ៍ ឬកម្មវិធីកុំព្យូទ័រ/ទូរស័ព្ទ (ដូចជា Screen Reader) ដែលជួយសម្រួលដល់ជនពិការ។' },
  { term: 'គ្រឹះស្ថានសិក្សា', meaning: 'សាលារៀន វិទ្យាល័យ ឬសកលវិទ្យាល័យសម្រាប់ការអប់រំ។' },
  { term: 'សមភាព', meaning: 'ភាពស្មើគ្នា និងឱកាសស្មើគ្នាក្នុងសង្គម។' },
  { term: 'វិក័យប័ត្រ', meaning: 'ឯកសារបញ្ជាក់ពីការទិញទំនិញ ឬសេវា និងចំនួនទឹកប្រាក់ត្រូវបង់។' },
  { term: 'ធនញ្ជ័យ', meaning: 'តួអង្គក្នុងរឿងព្រេងខ្មែរ ដែលតំណាងឱ្យបញ្ញាឈ្លាសវៃ និងការគិតដោះស្រាយបញ្ហា។' },
  { term: 'កុសល', meaning: 'អំពើល្អ ឬបុណ្យដែលនាំមកនូវសេចក្តីស្ងប់ និងសេចក្តីសុខ។' },
  { term: 'សីលធម៌', meaning: 'ចរិយាសម្បត្តិល្អ និងការប្រព្រឹត្តត្រូវតាមគន្លងច្បាប់។' },
]

// Ported verbatim (Khmer branch) from OcrPanel.vue's summaryPoints computed.
const buildSummaryPoints = (text) => {
  if (!text) return []
  const txt = text.trim()

  if (txt.includes('ក្រសួងអប់រំ') || txt.includes('សេចក្តីជូនដំណឹង')) {
    return [
      'ក្រសួងអប់រំ យុវជន និងកីឡា បានចេញសេចក្តីជូនដំណឹងស្តីពីបច្ចេកវិទ្យាជំនួយ។',
      'លើកទឹកចិត្តឱ្យគ្រឹះស្ថានសិក្សាពង្រឹងការប្រើឧបករណ៍អានសំឡេង (Screen Reader & OCR)។',
      'គោលបំណងបង្កើនសមភាពក្នុងការទទួលបានចំណេះដឹងសម្រាប់សិស្ស-និស្សិតមានពិការភាពគំហើញ។',
    ]
  }
  if (txt.includes('ឱសថស្ថាន') || txt.includes('វិក័យប័ត្រ')) {
    return [
      'វិក័យប័ត្រចេញដោយឱសថស្ថាន សុខភាពល្អ កាលបរិច្ឆេទ ១៦ កញ្ញា ២០២៦។',
      'ទំនិញ៖ ថ្នាំបន្តក់ភ្នែក ២ ដប ($៦.០០) និងវីតាមីន A ១ ប្រអប់ ($៤.៥០)។',
      'ចំនួនទឹកប្រាក់សរុបទាំងអស់ដែលត្រូវទូទាត់៖ $១០.៥០។',
    ]
  }
  if (txt.includes('ធនញ្ជ័យ')) {
    return [
      'រឿងនិទានប្រជាប្រិយខ្មែរស្តីពីតួអង្គកុមារធនញ្ជ័យ។',
      'ធនញ្ជ័យជាក្មេងឆ្លាតវៃ និងមានប្រាជ្ញាលើសក្មេងដទៃក្នុងភូមិ។',
      'ប្រើប្រាស់ចំណេះដឹង និងប្រាជ្ញាដើម្បីដោះស្រាយបញ្ហាលំបាក និងជួយដល់អ្នកស្លូតត្រង់។',
    ]
  }

  const rawSentences = txt
    .split(/([។៕\.\?!]+|\n+)/)
    .filter((s) => s && s.trim().length > 15)
    .map((s) => s.trim())
  if (rawSentences.length > 0) return rawSentences.slice(0, 3)
  return [txt.slice(0, 140) + '...']
}

export default function OcrTextView() {
  const { colors, fonts, currentTheme } = useTheme()
  const { triggerHaptic, speakAccessibility, addToast } = useApp()
  const { extractedText, isProcessing, selectedFileName, setExtractedText, handleScanAgain } = useOcr()
  const { activeWordIndex, seekToWord, isSpeaking, togglePlayback } = useTts()
  const palette = PALETTE[currentTheme === 'dark' ? 'dark' : 'light']
  // OcrPanel.css `.btn-neobrutal-shadow`: -6px 6px ink shadow (white in dark).
  const neo = { borderColor: palette.ink, shadowColor: palette.ink, offsetX: -6, offsetY: 6 }

  const [isEditing, setIsEditing] = useState(false)
  const [localText, setLocalText] = useState(extractedText)
  const [isCopied, setIsCopied] = useState(false)
  const [fontRem, setFontRem] = useState(1.25)
  const [highlightMode, setHighlightModeState] = useState('word')
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [isVocabOpen, setIsVocabOpen] = useState(false)

  const scrollRef = useRef(null)
  const paragraphRefs = useRef({})

  const styles = createStyles(colors, palette)

  useEffect(() => setLocalText(extractedText), [extractedText])

  const paragraphs = useMemo(() => tokenizeText(localText), [localText])

  // Auto-scroll to the paragraph containing the active word — mirrors the
  // web's `activeEl.scrollIntoView()`. Paragraphs now live inside the same
  // page-level ScrollView as the doc card/action buttons/toolbar (matching
  // the web layout, where only the TTS deck below is pinned outside it), so
  // measureLayout against that shared scroller replaces plain onLayout math.
  useEffect(() => {
    if (activeWordIndex === -1 || isEditing) return
    const para = paragraphs.find((p) => p.sentences.some((s) => s.words.some((w) => w.globalIndex === activeWordIndex)))
    const node = para ? paragraphRefs.current[para.index] : null
    const scrollNode = scrollRef.current
    if (!node || !scrollNode) return
    const handle = findNodeHandle(scrollNode)
    if (!handle) return
    node.measureLayout(
      handle,
      (x, y) => scrollNode.scrollTo({ y: Math.max(0, y - 24), animated: true }),
      () => {}
    )
  }, [activeWordIndex, isEditing, paragraphs])

  const setHighlightMode = useCallback(
    (mode) => {
      setHighlightModeState(mode)
      triggerHaptic('light')
      const names = { word: 'រំលេចពាក្យម្តងមួយៗ (Word Mode)', sentence: 'រំលេចម្តងមួយប្រយោគ (Sentence Mode)', paragraph: 'រំលេចម្តងមួយកថាខណ្ឌ (Paragraph Mode)' }
      speakAccessibility(`ប្តូររបៀបរំលេចអត្ថបទជា ${names[mode] || mode}`)
    },
    [triggerHaptic, speakAccessibility]
  )

  const toggleEditing = useCallback(() => {
    setIsEditing((prev) => {
      const next = !prev
      triggerHaptic('light')
      if (next) {
        speakAccessibility('បានបើកផ្ទាំងកែសម្រួលអត្ថបទ')
      } else {
        setExtractedText(localText)
        speakAccessibility('បានរក្សាទុកការកែសម្រួល និងត្រឡប់មកផ្ទាំងអាន')
      }
      return next
    })
  }, [triggerHaptic, speakAccessibility, setExtractedText, localText])

  const adjustZoom = useCallback(
    (delta) => {
      setFontRem((prev) => {
        let next = Math.round((prev + delta) * 100) / 100
        if (next < 1.0) next = 1.0
        if (next > 2.4) next = 2.4
        triggerHaptic('light')
        speakAccessibility(`ទំហំអក្សរក្នុងផ្ទាំងអាន ${Math.round((next * 100) / 1.25)} ភាគរយ`)
        return next
      })
    },
    [triggerHaptic, speakAccessibility]
  )

  const copyToClipboard = useCallback(async () => {
    if (!localText) return
    await Clipboard.setStringAsync(localText)
    setIsCopied(true)
    triggerHaptic('success')
    speakAccessibility('បានចម្លងអត្ថបទទាំងអស់ទៅកាន់ Clipboard ជោគជ័យ')
    addToast('បានចម្លងអត្ថបទទៅកាន់ Clipboard', 'success')
    setTimeout(() => setIsCopied(false), 2000)
  }, [localText, triggerHaptic, speakAccessibility, addToast])

  const downloadTxt = useCallback(async () => {
    if (!localText) return
    const baseName = selectedFileName ? selectedFileName.replace(/\.[^/.]+$/, '') : 'document'
    const fileName = `${baseName}_songkhem.txt`
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`
    await FileSystem.writeAsStringAsync(fileUri, localText, { encoding: FileSystem.EncodingType.UTF8 })
    triggerHaptic('light')
    speakAccessibility(`បានទាញយកឯកសារ ${fileName} រួចរាល់`)
    addToast(`បានទាញយក ${fileName}`, 'info')
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: fileName })
    }
  }, [localText, selectedFileName, triggerHaptic, speakAccessibility, addToast])

  const charCount = localText ? localText.length : 0
  const wc = wordCount(localText)
  const estimatedPages = Math.max(1, Math.ceil(wc / 250))

  const displayTitle = selectedFileName ? selectedFileName.replace(/\.[^/.]+$/, '') : 'ឯកសារស្កេន'

  const detectedCategory = useMemo(() => {
    const txt = (localText || '').toLowerCase()
    if (txt.includes('វិក័យប័ត្រ') || txt.includes('receipt') || txt.includes('$') || txt.includes('statement')) return 'វិក្កយបត្រ (Statement)'
    if (txt.includes('សេចក្តីជូនដំណឹង') || txt.includes('ក្រសួង') || txt.includes('notice')) return 'ឯកសាររដ្ឋបាល (Notice)'
    if (txt.includes('កំណាព្យ') || txt.includes('poem')) return 'កំណាព្យ (Poem)'
    if (txt.includes('រឿង') || txt.includes('story')) return 'រឿងនិទាន (Story)'
    return 'ឯកសារទូទៅ'
  }, [localText])

  const detectedLangName = useMemo(() => (/[ក-៿]/.test(localText || '') ? 'Khmer (ខ្មែរ)' : 'English (US)'), [localText])

  const formattedScanDate = useMemo(
    () => new Date().toLocaleDateString('km-KH', { month: 'short', day: 'numeric', year: 'numeric' }),
    []
  )

  const summaryPoints = useMemo(() => buildSummaryPoints(localText), [localText])

  const detectedVocabList = useMemo(() => {
    if (!localText) return []
    const matched = VOCABULARY_DB.filter((v) => localText.includes(v.term))
    if (matched.length > 0) return matched.map((v) => ({ word: v.term, meaning: v.meaning }))
    const tokens = localText.split(/[\s,។៕\.\?!]+/).filter((w) => w.length >= 4)
    const unique = Array.from(new Set(tokens)).slice(0, 3)
    return unique.map((w) => ({ word: w, meaning: `ពាក្យគន្លឹះក្នុងឯកសារនេះ៖ "${w}"` }))
  }, [localText])

  const toggleSummary = useCallback(() => {
    setIsSummaryOpen((prev) => {
      const next = !prev
      if (next) {
        setIsVocabOpen(false)
        speakAccessibility('បានបើកផ្ទាំងសង្ខេបឯកសារ')
      }
      return next
    })
  }, [speakAccessibility])

  const toggleVocab = useCallback(() => {
    setIsVocabOpen((prev) => {
      const next = !prev
      if (next) {
        setIsSummaryOpen(false)
        speakAccessibility('បានបើកផ្ទាំងពន្យល់វាក្យសព្ទ')
      }
      return next
    })
  }, [speakAccessibility])

  const speakSummaryAloud = useCallback(() => {
    triggerHaptic('light')
    speakAccessibility(summaryPoints.join('. '))
  }, [triggerHaptic, speakAccessibility, summaryPoints])

  const speakVocabItem = useCallback(
    (item) => {
      triggerHaptic('light')
      speakAccessibility(`${item.word}៖ ${item.meaning}`)
    },
    [triggerHaptic, speakAccessibility]
  )

  // --- Empty state (no doc yet): mirrors OcrPanel.vue's STATE A — a tinted
  // dropzone-style panel with Scan / Upload buttons (samples live on the Upload tab) ---
  if (!isProcessing && !localText) {
    const s = colors.surfaces
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
        <View style={[styles.emptyDropzone, { backgroundColor: s.bg }]}>
          <View style={[styles.emptyIconCircle, { backgroundColor: s.surface2 }]}>
            <BookOpen size={32} color={s.primary} />
          </View>
          <Text style={[styles.emptyHeading, { fontFamily: fonts.khmer, color: s.onSurface }]}>មិនទាន់មានឯកសារសម្រាប់អានទេ</Text>
          <Text style={[styles.emptySubtext, { fontFamily: fonts.khmer, color: s.onSurfaceMuted }]}>
            សូមថតរូបឯកសារ ឬផ្ទុកឡើងឯកសារដើម្បីចាប់ផ្តើមអានជាសំឡេង។
          </Text>
          <View style={styles.emptyActions}>
            <NeoButton {...neo} bg={currentTheme === 'dark' ? '#3B82F6' : '#2563EB'} contentStyle={styles.emptyBtn} accessibilityLabel="ថតរូបស្កេន" onPress={navigateToCamera}>
              <Camera size={20} color={currentTheme === 'dark' ? '#0F172A' : '#FFFFFF'} />
              <Text style={[styles.emptyBtnText, { fontFamily: fonts.khmer, color: currentTheme === 'dark' ? '#0F172A' : '#FFFFFF' }]}>ថតរូបស្កេន</Text>
            </NeoButton>
            <NeoButton {...neo} bg={palette.cardBg} contentStyle={styles.emptyBtn} accessibilityLabel="ផ្ទុកឡើងឯកសារ" onPress={navigateToUpload}>
              <Upload size={20} color={palette.text} />
              <Text style={[styles.emptyBtnText, { fontFamily: fonts.khmer, color: palette.text }]}>ផ្ទុកឡើងឯកសារ</Text>
            </NeoButton>
          </View>
          <Text style={[styles.emptyHelper, { fontFamily: fonts.khmer, color: s.onSurfaceMuted }]}>ឯកសារអក្សរខ្មែរ និងអង់គ្លេសគ្រប់ប្រភេទ</Text>
        </View>
      </ScrollView>
    )
  }

  if (isProcessing) {
    return (
      <View style={[styles.page, styles.skeleton]}>
        <Text style={[styles.skeletonStatus, { fontFamily: fonts.khmer }]}>កំពុងស្កេន និងស្រង់អត្ថបទខ្មែរ...</Text>
        <View style={[styles.shimmerBar, { width: '45%', height: 24 }]} />
        <View style={[styles.shimmerBar, { width: '95%' }]} />
        <View style={[styles.shimmerBar, { width: '75%' }]} />
        <View style={[styles.shimmerBar, { width: '55%' }]} />
      </View>
    )
  }

  // --- Loaded state: mirrors OcrPanel.vue's STATE B (reader-doc-view) ---
  return (
    <ScrollView ref={scrollRef} style={styles.page} contentContainerStyle={styles.pageContent}>
      {/* Row 1: Back to Documents link */}
      <AccessiblePressable style={styles.backLink} accessibilityLabel="ត្រឡប់ទៅឯកសារ (Back to documents)" onPress={handleScanAgain} speakOnPress={false}>
        <ArrowLeft size={18} color={palette.accent} />
        <Text style={[styles.backLinkText, { fontFamily: fonts.khmer, color: palette.accent }]}>ត្រឡប់ទៅឯកសារ</Text>
      </AccessiblePressable>

      {/* Row 2: Document Header Card */}
      <View style={styles.docCard}>
        <View style={styles.badgeRow}>
          <View style={styles.pillCategory}>
            <Text style={[styles.pillCategoryText, { fontFamily: fonts.khmer }]}>{detectedCategory}</Text>
          </View>
          <View style={styles.pillQuality}>
            <CheckCircle2 size={14} color="#059669" />
            <Text style={[styles.pillQualityText, { fontFamily: fonts.khmer }]}>OCR ល្អ</Text>
          </View>
        </View>
        <Text style={[styles.docHeroTitle, { fontFamily: fonts.khmer, color: palette.accent }]}>{displayTitle}</Text>
        <Text style={[styles.docMetaLine, { fontFamily: fonts.khmer, color: palette.muted }]}>
          {estimatedPages} ទំព័រ · {wc} ពាក្យ · {detectedLangName} · {formattedScanDate}
        </Text>
      </View>

      {/* Row 3: Action Buttons Stack */}
      <View style={styles.actionsStack}>
        <NeoButton
          {...neo}
          bg={isSpeaking ? '#D97706' : '#2563EB'}
          contentStyle={styles.heroBtn}
          accessibilityLabel={isSpeaking ? 'ផ្អាកការអាន (Pause)' : 'អានជាសំឡេង (Listen to document)'}
          onPress={togglePlayback}
          speakOnPress={false}
        >
          {isSpeaking ? <Pause size={24} color="#FFFFFF" fill="#FFFFFF" /> : <Volume2 size={24} color="#FFFFFF" />}
          <Text style={[styles.heroBtnText, { fontFamily: fonts.khmer }]}>{isSpeaking ? 'ផ្អាកការអាន' : 'អានជាសំឡេង'}</Text>
        </NeoButton>

        <NeoButton {...neo} bg={palette.secondaryBg} contentStyle={styles.stackBtn} accessibilityLabel="ចម្លងអត្ថបទ (Copy Text)" onPress={copyToClipboard} speakOnPress={false}>
          {isCopied ? <Check size={18} color={palette.secondaryText} /> : <Copy size={18} color={palette.secondaryText} />}
          <Text style={[styles.stackBtnText, { fontFamily: fonts.khmer, color: palette.secondaryText }]}>{isCopied ? 'បានចម្លង' : 'ចម្លង'}</Text>
        </NeoButton>

        <NeoButton {...neo} bg={palette.secondaryBg} contentStyle={styles.stackBtn} accessibilityLabel="ទាញយក ឬ ចែករំលែក (Download or Share)" onPress={downloadTxt} speakOnPress={false}>
          <Download size={18} color={palette.secondaryText} />
          <Text style={[styles.stackBtnText, { fontFamily: fonts.khmer, color: palette.secondaryText }]}>ទាញយក ឬ ចែករំលែក</Text>
        </NeoButton>

        <NeoButton
          {...neo}
          bg={palette.cardBg}
          contentStyle={styles.featureBtn}
          accessibilityLabel="សង្ខេបឯកសារ (Summarize Document)"
          onPress={toggleSummary}
          speakOnPress={false}
        >
          <Sparkles size={20} color={palette.accent} />
          <Text style={[styles.featureBtnLabel, { fontFamily: fonts.khmer, color: palette.text }]}>សង្ខេបឯកសារ</Text>
          <View style={styles.featureBadge}>
            <Text style={styles.featureBadgeText}>{summaryPoints.length}</Text>
          </View>
        </NeoButton>

        <NeoButton
          {...neo}
          bg={palette.cardBg}
          contentStyle={styles.featureBtn}
          accessibilityLabel="ពន្យល់ពាក្យ វាក្យសព្ទ (Explain Vocabulary)"
          onPress={toggleVocab}
          speakOnPress={false}
        >
          <BookOpen size={20} color={palette.accent} />
          <Text style={[styles.featureBtnLabel, { fontFamily: fonts.khmer, color: palette.text }]}>ពន្យល់ពាក្យ (វាក្យសព្ទ)</Text>
          <View style={styles.featureBadge}>
            <Text style={styles.featureBadgeText}>{detectedVocabList.length}</Text>
          </View>
        </NeoButton>
      </View>

      {/* Summary Drawer */}
      {isSummaryOpen && (
        <View style={styles.drawerCard}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerTitleCol}>
              <Sparkles size={20} color={palette.accent} />
              <Text style={[styles.drawerTitle, { fontFamily: fonts.khmer, color: palette.text }]}>សង្ខេបខ្លឹមសារសំខាន់ៗ</Text>
            </View>
            <AccessiblePressable style={styles.drawerCloseBtn} accessibilityLabel="បិទ (Close)" onPress={() => setIsSummaryOpen(false)}>
              <X size={18} color={palette.text} />
            </AccessiblePressable>
          </View>
          {summaryPoints.map((point, idx) => (
            <View key={idx} style={styles.summaryBulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: palette.accent }]} />
              <Text style={[styles.summaryBulletText, { fontFamily: fonts.khmer, color: palette.text }]}>{point}</Text>
            </View>
          ))}
          <AccessiblePressable style={styles.drawerActionBtn} accessibilityLabel="ស្តាប់សង្ខេបជាសំឡេង" onPress={speakSummaryAloud}>
            <Volume2 size={18} color="#FFFFFF" />
            <Text style={[styles.drawerActionText, { fontFamily: fonts.khmer }]}>ស្តាប់សង្ខេបជាសំឡេង</Text>
          </AccessiblePressable>
        </View>
      )}

      {/* Vocabulary Drawer */}
      {isVocabOpen && (
        <View style={styles.drawerCard}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerTitleCol}>
              <BookOpen size={20} color={palette.accent} />
              <Text style={[styles.drawerTitle, { fontFamily: fonts.khmer, color: palette.text }]}>វាក្យសព្ទ និងការពន្យល់ពាក្យ</Text>
            </View>
            <AccessiblePressable style={styles.drawerCloseBtn} accessibilityLabel="បិទ (Close)" onPress={() => setIsVocabOpen(false)}>
              <X size={18} color={palette.text} />
            </AccessiblePressable>
          </View>
          {detectedVocabList.map((item, idx) => (
            <View key={idx} style={styles.vocabCard}>
              <View style={styles.vocabTermRow}>
                <Text style={[styles.vocabTermWord, { fontFamily: fonts.khmer, color: palette.text }]}>{item.word}</Text>
                <AccessiblePressable style={styles.vocabSpeakBtn} accessibilityLabel={`ស្តាប់ពាក្យ ${item.word}`} onPress={() => speakVocabItem(item)}>
                  <Volume2 size={16} color={palette.text} />
                </AccessiblePressable>
              </View>
              <Text style={[styles.vocabMeaning, { fontFamily: fonts.khmer, color: palette.muted }]}>{item.meaning}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Row 6: Reading Content Card */}
      <View style={styles.readingCard}>
        <View style={styles.contentCardHeader}>
          <View style={styles.pageIndicator}>
            <FileText size={20} color={palette.accent} />
            <Text style={[styles.pageIndicatorText, { fontFamily: fonts.khmer, color: palette.text }]}>ទំព័រ 1 នៃ {estimatedPages}</Text>
          </View>
          <View style={styles.headerToolsCluster}>
            <View style={styles.wordCounterBadge}>
              <Text style={[styles.wordCounterText, { fontFamily: fonts.khmer, color: palette.muted }]}>{wc} ពាក្យ</Text>
            </View>
            <AccessiblePressable
              style={[styles.editBtn, isEditing && styles.editBtnActive]}
              accessibilityLabel={isEditing ? 'រួចរាល់ (Done)' : 'កែសម្រួល (Edit Text)'}
              onPress={toggleEditing}
            >
              {isEditing ? <Check size={16} color="#FFFFFF" /> : <Edit3 size={16} color={palette.text} />}
              <Text style={[styles.editBtnText, isEditing && { color: '#FFFFFF' }, { fontFamily: fonts.khmer, color: palette.text }]}>
                {isEditing ? 'រួចរាល់' : 'កែសម្រួល'}
              </Text>
            </AccessiblePressable>
          </View>
        </View>

        {!isEditing && (
          <View style={styles.toolbarRow}>
            <View style={styles.zoomGroup}>
              <AccessiblePressable style={styles.stepperBtn} disabled={fontRem <= 1.0} accessibilityLabel="បន្ថយទំហំអក្សរ A-" onPress={() => adjustZoom(-0.15)}>
                <ZoomOut size={16} color={palette.text} />
              </AccessiblePressable>
              <Text style={[styles.stepperText, { color: palette.text }]}>{Math.round((fontRem * 100) / 1.25)}%</Text>
              <AccessiblePressable style={styles.stepperBtn} disabled={fontRem >= 2.4} accessibilityLabel="បង្កើនទំហំអក្សរ A+" onPress={() => adjustZoom(0.15)}>
                <ZoomIn size={16} color={palette.text} />
              </AccessiblePressable>
            </View>

            <View style={styles.highlightGroup}>
              {HIGHLIGHT_MODES.map((m) => (
                <AccessiblePressable
                  key={m.key}
                  style={[styles.modePill, highlightMode === m.key && styles.modePillActive]}
                  accessibilityLabel={m.label}
                  onPress={() => setHighlightMode(m.key)}
                >
                  <Text style={[styles.modePillText, highlightMode === m.key && { color: '#FFFFFF' }, { fontFamily: fonts.khmer }]}>{m.label}</Text>
                </AccessiblePressable>
              ))}
            </View>
          </View>
        )}

        {isEditing ? (
          <TextInput
            style={[styles.editingTextarea, { fontSize: fontRem * 18, fontFamily: fonts.khmer, color: palette.text, borderColor: palette.accent }]}
            value={localText}
            onChangeText={setLocalText}
            multiline
            placeholder="កែសម្រួលអត្ថបទខ្មែរនៅទីនេះ..."
            placeholderTextColor={palette.muted}
          />
        ) : (
          <View>
            {paragraphs.map((para) => {
              const isParaActive = highlightMode === 'paragraph' && para.sentences.some((s) => s.words.some((w) => w.globalIndex === activeWordIndex))
              return (
                <View
                  key={para.index}
                  ref={(el) => {
                    paragraphRefs.current[para.index] = el
                  }}
                  style={[styles.paragraph, isParaActive && styles.paragraphActive]}
                >
                  <Text style={[styles.paragraphText, { fontFamily: fonts.khmer, color: palette.text, fontSize: fontRem * 18, lineHeight: fontRem * 18 * 1.85 }]}>
                    {para.sentences.map((sentence) => {
                      const isSentenceActive =
                        (highlightMode === 'sentence' || highlightMode === 'word') && sentence.words.some((w) => w.globalIndex === activeWordIndex)
                      return sentence.words.map((word) => {
                        const isActive = word.globalIndex === activeWordIndex
                        return (
                          <Text
                            key={word.globalIndex}
                            onPress={() => {
                              triggerHaptic('light')
                              seekToWord(word.globalIndex)
                            }}
                            style={[
                              (highlightMode === 'sentence' || highlightMode === 'word') && isSentenceActive && styles.sentenceActive,
                              highlightMode === 'word' && isActive && styles.tokenActive,
                            ]}
                          >
                            {word.text}{' '}
                          </Text>
                        )
                      })
                    })}
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </View>

      <TtsControls />
    </ScrollView>
  )
}

const createStyles = (colors, palette) =>
  StyleSheet.create({
    // Workspace gutter (20) + `.reader-layout-grid` padding (12/18/80) and gap.
    page: { flex: 1, backgroundColor: colors.surfaces.bg },
    pageContent: { paddingTop: 32, paddingHorizontal: 38, paddingBottom: 60, gap: 18 },
    backLink: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 4 },
    backLinkText: { fontSize: 18, fontWeight: '800' },
    docCard: {
      gap: 12,
      padding: 24,
      backgroundColor: palette.cardBg,
      borderWidth: 1.5,
      borderColor: palette.cardBorder,
      borderRadius: 4,
    },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    pillCategory: { paddingVertical: 4, paddingHorizontal: 12, backgroundColor: '#0F172A', borderRadius: 4 },
    pillCategoryText: { fontSize: 15, fontWeight: '800', color: '#F8FAFC' },
    pillQuality: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 4,
      paddingHorizontal: 12,
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.3)',
      borderRadius: 4,
    },
    pillQualityText: { fontSize: 15, fontWeight: '800', color: '#059669' },
    docHeroTitle: { fontSize: 33, fontWeight: '800', lineHeight: 44 },
    docMetaLine: { fontSize: 17, fontWeight: '600', lineHeight: 28 },
    actionsStack: { gap: 14, paddingLeft: 6 },
    heroBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 56, paddingVertical: 14, paddingHorizontal: 24 },
    heroBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 21 },
    stackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, paddingVertical: 10, paddingHorizontal: 18 },
    stackBtnText: { fontWeight: '800', fontSize: 18 },
    featureBtn: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 12, paddingHorizontal: 20 },
    featureBtnLabel: { flex: 1, textAlign: 'left', marginLeft: 12, fontSize: 19, fontWeight: '800' },
    featureBadge: { minWidth: 26, height: 26, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', borderRadius: 4 },
    featureBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
    drawerCard: {
      padding: 16,
      gap: 10,
      backgroundColor: colors.accentSubtle,
      borderWidth: 1.5,
      borderColor: colors.borderMedium,
      borderRadius: 4,
    },
    drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    drawerTitleCol: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    drawerTitle: { fontSize: 19, fontWeight: '800', flexShrink: 1 },
    drawerCloseBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.bgSurface },
    summaryBulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
    summaryBulletText: { flex: 1, fontSize: 17, lineHeight: 27 },
    drawerActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 46,
      backgroundColor: '#2563EB',
      borderRadius: 4,
      marginTop: 4,
    },
    drawerActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 17 },
    vocabCard: { padding: 12, gap: 4, backgroundColor: colors.bgSurface, borderWidth: 1.5, borderColor: colors.borderSubtle, borderRadius: 4 },
    vocabTermRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    vocabTermWord: { fontSize: 18, fontWeight: '800' },
    vocabSpeakBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.bgSurfaceElevated },
    vocabMeaning: { fontSize: 16, lineHeight: 25 },
    readingCard: {
      gap: 18,
      padding: 24,
      backgroundColor: palette.cardBg,
      borderWidth: 1.5,
      borderColor: palette.cardBorder,
      borderRadius: 4,
    },
    contentCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: palette.cardBorder,
      flexWrap: 'wrap',
      gap: 10,
    },
    pageIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pageIndicatorText: { fontSize: 19, fontWeight: '800' },
    headerToolsCluster: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    wordCounterBadge: { paddingVertical: 4, paddingHorizontal: 12, backgroundColor: palette.toolbarBg, borderWidth: 1, borderColor: palette.cardBorder, borderRadius: 4 },
    wordCounterText: { fontSize: 16, fontWeight: '700' },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 38,
      paddingHorizontal: 14,
      backgroundColor: palette.cardBg,
      borderWidth: 1,
      borderColor: palette.controlBorder,
      borderRadius: 4,
    },
    editBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    editBtnText: { fontSize: 16, fontWeight: '700' },
    toolbarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 10,
      backgroundColor: palette.toolbarBg,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      borderRadius: 4,
      flexWrap: 'wrap',
      gap: 10,
    },
    zoomGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    stepperBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.cardBg, borderWidth: 1, borderColor: palette.controlBorder, borderRadius: 4 },
    stepperText: { fontSize: 17, fontWeight: '800', minWidth: 44, textAlign: 'center' },
    highlightGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    modePill: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: palette.cardBg, borderWidth: 1, borderColor: palette.controlBorder, borderRadius: 4 },
    modePillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    modePillText: { fontSize: 16, fontWeight: '700', color: palette.muted },
    skeleton: { padding: 20, gap: 14 },
    skeletonStatus: { fontSize: 14, fontWeight: '700', color: colors.accent, marginBottom: 4 },
    shimmerBar: { height: 16, borderRadius: 6, backgroundColor: colors.bgSurfaceElevated },
    // OcrPanel.css STATE A (`.tactile-dropzone`, `.dropzone-*`, `.samples-*`).
    emptyDropzone: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 24, paddingHorizontal: 16, borderRadius: 4 },
    emptyIconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    emptyHeading: { fontSize: 22.5, fontWeight: '800', textAlign: 'center', lineHeight: 34 },
    emptySubtext: { fontSize: 17, textAlign: 'center', lineHeight: 26, maxWidth: 460 },
    emptyActions: { alignItems: 'center', gap: 14, marginTop: 6, paddingLeft: 6 },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 52, paddingVertical: 12, paddingHorizontal: 26 },
    emptyBtnText: { fontSize: 19, fontWeight: '800' },
    emptyHelper: { fontSize: 16, fontWeight: '500', marginTop: 6, textAlign: 'center' },
    editingTextarea: {
      minHeight: 300,
      padding: 16,
      backgroundColor: palette.toolbarBg,
      borderWidth: 2,
      borderRadius: 4,
      textAlignVertical: 'top',
      lineHeight: 28,
    },
    paragraph: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 4, marginBottom: 8 },
    paragraphActive: { backgroundColor: colors.accentSubtle, borderLeftWidth: 4, borderLeftColor: '#2563EB' },
    paragraphText: {},
    sentenceActive: { backgroundColor: colors.accentSubtle },
    tokenActive: { backgroundColor: '#2563EB', color: '#FFFFFF', fontWeight: '800' },
  })
