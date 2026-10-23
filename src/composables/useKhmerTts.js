import { ref, computed, inject, onBeforeUnmount } from 'vue'
import { synthesizeTextAzureTTS, synthesizeLocalKhmerTTS } from '../services/tts'
import { normalizeKhmerForSpeech } from '../services/khmerNormalizer'
import { CLOUD_API_AVAILABLE, cloudTts } from '../services/cloudApi'
import { getTtsCache, setTtsCache } from '../services/cache'
import { announcer } from '../services/announcer'

// Khmer TTS engine shared by the reader screens: songKHEM-VITS / Neural personas,
// Smart Assistive Pacing, and word highlighting locked to the real audio playhead.
// Mirrors the engine inside TtsPanel.vue so both play back identically.

export const KHMER_VOICES = [
  { name: 'km-KH-PisethNeural', lang: 'km-KH', label: 'ពិសិដ្ឋ (Piseth — សំឡេងប្រុស Neural ច្បាស់ៗ)', gender: 'Male' },
  { name: 'km-KH-SreymomNeural', lang: 'km-KH', label: 'ស្រីមុំ (Sreymom — សំឡេងស្រី Neural ស្រទន់)', gender: 'Female' },
  { name: 'km-KH-SokhaMedical', lang: 'km-KH', label: 'គ្រូពេទ្យ សុខា (Dr. Sokha — អានវេជ្ជបញ្ជា/វិក្កយបត្រ)', gender: 'Male' },
  { name: 'km-KH-VitsOffline', lang: 'km-KH', label: 'songKHEM-VITS (Offline Model — ម៉ូដែលក្នុងម៉ាស៊ីនផ្ទាល់)', gender: 'Male' }
]

export const SPEED_PRESETS = [0.75, 1.0, 1.25, 1.5, 2.0]

const VOICE_STORAGE_KEY = 'songkhem_reader_voice'
const PACING_STORAGE_KEY = 'songkhem_reader_pacing'

const safeGet = (key) => {
  try { return localStorage.getItem(key) } catch (_) { return null }
}
const safeSet = (key, value) => {
  try { localStorage.setItem(key, value) } catch (_) {}
}

// Segment a sentence into words (identical to OcrPanel.vue / TtsPanel.vue globalIndex)
const segmentSentenceIntoWords = (sentenceText) => {
  if (!sentenceText) return []
  if (/[ក-៿]/.test(sentenceText) && typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter('km', { granularity: 'word' })
      const words = []
      for (const { segment } of segmenter.segment(sentenceText)) {
        const trimmed = segment.trim()
        if (trimmed) words.push(trimmed)
      }
      if (words.length > 0) return words
    } catch (_) {}
  }
  return sentenceText.split(/\s+/).filter(w => w.length > 0)
}

