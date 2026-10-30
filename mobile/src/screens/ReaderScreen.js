import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ArrowLeft, BookOpen, Camera, Check, Copy, MoreHorizontal, Pause, Play, Settings, SkipBack, SkipForward, Upload, Volume2, X } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useApp } from '../context/AppContext'
import { useOcr } from '../context/OcrContext'
import { useTts } from '../context/TtsContext'
import { tokenizeText } from '../utils/textTokenizer'
import { buildSummaryPoints } from '../utils/summary'
import AccessiblePressable from '../components/AccessiblePressable'
import { useTourTarget } from '../context/TourContext'
import useScreenIntro from '../utils/useScreenIntro'
import { TP } from '../services/talkPhrases'

// The website's reader FAB icon (src/assets/signalIcon.svg)
const SIGNAL_ICON = `<svg width="41" height="51" viewBox="0 0 41 51" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M20.4892 48.7796C22.9181 48.7311 25.3137 48.2046 27.5393 47.2302C29.7648 46.2559 31.7766 44.8527 33.4598 43.1008C35.143 41.349 36.4647 39.2827 37.3494 37.0201C38.2341 34.7575 38.6645 32.3427 38.6159 29.9137L38.4105 19.6298C38.3199 15.0859 36.56 10.7344 33.4663 7.40511M1.49989 24.475L1.62331 30.6528C1.69482 34.294 2.83943 37.833 4.91371 40.8265C6.98798 43.8199 9.89964 46.1345 13.2838 47.4802M28.8423 3.79675C24.5451 1.42897 19.4833 0.865176 14.7704 2.22939C10.0575 3.5936 6.07957 6.77407 3.7116 11.0712C2.73584 12.8354 2.06117 14.75 1.71536 16.7362" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke="white"/>
<path d="M17.8357 12.2692C19.1906 11.9595 20.5978 11.9579 21.9534 12.2646C23.309 12.5712 24.5786 13.1781 25.6684 14.0407C26.7582 14.9033 27.6405 15.9995 28.2503 17.2484C28.86 18.4974 29.1817 19.8673 29.1915 21.2571L29.3105 27.213M27.0981 35.0287C25.8675 36.4559 24.2303 37.4731 22.4057 37.9443C20.581 38.4155 18.656 38.3181 16.8882 37.6652C15.1204 37.0123 13.5942 35.835 12.5139 34.291C11.4335 32.7469 10.8506 30.9097 10.843 29.0252L10.6952 21.6267C10.6596 20.356 10.8863 19.0917 11.3611 17.9126M19.9515 21.8488L20.0749 28.0266" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke="white"/>
</svg>`

// Short voice names for the player's voice tag (DocumentReader.vue's spotify-voice-tag)
const shortVoiceName = (name = '') =>
  name.includes('Sreymom') ? 'ស្រីមុំ' : name.includes('Piseth') ? 'ពិសិដ្ឋ' : name.includes('Sokha') ? 'សុខា' : 'សុភាព'

// Same estimate as the website's reader: ~2.5 words a second at 1x
const formatTime = (secs) => {
  const m = Math.floor(secs / 60)
  const sec = Math.floor(secs % 60)
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}
const HIGHLIGHT = '#FEF08A'

// What the reading highlight covers, same three choices as the website's reader
const HIGHLIGHT_MODES = [
  { id: 'word', label: 'ពាក្យ' },
  { id: 'sentence', label: 'ប្រយោគ' },
  { id: 'paragraph', label: 'កថាខណ្ឌ' },
]
const DEFAULT_HIGHLIGHT_MODE = 'paragraph'
const HIGHLIGHT_STORAGE_KEY = 'songkhem_highlight_mode'
// Long enough that a tap never opens the fingerprint menu by accident (Android's standard long press)
const HOLD_TO_OPEN_MS = 500
// How far outside an option the finger can be and still count as on it, so a slightly crooked slide still lands
const DRAG_SLOP = 16
// The fingerprint menu, top to bottom (the finger slides up from the button through them)
const PILL_OPTIONS = [
  { id: 'summary', label: 'សង្ខេបខ្លឹមសារ', short: 'សង្ខេប' },
  { id: 'copy', label: 'ចម្លងអត្ថបទ', short: 'ចម្លង' },
]

// Paragraph and sentence the spoken word belongs to (-1 when nothing is being read)
function locateWord(paragraphs, wordIndex) {
  for (const para of paragraphs) {
    for (const sn of para.sentences) {
      if (sn.words.some((w) => w.globalIndex === wordIndex)) return { paragraph: para.index, sentence: sn.index }
    }
  }
  return { paragraph: -1, sentence: -1 }
}

