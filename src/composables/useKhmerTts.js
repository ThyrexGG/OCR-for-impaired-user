import { ref, computed, inject, onBeforeUnmount } from 'vue'
import { APP_VOICE_FAILED_KM, isAppVoiceOnly, synthesizeTextAzureTTS, synthesizeLocalKhmerTTS } from '../services/tts'
import { CLOUD_API_AVAILABLE, cloudTts } from '../services/cloudApi'
import { getTtsCache, setTtsCache } from '../services/cache'
import { announcer } from '../services/announcer'
import { tokenizeForReading } from '../services/readerTokenizer'

export { tokenizeForReading }

// Khmer TTS engine shared by the reader screens: Neural personas (Piseth, Sreymom, Sokha, Sopheap),
// Smart Assistive Pacing, and word highlighting locked to the real audio playhead.
// Mirrors the engine inside TtsPanel.vue so both play back identically.

export const KHMER_VOICES = [
  { name: 'km-KH-PisethNeural', lang: 'km-KH', label: 'ពិសិដ្ឋ (Piseth — សំឡេងប្រុស)', gender: 'Male' },
  { name: 'km-KH-SreymomNeural', lang: 'km-KH', label: 'ស្រីមុំ (Sreymom — សំឡេងស្រី)', gender: 'Female' },
  { name: 'km-KH-SokhaMedical', lang: 'km-KH', label: 'គ្រូពេទ្យ សុខា (Dr. Sokha — អានវេជ្ជបញ្ជា/វិក្កយបត្រ)', gender: 'Male' },
  { name: 'km-KH-VitsOffline', lang: 'km-KH', label: 'សុភាព (Sopheap — សំឡេងប្រុស ស្រាល)', gender: 'Male' }
]

export const SPEED_PRESETS = [0.75, 1.0, 1.25, 1.5, 2.0]

// Voice used until the reader picks another one
export const DEFAULT_VOICE = 'km-KH-SokhaMedical'

const VOICE_STORAGE_KEY = 'songkhem_reader_voice'
const PACING_STORAGE_KEY = 'songkhem_reader_pacing'

const safeGet = (key) => {
  try { return localStorage.getItem(key) } catch (_) { return null }
}
const safeSet = (key, value) => {
  try { localStorage.setItem(key, value) } catch (_) {}
}


/**
 * Pre-warm / synthesize and cache Khmer TTS audio in the background during OCR processing.
 * This eliminates the 2-5s delay when entering Reader mode so playback is ready immediately.
 */
export const prewarmKhmerTts = async (text, options = {}) => {
  if (!text || !text.trim()) return null
  const voiceName = options.voiceName || safeGet(VOICE_STORAGE_KEY) || DEFAULT_VOICE
  const shouldPace = options.assistivePacing ?? (safeGet(PACING_STORAGE_KEY) === '1' || voiceName === 'km-KH-SokhaMedical')
  const cacheVariantKey = `${voiceName}|v2|pace:${shouldPace ? 1 : 0}|lex:0`

  // Already cached?
  let audioUrl = getTtsCache(text, cacheVariantKey, 1.0)
  if (audioUrl) {
    return { audioUrl, cached: true }
  }

  const azureKey = safeGet('songkhem_azure_tts_key')
  const azureEndpoint = safeGet('songkhem_azure_tts_endpoint') || 'https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1'

  const synthPromise = (async () => {
    if (azureKey && voiceName !== 'km-KH-VitsOffline') {
      const gender = KHMER_VOICES.find(v => v.name === voiceName)?.gender || 'Male'
      return await synthesizeTextAzureTTS(text, azureKey, azureEndpoint, 1.0, 1.0, voiceName, gender)
    } else {
      try {
        return await synthesizeLocalKhmerTTS(text, voiceName, 1.0, { assistivePacing: shouldPace })
      } catch (err) {
        if (CLOUD_API_AVAILABLE) return await cloudTts(text, voiceName)
        throw err
      }
    }
  })()

  const timeoutMs = options.timeoutMs || 30000
  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TTS prewarm timeout')), timeoutMs))
    audioUrl = await Promise.race([synthPromise, timeoutPromise])
    if (audioUrl) {
      setTtsCache(text, cacheVariantKey, 1.0, audioUrl)
      return { audioUrl, cached: false }
    }
  } catch (err) {
    // Non-fatal: if prewarm times out or fails, on-demand playback will handle it
    console.warn('TTS prewarm warning:', err)
  }
  return null
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
    KHMER_VOICES.some(v => v.name === savedVoice) ? savedVoice : DEFAULT_VOICE
  )
  const assistivePacing = ref(safeGet(PACING_STORAGE_KEY) === '1')
  const rate = ref(1.0)
  const volume = ref(1.0)
  const isSpeaking = ref(false)
  const isPaused = ref(false)
  // Length of the synthesized audio at 1x, once the browser knows it (0 = not yet)
  const audioDuration = ref(0)

  const paragraphs = ref([])
  const tokens = ref([])
  const tokenTimeline = ref([])

  // Realistic fallback duration based on calibrated phonetic syllable weights
  const estimatedDurationSecs = computed(() => {
    if (audioDuration.value > 0) return audioDuration.value
    if (!tokenTimeline.value.length) return 0
    const totalWeight = tokenTimeline.value.reduce((acc, item) => acc + item.weight, 0) || 1
    return Math.max(1, Math.round(totalWeight * 0.195))
  })

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
    const from = Math.max(0, activeWordIndex.value)
    selectedVoiceName.value = name
    safeSet(VOICE_STORAGE_KEY, name)
    audioDuration.value = 0
    // Heard straight away: carry on from the same word in the new voice
    if (wasActive) {
      stop()
      start(from)
    }
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
    audioDuration.value = 0
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
    // Testing switch "songKHEM voice only": never hand the document to the browser's voice
    if (isAppVoiceOnly()) {
      speakAccessibility(APP_VOICE_FAILED_KM)
      return
    }
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

      // Let the control label / announcement that led here finish before the document voice begins
      await announcer.whenSilent()
      if (currentAudio !== unlockedAudio) return

      unlockedAudio.onloadedmetadata = () => {
        if (Number.isFinite(unlockedAudio.duration) && unlockedAudio.duration > 0) audioDuration.value = unlockedAudio.duration
      }
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
    audioDuration,
    estimatedDurationSecs,
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