const computeTokenAcousticWeight = (rawToken) => {
  const tStr = (rawToken || '').trim()
  if (!tStr) return 0.05
  // Pure visual separators / brackets / dashes take almost zero spoken time
  if (/^[-‐-―=_()[\]{}"'«»/\\|+*]+$/.test(tStr)) return 0.06
  // Clause / sentence punctuation marks correspond to brief breath pauses
  if (/^[:;,.?!។៕]+$/.test(tStr)) return /[។៕.?!]/.test(tStr) ? 0.42 : 0.22
  // Currency symbols spoken as words
  if (tStr === '$' || tStr === '៛') return 1.35
  // Expand numbers/abbreviations/compounds via Khmer normalizer so spoken length matches voice
  const spoken = normalizeKhmerForSpeech(tStr).replace(/[^ក-៿a-zA-Z0-9]/g, '')
  const charLen = Math.max(1, spoken.length || tStr.length)
  let weight = Math.max(0.85, Math.pow(charLen, 0.78) * 0.62)
  if (/[។៕.?!]$/.test(tStr)) weight += 0.38
  return weight
}

// Tokenize text into paragraphs of words plus a cumulative acoustic timeline
export const tokenizeForReading = (rawText) => {
  const paragraphs = []
  const flat = []
  const weights = []
  if (!rawText) return { paragraphs, tokens: flat, timeline: [] }

  const rawParas = rawText.split(/\n\s*\n|\n/)
  rawParas.forEach((paraText, pIdx) => {
    if (!paraText.trim()) return
    const paraStartIdx = flat.length
    const words = []
    const rawSentences = paraText.split(/([។៕.?!]+)/).filter(Boolean)
    for (let i = 0; i < rawSentences.length; i += 2) {
      const sText = (rawSentences[i] + (rawSentences[i + 1] || '')).trim()
      if (!sText) continue
      for (const w of segmentSentenceIntoWords(sText)) {
        words.push({ index: flat.length, text: w, paragraphIndex: pIdx })
        flat.push(w)
        weights.push(computeTokenAcousticWeight(w))
      }
    }
    const paraEndIdx = flat.length - 1
    if (paraEndIdx >= paraStartIdx) {
      // Natural pause after a numbered list item at the start of a line (e.g. "1 ." or "១ .")
      if (/^[០-៩0-9]{1,3}\.?$/.test(flat[paraStartIdx])) {
        weights[paraStartIdx] += 0.55
        if (paraStartIdx + 1 <= paraEndIdx && flat[paraStartIdx + 1] === '.') {
          weights[paraStartIdx + 1] = 0.45
        }
      }
      // Full sentence line-break pause at the end of every line/paragraph
      weights[paraEndIdx] += 0.95
    }
    paragraphs.push({ paragraphIndex: pIdx, words })
  })

  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1
  let cum = 0
  const timeline = flat.map((w, idx) => {
    const startFrac = cum / totalWeight
    cum += weights[idx]
    return { index: idx, word: w, weight: weights[idx], startFrac, endFrac: cum / totalWeight }
  })
  return { paragraphs, tokens: flat, timeline }
}

export function useKhmerTts({ getText, activeWordIndex }) {
  const speakAccessibility = inject('speakAccessibility', () => {})

  // While talk-back speaks, the document audio dips so the guidance is clearly heard
  const DUCKED_FACTOR = 0.2
  let ducked = false
  const effectiveVolume = () => volume.value * (ducked ? DUCKED_FACTOR : 1)
  const stopDucking = announcer.onSpeakingChange((speaking) => {
    ducked = speaking
    if (currentAudio) currentAudio.volume = effectiveVolume()
  })
  onBeforeUnmount(stopDucking)
  const triggerHaptic = inject('triggerHaptic', () => {})

  const savedVoice = safeGet(VOICE_STORAGE_KEY)
  const selectedVoiceName = ref(
    KHMER_VOICES.some(v => v.name === savedVoice) ? savedVoice : 'km-KH-PisethNeural'
  )
  const assistivePacing = ref(safeGet(PACING_STORAGE_KEY) === '1')
  const rate = ref(1.0)
  const volume = ref(1.0)
  const isSpeaking = ref(false)
  const isPaused = ref(false)

  const paragraphs = ref([])
  const tokens = ref([])
  const tokenTimeline = ref([])

  let currentAudio = null
  let highlightInterval = null
  let fallbackStartTime = 0
  let fallbackStartOffsetFrac = 0
  let usingSynth = false
  let activeUtterance = null
  let pendingSeekIndex = null
  let pendingSynthStart = null

  const isAssistivePacingActive = computed(() =>
    assistivePacing.value || selectedVoiceName.value === 'km-KH-SokhaMedical'
  )

  const setVoice = (name) => {
    if (!KHMER_VOICES.some(v => v.name === name)) return
    const wasActive = isSpeaking.value || isPaused.value
    selectedVoiceName.value = name
    safeSet(VOICE_STORAGE_KEY, name)
    if (wasActive) stop()
  }

  const setAssistivePacing = (on) => {
    const wasActive = isSpeaking.value || isPaused.value
    assistivePacing.value = Boolean(on)
    safeSet(PACING_STORAGE_KEY, on ? '1' : '0')
    if (wasActive) stop()
  }

  const setRate = (val) => {
    rate.value = val
    if (currentAudio) currentAudio.playbackRate = val
  }

  const cycleSpeed = (direction = 1) => {
    const currentIdx = SPEED_PRESETS.indexOf(rate.value)
    const nextIdx = Math.max(0, Math.min(SPEED_PRESETS.length - 1, (currentIdx === -1 ? 1 : currentIdx) + direction))
    setRate(SPEED_PRESETS[nextIdx])
  }

  const prepare = (rawText) => {
    const result = tokenizeForReading(rawText)
    paragraphs.value = result.paragraphs
    tokens.value = result.tokens
    tokenTimeline.value = result.timeline
    if (!result.tokens.length) activeWordIndex.value = -1
  }

  const clearHighlightTimer = () => {
    if (highlightInterval) {
      clearInterval(highlightInterval)
      highlightInterval = null
    }
  }

  const matchIndexForProgress = (progress) => {
    let matchedIdx = tokenTimeline.value.length - 1
    for (let i = 0; i < tokenTimeline.value.length; i++) {
      if (progress <= tokenTimeline.value[i].endFrac) {
        matchedIdx = i
        break
      }
    }
    return matchedIdx
  }

  // Playhead position (seconds) for a word, or null while the audio duration is still unknown
  const audioTimeForWord = (audio, wordIndex) => {
    const entry = tokenTimeline.value[wordIndex]
    if (!entry || !audio || !Number.isFinite(audio.duration) || audio.duration <= 0.15) return null
    const leadPad = Math.min(0.08, audio.duration * 0.03)
    const trailPad = Math.min(0.14, audio.duration * 0.04)
    const effectiveDur = Math.max(0.15, audio.duration - leadPad - trailPad)
    // Land just inside the word so float rounding never maps the playhead back to the previous token
    return leadPad + Math.min(1, entry.startFrac + 0.002) * effectiveDur
  }

  // Real-time audio-locked word highlighting (33 FPS, synced to the audio element's clock)
  const startHighlighting = (startIndex = 0) => {
    if (!tokens.value.length) return
    const clampedStart = Math.max(0, Math.min(tokens.value.length - 1, startIndex))
    activeWordIndex.value = clampedStart
    clearHighlightTimer()

    const startEntry = tokenTimeline.value[clampedStart]
    fallbackStartOffsetFrac = startEntry ? startEntry.startFrac : 0
    fallbackStartTime = performance.now()

    highlightInterval = setInterval(() => {
      if (!tokens.value.length || !tokenTimeline.value.length) return

      // A skip requested before the audio metadata was ready is applied as soon as it is
      if (pendingSeekIndex !== null && currentAudio) {
        const t = audioTimeForWord(currentAudio, pendingSeekIndex)
        if (t !== null) {
          currentAudio.currentTime = t
          pendingSeekIndex = null
        }
      }

      // Mode A: locked to the HTML5 Audio playhead
      if (currentAudio && Number.isFinite(currentAudio.duration) && currentAudio.duration > 0.15) {
        const leadPad = Math.min(0.08, currentAudio.duration * 0.03)
        const trailPad = Math.min(0.14, currentAudio.duration * 0.04)
        const effectiveDur = Math.max(0.15, currentAudio.duration - leadPad - trailPad)
        const effectiveTime = Math.max(0, currentAudio.currentTime - leadPad)
        const progress = Math.min(1.0, Math.max(0.0, effectiveTime / effectiveDur))
        const matchedIdx = matchIndexForProgress(progress)
        if (matchedIdx !== activeWordIndex.value) activeWordIndex.value = matchedIdx
        return
      }

      // Mode B: weighted natural Khmer cadence (Web Speech fallback, or before audio metadata loads)
      const totalWeights = tokenTimeline.value.reduce((acc, item) => acc + item.weight, 0) || 1
      const estimatedTotalMs = (totalWeights * 195) / Math.max(0.5, rate.value)
      const elapsedMs = performance.now() - fallbackStartTime
      const progress = Math.min(1.0, fallbackStartOffsetFrac + elapsedMs / Math.max(400, estimatedTotalMs))
      const matchedIdx = matchIndexForProgress(progress)
      if (matchedIdx !== activeWordIndex.value) activeWordIndex.value = matchedIdx
      if (progress >= 1.0 && !currentAudio) clearHighlightTimer()
    }, 30)
  }

  const stop = () => {
    usingSynth = false
    activeUtterance = null
    pendingSeekIndex = null
    pendingSynthStart = null
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      currentAudio = null
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel() } catch (_) {}
    }
    isSpeaking.value = false
    isPaused.value = false
    activeWordIndex.value = -1
    clearHighlightTimer()
  }

  const pause = () => {
    if (!isSpeaking.value) return
    if (currentAudio) {
      currentAudio.pause()
    } else if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.pause() } catch (_) {}
    }
    isPaused.value = true
    isSpeaking.value = false
    clearHighlightTimer()
    triggerHaptic(40)
    speakAccessibility('បានផ្អាកការអាន')
  }

  const fallbackWebSpeech = (startIndex = 0) => {
    stop()
    isSpeaking.value = true
    isPaused.value = false

    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
    if (synth) {
      try {
        usingSynth = true
        // Starting mid-text (skip / tap-to-seek): speak only the remaining words
        const spokenText = startIndex > 0 && tokens.value.length
          ? tokens.value.slice(startIndex).join(' ')
          : getText()
        const utterance = new SpeechSynthesisUtterance(spokenText)
        activeUtterance = utterance
        const synthVoices = synth.getVoices ? synth.getVoices() : []
        const realVoice = (synthVoices || []).find(v => (v.lang || '').toLowerCase().startsWith('km') || (v.name || '').toLowerCase().includes('khmer'))
        if (realVoice) utterance.voice = realVoice
        utterance.rate = rate.value
        utterance.volume = volume.value
        utterance.lang = 'km-KH'
        const currentVoice = KHMER_VOICES.find(v => v.name === selectedVoiceName.value)
        utterance.pitch = currentVoice?.gender === 'Female' ? 1.18 : currentVoice?.gender === 'Male' ? 0.92 : 1.0
        // Ignore events from an utterance that a skip has already replaced
        utterance.onend = () => { if (activeUtterance === utterance) stop() }
        utterance.onerror = () => { if (activeUtterance === utterance) stop() }
        synth.speak(utterance)
      } catch (e) {
        console.warn('SpeechSynthesis error:', e)
      }
    }
    startHighlighting(startIndex)
  }

  // Khmer Neural TTS: local engine -> Azure key -> cloud proxy -> Web Speech fallback
  const start = async (startIndex = 0) => {
    const text = getText()
    if (!text || !text.trim()) {
      speakAccessibility('មិនទាន់មានអត្ថបទសម្រាប់អាននៅឡើយទេ')
      return
    }

    const azureKey = safeGet('songkhem_azure_tts_key')
    const azureEndpoint = safeGet('songkhem_azure_tts_endpoint') || 'https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1'

    // Resume if paused
    if (isPaused.value && usingSynth && pendingSynthStart !== null) {
      // Skipped while paused on the Web Speech fallback: restart from the chosen word
      fallbackWebSpeech(pendingSynthStart)
      triggerHaptic(40)
      return
    }
    if (isPaused.value) {
      if (currentAudio) {
        currentAudio.play()
      } else if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.resume()
      }
      isPaused.value = false
      isSpeaking.value = true
      startHighlighting(activeWordIndex.value >= 0 ? activeWordIndex.value : 0)
      triggerHaptic(40)
      speakAccessibility('បន្តការអាន')
      return
    }

    stop()
    isSpeaking.value = true
    isPaused.value = false
    triggerHaptic([60, 40])
    speakAccessibility('ចាប់ផ្តើមអាន...', false)

    try {
      const voiceName = selectedVoiceName.value
      const gender = KHMER_VOICES.find(v => v.name === voiceName)?.gender || 'Male'

      // iOS Safari autoplay fix: create & unlock the Audio element synchronously on the user tap
      const unlockedAudio = new Audio()
      unlockedAudio.preload = 'auto'
      unlockedAudio.load()
      currentAudio = unlockedAudio

      const cacheVariantKey = `${voiceName}|v2|pace:${isAssistivePacingActive.value ? 1 : 0}|lex:0`
      let audioUrl = getTtsCache(text, cacheVariantKey, 1.0)
      if (!audioUrl) {
        if (azureKey && voiceName !== 'km-KH-VitsOffline') {
          audioUrl = await synthesizeTextAzureTTS(text, azureKey, azureEndpoint, 1.0, 1.0, voiceName, gender)
        } else {
          try {
            audioUrl = await synthesizeLocalKhmerTTS(text, voiceName, 1.0, {
              assistivePacing: isAssistivePacingActive.value
            })
          } catch (localErr) {
            if (CLOUD_API_AVAILABLE) {
              audioUrl = await cloudTts(text, voiceName)
            } else {
              throw localErr
            }
          }
        }
        setTtsCache(text, cacheVariantKey, 1.0, audioUrl)
      }

      // Stopped (or restarted) while the audio was being synthesized
      if (currentAudio !== unlockedAudio) return

      unlockedAudio.src = audioUrl
      unlockedAudio.playbackRate = rate.value
      unlockedAudio.volume = effectiveVolume()
      unlockedAudio.onended = () => {
        stop()
        speakAccessibility('ការអានអត្ថបទបានបញ្ចប់')
      }
      await unlockedAudio.play()
      // A skip tapped while the voice was still being synthesized wins over the original start
      const target = pendingSeekIndex !== null ? pendingSeekIndex : startIndex
      startHighlighting(target)

      // Jump to the requested word once the audio clock is running
      if (target > 0) seekToWord(target)
    } catch (error) {
      console.error('Neural Khmer TTS error, falling back to Web Speech:', error)
      isSpeaking.value = false
      fallbackWebSpeech(startIndex)
    }
  }

  const seekToWord = (wordIndex) => {
    if (wordIndex < 0 || wordIndex >= tokens.value.length) return
    activeWordIndex.value = wordIndex

    // Web Speech fallback can't seek: restart the utterance from the target word
    if (usingSynth) {
      if (isSpeaking.value) fallbackWebSpeech(wordIndex)
      else if (isPaused.value) pendingSynthStart = wordIndex
      return
    }

    if (currentAudio) {
      const t = audioTimeForWord(currentAudio, wordIndex)
      if (t !== null) {
        currentAudio.currentTime = t
        pendingSeekIndex = null
      } else {
        // Audio still synthesizing / loading: apply once its duration is known
        pendingSeekIndex = wordIndex
      }
    }
    if (isSpeaking.value) startHighlighting(wordIndex)
  }

  const jumpWords = (delta) => {
    if (!tokens.value.length) return
    const current = activeWordIndex.value >= 0 ? activeWordIndex.value : 0
    seekToWord(Math.max(0, Math.min(tokens.value.length - 1, current + delta)))
    triggerHaptic(30)
  }

  const toggle = () => {
    if (isSpeaking.value) pause()
    else start(activeWordIndex.value >= 0 ? activeWordIndex.value : 0)
  }

  onBeforeUnmount(stop)

  return {
    voices: KHMER_VOICES,
    selectedVoiceName,
    assistivePacing,
    rate,
    volume,
    isSpeaking,
    isPaused,
    paragraphs,
    tokens,
    prepare,
    start,
    pause,
    stop,
    toggle,
    seekToWord,
    jumpWords,
    setVoice,
    setAssistivePacing,
    setRate,
    cycleSpeed
  }
}
