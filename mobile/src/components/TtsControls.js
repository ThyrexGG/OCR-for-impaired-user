import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { ChevronDown, Music2, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react-native'
import { useTheme } from '../theme/ThemeContext'
import { useOcr } from '../context/OcrContext'
import { useTts } from '../context/TtsContext'
import AccessiblePressable from './AccessiblePressable'
import NeoButton from './NeoButton'

const BAR_COUNT = 24

// TtsPanel.css's hardcoded neobrutalist deck colors (+ dark overrides).
const PALETTE = {
  light: { ink: '#0F172A', surface: '#FFFFFF', inset: '#F8FAFC', text: '#0F172A', muted: '#64748B', divider: '#E2E8F0' },
  dark: { ink: '#FFFFFF', surface: '#111B2E', inset: '#0B132B', text: '#FFFFFF', muted: '#94A3B8', divider: '#1E293B' },
}

/**
 * Ports TtsPanel.vue's "audio-deck" as it renders at phone width: status
 * row, full-width hero Play/Pause, a 3-button row (−10 / restart / +10),
 * then speed pills and the voice picker. On the web this deck is the last
 * item in the reader's scroll column (not pinned), so OcrTextView renders
 * it at the end of its ScrollView. The canvas waveform becomes a row of
 * animated bars inside the same bordered visualizer slot.
 */
export default function TtsControls() {
  const { fonts, currentTheme } = useTheme()
  const { extractedText } = useOcr()
  const { isSpeaking, isPaused, rate, voices, selectedVoiceName, speedPresets, togglePlayback, jumpWords, restartSpeech, setSpeedPreset, selectVoice } =
    useTts()
  const palette = PALETTE[currentTheme === 'dark' ? 'dark' : 'light']
  const styles = createStyles(palette)
  const [isVoiceListOpen, setIsVoiceListOpen] = useState(false)

  const wave = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(wave, { toValue: 1, duration: isSpeaking ? 900 : 3200, easing: Easing.linear, useNativeDriver: true })
    )
    wave.setValue(0)
    loop.start()
    return () => loop.stop()
  }, [isSpeaking, wave])

  const hasText = !!extractedText
  const selectedVoice = voices.find((v) => v.name === selectedVoiceName)

  return (
    <View style={styles.deckWrap}>
      <View style={styles.deckShadow} />
      <View style={styles.deck}>
        {/* Visualizer + status tag */}
        <View style={styles.headerBar}>
          <View style={styles.visualizerSlot}>
            {Array.from({ length: BAR_COUNT }).map((_, i) => {
              const phase = i / BAR_COUNT
              const scaleY = wave.interpolate({
                inputRange: [0, 0.25, 0.5, 0.75, 1],
                outputRange: [0, 1, 0, -1, 0].map((s) => {
                  const base = Math.sin((phase + s * 0.25) * Math.PI * 2)
                  return isSpeaking ? 0.45 + 0.55 * Math.abs(base) : 0.15 + 0.1 * Math.abs(base)
                }),
              })
              return <Animated.View key={i} style={[styles.visualizerBar, { transform: [{ scaleY }] }]} />
            })}
          </View>

          <View
            style={[
              styles.statusTag,
              isSpeaking ? styles.tagPlaying : isPaused ? styles.tagPaused : styles.tagIdle,
            ]}
          >
            {isSpeaking && <View style={styles.liveDot} />}
            <Text
              style={[
                styles.statusTagText,
                { fontFamily: fonts.khmer, color: isSpeaking ? '#FFFFFF' : isPaused ? '#B45309' : palette.muted },
              ]}
            >
              {isSpeaking ? 'កំពុងអាន...' : isPaused ? 'បានផ្អាក' : 'ត្រៀមអាន'}
            </Text>
          </View>
        </View>

        {/* Hero Play / Pause */}
        <NeoButton
          bg={!hasText ? '#94A3B8' : isSpeaking ? '#D97706' : '#1D4ED8'}
          borderColor={palette.ink}
          shadowColor={palette.ink}
          disabled={!hasText}
          contentStyle={styles.heroBtn}
          hapticIntensity="medium"
          accessibilityLabel={isSpeaking ? 'ផ្អាកការអាន' : 'អានជាសំឡេង'}
          onPress={togglePlayback}
          speakOnPress={false}
        >
          {isSpeaking ? <Pause size={30} color="#FFFFFF" fill="#FFFFFF" /> : <Play size={30} color="#FFFFFF" fill="#FFFFFF" />}
          <Text style={[styles.heroLabel, { fontFamily: fonts.khmer }]}>{isSpeaking ? 'ផ្អាកការអាន' : 'អានជាសំឡេង'}</Text>
        </NeoButton>

        {/* Secondary: −10 / restart / +10 */}
        <View style={styles.secondaryRow}>
          <NeoButton
            style={styles.flex1}
            bg={palette.surface}
            borderColor={palette.ink}
            shadowColor={palette.ink}
            disabled={!hasText}
            contentStyle={styles.deckBtn}
            accessibilityLabel="ថយក្រោយ ១០ ពាក្យ"
            onPress={() => jumpWords(-10)}
            speakOnPress={false}
          >
            <SkipBack size={20} color={palette.text} />
            <Text style={[styles.deckBtnText, { fontFamily: fonts.khmer }]}>ថយក្រោយ ១០ ពាក្យ</Text>
            <Text style={styles.jumpTag}>−10</Text>
          </NeoButton>

          <NeoButton
            style={styles.flex1}
            bg={palette.surface}
            borderColor={palette.ink}
            shadowColor={palette.ink}
            disabled={!hasText}
            contentStyle={styles.deckBtn}
            accessibilityLabel="អានឡើងវិញពីដើម"
            onPress={restartSpeech}
            speakOnPress={false}
          >
            <RotateCcw size={20} color={palette.text} />
            <Text style={[styles.deckBtnText, { fontFamily: fonts.khmer }]}>អានឡើងវិញពីដើម</Text>
          </NeoButton>

          <NeoButton
            style={styles.flex1}
            bg={palette.surface}
            borderColor={palette.ink}
            shadowColor={palette.ink}
            disabled={!hasText}
            contentStyle={styles.deckBtn}
            accessibilityLabel="ទៅមុខ ១០ ពាក្យ"
            onPress={() => jumpWords(10)}
            speakOnPress={false}
          >
            <SkipForward size={20} color={palette.text} />
            <Text style={[styles.deckBtnText, { fontFamily: fonts.khmer }]}>ទៅមុខ ១០ ពាក្យ</Text>
            <Text style={styles.jumpTag}>+10</Text>
          </NeoButton>
        </View>

        {/* Speed + voice */}
        <View style={styles.secondaryControls}>
          <View style={[styles.controlRow, styles.speedRow]}>
            <Text style={[styles.controlLabel, { fontFamily: fonts.khmer }]}>ល្បឿនអាន៖</Text>
            <View style={styles.speedPillsWrap}>
              <View style={styles.speedPillsShadow} />
              <View style={styles.speedPills}>
                {speedPresets.map((s) => (
                  <AccessiblePressable
                    key={s}
                    style={[styles.speedPill, rate === s && styles.speedPillActive]}
                    accessibilityLabel={`ល្បឿនអាន៖ ${s}ដង`}
                    onPress={() => setSpeedPreset(s)}
                    speakOnPress={false}
                  >
                    <Text style={[styles.speedPillText, rate === s && styles.speedPillTextActive]}>{s}x</Text>
                  </AccessiblePressable>
                ))}
              </View>
            </View>
          </View>

          {voices.length > 0 && (
            <View style={styles.voiceBlock}>
              <View style={styles.controlRow}>
                <View style={styles.voiceLabel}>
                  <Music2 size={16} color="#1D4ED8" />
                  <Text style={[styles.controlLabel, { fontFamily: fonts.khmer }]}>សំឡេងអាន៖</Text>
                </View>
                <NeoButton
                  style={styles.voiceSelectWrap}
                  offsetX={-3}
                  offsetY={3}
                  bg={palette.surface}
                  borderColor={palette.ink}
                  shadowColor={palette.ink}
                  contentStyle={styles.voiceSelect}
                  accessibilityLabel={`សំឡេងអាន៖ ${selectedVoice?.label || ''}`}
                  onPress={() => setIsVoiceListOpen((o) => !o)}
                  speakOnPress={false}
                >
                  <Text style={[styles.voiceSelectText, { fontFamily: fonts.khmer }]} numberOfLines={1}>
                    {selectedVoice?.label || ''}
                  </Text>
                  <ChevronDown size={16} color={palette.text} />
                </NeoButton>
              </View>

              {isVoiceListOpen && (
                <View style={styles.voiceList}>
                  {voices.map((v) => (
                    <AccessiblePressable
                      key={v.name}
                      style={[styles.voiceOption, v.name === selectedVoiceName && styles.voiceOptionActive]}
                      accessibilityLabel={v.label}
                      onPress={() => {
                        selectVoice(v.name)
                        setIsVoiceListOpen(false)
                      }}
                    >
                      <Text style={[styles.voiceOptionText, v.name === selectedVoiceName && { color: '#FFFFFF' }, { fontFamily: fonts.khmer }]}>
                        {v.label}
                      </Text>
                    </AccessiblePressable>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

const createStyles = (p) =>
  StyleSheet.create({
    flex1: { flex: 1 },
    deckWrap: { position: 'relative', marginLeft: 4, marginBottom: 4 },
    deckShadow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: p.ink, borderRadius: 4, transform: [{ translateX: -4 }, { translateY: 4 }] },
    deck: { gap: 14, paddingVertical: 18, paddingHorizontal: 20, backgroundColor: p.surface, borderWidth: 2, borderColor: p.ink, borderRadius: 4 },
    headerBar: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    visualizerSlot: {
      flex: 1,
      height: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 6,
      backgroundColor: p.inset,
      borderWidth: 1.5,
      borderColor: p.ink,
      borderRadius: 4,
      overflow: 'hidden',
    },
    visualizerBar: { width: 3, height: 28, borderRadius: 2, backgroundColor: 'rgba(0, 82, 204, 0.75)' },
    statusTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1.5, borderColor: p.ink, borderRadius: 4 },
    tagPlaying: { backgroundColor: '#1D4ED8' },
    tagPaused: { backgroundColor: '#FEF3C7' },
    tagIdle: { backgroundColor: p.surface },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
    statusTagText: { fontSize: 15, fontWeight: '800' },
    heroBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 64, paddingHorizontal: 24 },
    heroLabel: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
    secondaryRow: { flexDirection: 'row', gap: 12, paddingLeft: 4 },
    deckBtn: { minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4 },
    deckBtnText: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: p.text, textAlign: 'center' },
    jumpTag: { fontSize: 14, fontWeight: '800', color: '#1D4ED8' },
    secondaryControls: { gap: 12, paddingTop: 12, borderTopWidth: 1.5, borderTopColor: p.divider },
    controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    // Too narrow for label + 5 pills on one line at phone width: wrap the
    // pills under the label instead of crushing the label to one glyph wide.
    speedRow: { flexWrap: 'wrap', rowGap: 10, paddingLeft: 3 },
    controlLabel: { flexShrink: 0, fontSize: 17, fontWeight: '800', color: p.text },
    speedPillsWrap: { position: 'relative' },
    speedPillsShadow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: p.ink, borderRadius: 4, transform: [{ translateX: -3 }, { translateY: 3 }] },
    speedPills: { flexDirection: 'row', padding: 2, gap: 2, backgroundColor: p.inset, borderWidth: 2, borderColor: p.ink, borderRadius: 4 },
    speedPill: { minHeight: 36, minWidth: 40, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
    speedPillActive: { backgroundColor: '#1D4ED8' },
    speedPillText: { fontSize: 16, fontWeight: '700', color: p.text },
    speedPillTextActive: { color: '#FFFFFF', fontWeight: '800' },
    voiceBlock: { gap: 8 },
    voiceLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    voiceSelectWrap: { flex: 1, maxWidth: 220 },
    voiceSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 44, paddingHorizontal: 12 },
    voiceSelectText: { flex: 1, fontSize: 16, fontWeight: '700', color: p.text },
    voiceList: { borderWidth: 2, borderColor: p.ink, borderRadius: 4, backgroundColor: p.surface, overflow: 'hidden' },
    voiceOption: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: p.divider },
    voiceOptionActive: { backgroundColor: '#1D4ED8' },
    voiceOptionText: { fontSize: 16, fontWeight: '700', color: p.text },
  })