// The web app's reader mode (DocumentReader.vue): top bar, the text with a
// karaoke highlight, a floating actions button, and a bottom player bar with
// rewind / play / forward / voice. No global header or tab bar here.
export default function ReaderScreen({ navigation }) {
  const { colors, fonts, currentTheme, fontScale, lineSpacing, isBoldText } = useTheme()
  const { triggerHaptic, speakAccessibility, announce, addToast, openSettings, isAutoReadEnabled } = useApp()
  const { extractedText } = useOcr()
  const { isSpeaking, activeWordIndex, togglePlayback, stopSpeech, jumpWords, seekToWord, voices, selectedVoiceName, selectVoice, speedPresets, rate, setSpeedPreset, audioDuration } = useTts()
  const insets = useSafeAreaInsets()
  const s = colors.surfaces
  const styles = useMemo(() => createStyles(s, currentTheme, insets), [s, currentTheme, insets])

  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [isVoiceOpen, setIsVoiceOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [highlightMode, setHighlightMode] = useState(DEFAULT_HIGHLIGHT_MODE)

  const scrollRef = useRef(null)
  const textTourRef = useTourTarget('reader-text')
  const controlsTourRef = useTourTarget('reader-controls')
  const voiceTourRef = useTourTarget('reader-voice')
  const fabTourRef = useTourTarget('reader-fab')
  const paragraphY = useRef({})

  useEffect(() => {
    AsyncStorage.getItem(HIGHLIGHT_STORAGE_KEY)
      .then((saved) => {
        if (HIGHLIGHT_MODES.some((m) => m.id === saved)) setHighlightMode(saved)
      })
      .catch(() => {})
  }, [])

  const chooseHighlightMode = (id) => {
    setHighlightMode(id)
    AsyncStorage.setItem(HIGHLIGHT_STORAGE_KEY, id).catch(() => {})
  }

  const paragraphs = useMemo(() => tokenizeText(extractedText), [extractedText])
  const totalWords = useMemo(
    () => paragraphs.reduce((max, p) => p.sentences.reduce((m, sn) => sn.words.reduce((mm, w) => Math.max(mm, w.globalIndex + 1), m), max), 0),
    [paragraphs]
  )

  // Progress bar (the website's Spotify-style scrubber): follows the word being read, and can be dragged or tapped
  const [dragRatio, setDragRatio] = useState(null)
  // The floating button sits just above the player bar, whatever height the bar ends up
  const [playerBarH, setPlayerBarH] = useState(0)
  const trackRef = useRef(null)
  const trackBox = useRef({ x: 0, w: 1 })
  const measureTrack = () => trackRef.current?.measureInWindow((x, y, w) => (trackBox.current = { x, w: Math.max(1, w) }))
  const wordAtRatio = (ratio) => Math.round(Math.min(1, Math.max(0, ratio)) * Math.max(0, totalWords - 1))
  const scrubLatest = useRef(null)
  scrubLatest.current = { totalWords, seekToWord, triggerHaptic }
  const scrubber = useMemo(() => {
    const ratioAt = (pageX) => Math.min(1, Math.max(0, (pageX - trackBox.current.x) / trackBox.current.w))
    return PanResponder.create({
      onStartShouldSetPanResponder: () => scrubLatest.current.totalWords > 0,
      onMoveShouldSetPanResponder: () => scrubLatest.current.totalWords > 0,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        measureTrack()
        setDragRatio(ratioAt(e.nativeEvent.pageX))
      },
      onPanResponderMove: (e) => setDragRatio(ratioAt(e.nativeEvent.pageX)),
      onPanResponderRelease: (e) => {
        const { totalWords: n, seekToWord: seek, triggerHaptic: haptic } = scrubLatest.current
        setDragRatio(null)
        haptic('light')
        seek(Math.round(ratioAt(e.nativeEvent.pageX) * Math.max(0, n - 1)))
      },
      onPanResponderTerminate: () => setDragRatio(null),
    })
  }, [])

  const currentWordPos = Math.max(0, activeWordIndex)
  const progressRatio = dragRatio ?? (totalWords > 1 ? Math.min(1, currentWordPos / (totalWords - 1)) : 0)
  // The real audio length once the player knows it; before that an estimate from the letters (Khmer barely uses
  // spaces, so counting words made a page look a few seconds long). The voice says about 11 characters a second.
  const spokenChars = useMemo(() => (extractedText || '').replace(/\s+/g, '').length, [extractedText])
  const secsAt1x = audioDuration > 0 ? audioDuration : spokenChars / 11
  const totalSecs = totalWords ? Math.max(1, Math.round(secsAt1x / (rate || 1))) : 0
  const elapsedSecs = Math.min(totalSecs, Math.round(progressRatio * totalSecs))
  const remainingSecs = Math.max(0, totalSecs - elapsedSecs)
  const activeLoc = useMemo(() => locateWord(paragraphs, activeWordIndex), [paragraphs, activeWordIndex])
  const isWordLit = (w) =>
    highlightMode === 'word'
      ? w.globalIndex === activeWordIndex
      : highlightMode === 'sentence'
        ? w.sentenceIndex === activeLoc.sentence
        : w.paragraphIndex === activeLoc.paragraph
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

  // The fingerprint button opens its menu on press-and-hold (as on the website); a plain tap only explains that.
  // Like Telegram's hold-to-record: keep the finger down after the menu opens, slide it onto an option (it lights
  // up, buzzes and says its name) and let go there to choose it. Letting go anywhere else leaves the menu open.
  const [dragTarget, setDragTarget] = useState(null)
  const isDragging = useRef(false)
  const dragTargetRef = useRef(null)
  const pillRefs = useRef({})
  const pillBoxes = useRef({})
  const measurePill = (id) =>
    pillRefs.current[id]?.measureInWindow((x, y, w, h) => (pillBoxes.current[id] = { x, y, w, h }))

  const openActions = () => {
    setIsActionsOpen(true)
    isDragging.current = true
    triggerHaptic('medium')
    announce('អូសម្រាមដៃឡើងទៅ សង្ខេប ឬចម្លង រួចលែងដៃ')
  }
  const pillAt = (x, y) =>
    PILL_OPTIONS.find(({ id }) => {
      const b = pillBoxes.current[id]
      return b && x >= b.x - DRAG_SLOP && x <= b.x + b.w + DRAG_SLOP && y >= b.y - DRAG_SLOP && y <= b.y + b.h + DRAG_SLOP
    })?.id ?? null
  const handleFabDrag = (e) => {
    if (!isDragging.current) return
    const id = pillAt(e.nativeEvent.pageX, e.nativeEvent.pageY)
    if (id === dragTargetRef.current) return
    dragTargetRef.current = id
    setDragTarget(id)
    if (id) {
      triggerHaptic('selection')
      announce(PILL_OPTIONS.find((p) => p.id === id).label)
    }
  }
  const handleFabRelease = () => {
    if (!isDragging.current) return
    isDragging.current = false
    const id = dragTargetRef.current
    dragTargetRef.current = null
    setDragTarget(null)
    if (id === 'summary') openSummary()
    else if (id === 'copy') handleCopy()
  }
  const handleFabTap = () => {
    if (isActionsOpen) {
      setIsActionsOpen(false)
      return
    }
    announce('សង្កត់ប៊ូតុងឱ្យជាប់ ដើម្បីបើកមុខងារសង្ខេប និងចម្លង')
  }

  const openSummary = () => {
    setIsActionsOpen(false)
    setIsSummaryOpen(true)
    triggerHaptic('medium')
    announce('បានបើកផ្ទាំងសង្ខេបខ្លឹមសារសំខាន់ៗ')
  }

  const fontSize = 18 * fontScale

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
              ref={para.index === 0 ? textTourRef : undefined}
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
                    style={isWordLit(w) ? styles.activeWord : null}
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
        <View
          style={[styles.fabAnchor, playerBarH > 0 && { bottom: playerBarH + 16 }]}
          pointerEvents="box-none"
          onTouchMove={handleFabDrag}
          onTouchEnd={handleFabRelease}
          onTouchCancel={handleFabRelease}
        >
          {isActionsOpen && (
            <View style={styles.pills}>
              {PILL_OPTIONS.map(({ id, label, short }) => {
                const isHot = dragTarget === id
                const Icon = id === 'summary' ? BookOpen : isCopied ? Check : Copy
                return (
                  <AccessiblePressable
                    key={id}
                    ref={(el) => (pillRefs.current[id] = el)}
                    onLayout={() => measurePill(id)}
                    style={[styles.pill, isHot && styles.pillHot]}
                    accessibilityLabel={label}
                    speakOnPress={false}
                    onPress={id === 'summary' ? openSummary : handleCopy}
                  >
                    <Icon size={18} color={isHot ? '#FFFFFF' : s.primary} />
                    <Text style={[styles.pillText, { fontFamily: fonts.khmerBold }, isHot && styles.pillTextHot]}>{short}</Text>
                  </AccessiblePressable>
                )
              })}
            </View>
          )}
          <AccessiblePressable
            ref={fabTourRef}
            style={({ pressed }) => [styles.fab, isActionsOpen && styles.fabActive, pressed && styles.fabHolding]}
            accessibilityLabel="មុខងារបន្ថែម (សង្ខេប និងចម្លង) - សង្កត់ឱ្យជាប់ដើម្បីបើក"
            accessibilityState={{ expanded: isActionsOpen }}
            speakOnPress={false}
            hapticIntensity="light"
            delayLongPress={HOLD_TO_OPEN_MS}
            onLongPress={openActions}
            onPress={handleFabTap}
          >
            <SvgXml xml={SIGNAL_ICON} width={28} height={28} />
          </AccessiblePressable>
        </View>
      )}

      {/* 4. Bottom player bar (DocumentReader.vue's spotify-player-bar) */}
      {hasText && (
        <View style={styles.playerBar} onLayout={(e) => setPlayerBarH(e.nativeEvent.layout.height)}>
          <View style={styles.playerInner}>
            <View style={styles.scrubHeader}>
              <AccessiblePressable
                style={styles.voiceTag}
                accessibilityLabel={`សំឡេង ${shortVoiceName(selectedVoiceName)} (ចុចដើម្បីប្តូរ)`}
                speakOnPress={false}
                onPress={() => setIsVoiceOpen(true)}
              >
                <Volume2 size={15} color={s.onSurfaceMuted} />
                <Text style={[styles.voiceTagText, { fontFamily: fonts.khmerBold }]}>{shortVoiceName(selectedVoiceName)}</Text>
              </AccessiblePressable>
              <AccessiblePressable
                ref={voiceTourRef}
                style={styles.moreBtn}
                accessibilityLabel="ជម្រើសសំឡេង និងល្បឿនអាន"
                speakOnPress={false}
                onPress={() => setIsVoiceOpen(true)}
              >
                <MoreHorizontal size={20} color={s.onSurfaceMuted} />
              </AccessiblePressable>
            </View>

            <View
              ref={trackRef}
              collapsable={false}
              style={styles.trackWrap}
              onLayout={measureTrack}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="វឌ្ឍនភាពការអាន"
              accessibilityValue={{ min: 0, max: 100, now: Math.round(progressRatio * 100) }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(e) => jumpWords(e.nativeEvent.actionName === 'increment' ? 5 : -5)}
              {...scrubber.panHandlers}
            >
              <View style={[styles.track, dragRatio !== null && styles.trackActive]}>
                <View style={[styles.trackFill, { width: `${progressRatio * 100}%` }]} />
                <View style={[styles.trackThumb, dragRatio !== null && styles.trackThumbActive, { left: `${progressRatio * 100}%` }]} />
              </View>
            </View>
            <View style={styles.times}>
              <Text style={styles.timeText}>{formatTime(elapsedSecs)}</Text>
              <Text style={styles.timeText}>-{formatTime(remainingSecs)}</Text>
            </View>

            <View ref={controlsTourRef} collapsable={false} style={styles.cluster}>
              <AccessiblePressable style={styles.roundBtn} accessibilityLabel="ថយក្រោយ ៥ ពាក្យ" speakOnPress={false} onPress={() => jumpWords(-5)}>
                <SkipBack size={24} color={s.onSurface} />
              </AccessiblePressable>
              <AccessiblePressable
                style={[styles.playBtn, isSpeaking && styles.playBtnOn]}
                accessibilityLabel={isSpeaking ? 'ផ្អាកការអាន' : 'ចាប់ផ្តើមអាន'}
                speakOnPress={false}
                hapticIntensity="medium"
                onPress={togglePlayback}
              >
                {isSpeaking ? <Pause size={30} color="#FFFFFF" fill="#FFFFFF" /> : <Play size={30} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 3 }} />}
              </AccessiblePressable>
              <AccessiblePressable style={styles.roundBtn} accessibilityLabel="រំលងទៅមុខ ៥ ពាក្យ" speakOnPress={false} onPress={() => jumpWords(5)}>
                <SkipForward size={24} color={s.onSurface} />
              </AccessiblePressable>
            </View>
          </View>
        </View>
      )}

      {/* Summary dialog */}
      <Modal visible={isSummaryOpen} transparent animationType="fade" onRequestClose={() => setIsSummaryOpen(false)}>
        <Pressable accessible={false} style={styles.backdrop} onPress={() => setIsSummaryOpen(false)}>
          <Pressable accessible={false} style={styles.sheet} onPress={() => {}}>
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
        <Pressable accessible={false} style={styles.backdrop} onPress={() => setIsVoiceOpen(false)}>
          <Pressable accessible={false} style={styles.sheet} onPress={() => {}}>
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
            <Text style={[styles.speedLabel, { fontFamily: fonts.khmerBold }]}>រំលេចពេលអាន</Text>
            <View style={styles.speedRow}>
              {HIGHLIGHT_MODES.map((m) => (
                <AccessiblePressable
                  key={m.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: highlightMode === m.id }}
                  accessibilityLabel={`រំលេចម្តងមួយ${m.label}`}
                  speakOnPress={false}
                  style={[styles.speedPill, highlightMode === m.id && { backgroundColor: s.primary, borderColor: s.primary }]}
                  onPress={() => chooseHighlightMode(m.id)}
                >
                  <Text style={[styles.speedText, { fontFamily: fonts.khmerBold }, highlightMode === m.id && styles.speedTextOn]}>{m.label}</Text>
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
    topBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, backgroundColor: surface, borderBottomWidth: 1, borderBottomColor: s.divider },
    topTitle: { fontSize: 19, color: s.onSurface },
    iconBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    textPage: { padding: 20, paddingBottom: 240, gap: 24 },
    paragraph: { color: s.onSurface, fontWeight: '600' },
    activeWord: { backgroundColor: HIGHLIGHT, color: '#0F172A' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
    emptyTitle: { fontSize: 22, color: s.onSurface, textAlign: 'center' },
    emptySub: { fontSize: 16, color: s.onSurfaceMuted, textAlign: 'center', lineHeight: 26 },
    emptyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 12 },
    heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, paddingHorizontal: 20, borderRadius: 25 },
    heroBtnText: { color: '#FFFFFF', fontSize: 16 },
    fabAnchor: { position: 'absolute', right: 18, bottom: 152 + insets.bottom, alignItems: 'flex-end', gap: 10 },
    fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: s.primary, borderWidth: 1, borderColor: s.primaryPressed, elevation: 6, shadowColor: s.primary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    fabActive: { backgroundColor: s.primaryPressed, transform: [{ scale: 1.1 }] },
    fabHolding: { backgroundColor: s.primaryPressed, transform: [{ scale: 1.24 }] },
    pills: { gap: 8, alignItems: 'flex-end' },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 18, borderRadius: 23, backgroundColor: surface, borderWidth: 1, borderColor: s.divider, elevation: 4, shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
    pillText: { fontSize: 16, color: s.onSurface },
    pillHot: { backgroundColor: s.primary, borderColor: s.primaryPressed, transform: [{ scale: 1.08 }] },
    pillTextHot: { color: '#FFFFFF' },
    playerBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 8, paddingHorizontal: 16, paddingBottom: 10 + insets.bottom, backgroundColor: surface, borderTopWidth: 1, borderTopColor: s.divider, elevation: 4 },
    playerInner: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 4 },
    scrubHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
    voiceTag: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 30, paddingHorizontal: 10, borderRadius: 9999, backgroundColor: theme === 'dark' ? s.surface2 : 'rgba(148,163,184,0.14)' },
    voiceTagText: { fontSize: 12, color: s.onSurfaceMuted },
    moreBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    trackWrap: { paddingVertical: 12 },
    track: { height: 4, borderRadius: 9999, backgroundColor: 'rgba(148,163,184,0.35)' },
    trackActive: { height: 6 },
    trackFill: { height: '100%', borderRadius: 9999, backgroundColor: s.primary },
    trackThumb: { position: 'absolute', top: '50%', width: 12, height: 12, marginLeft: -6, marginTop: -6, borderRadius: 6, backgroundColor: s.primary, elevation: 2 },
    trackThumbActive: { width: 16, height: 16, marginLeft: -8, marginTop: -8, borderRadius: 8 },
    times: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 1, marginTop: -6 },
    timeText: { fontSize: 12, fontWeight: '600', color: theme === 'dark' ? '#94A3B8' : s.onSurfaceMuted, fontVariant: ['tabular-nums'] },
    cluster: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36, marginTop: 2 },
    roundBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: theme === 'dark' ? s.surface2 : '#F1F5F9' },
    playBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: s.primary, elevation: 6, shadowColor: s.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    playBtnOn: { backgroundColor: s.primaryPressed },
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
