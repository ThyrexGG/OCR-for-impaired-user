<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, inject } from 'vue'
import { 
  Play, Pause, Square, RotateCcw, Volume2, Sparkles, 
  Sliders, Music2, SkipBack, SkipForward, Repeat
} from 'lucide-vue-next'
import { APP_VOICE_FAILED_KM, isAppVoiceOnly, synthesizeTextAzureTTS, synthesizeLocalKhmerTTS } from '../services/tts'
import { normalizeKhmerForSpeech, analyzeKhmerG2P, saveCustomLexiconEntry } from '../services/khmerNormalizer'
import { CLOUD_API_AVAILABLE, cloudTts } from '../services/cloudApi'
import { getTtsCache, setTtsCache } from '../services/cache'
import { t, currentLang } from '../services/i18n'

const props = defineProps({
  text: {
    type: String,
    default: ''
  },
  activeWordIndex: {
    type: Number,
    default: -1
  }
})

const emit = defineEmits(['update:activeWordIndex', 'scan-again'])

const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})

// Synthesis & Audio State
const voices = ref([])
const selectedVoiceName = ref('')
const rate = ref(1.0)
const volume = ref(1.0)
const isSpeaking = ref(false)
const isPaused = ref(false)

// Smart Assistive Pacing & Khmer G2P Phoneme Inspector State
const assistivePacing = ref(false)
const showG2pInspector = ref(false)
const customWordInput = ref('')
const customRespellInput = ref('')
const lexiconRevision = ref(0)
const lexiconSavedStatus = ref('')

const isAssistivePacingActive = computed(() => {
  return assistivePacing.value || selectedVoiceName.value === 'km-KH-SokhaMedical'
})

const g2pAnalysis = computed(() => {
  // depend on lexiconRevision so adding a custom word immediately refreshes G2P output
  void lexiconRevision.value
  return analyzeKhmerG2P(props.text || '', { assistivePacing: isAssistivePacingActive.value })
})

const activeModelBadge = computed(() => {
  if (selectedVoiceName.value === 'km-KH-VitsOffline') {
    return 'Sopheap (Piseth Neural, lighter pitch) + Khmer Closed-Syllable G2P'
  }
  if (selectedVoiceName.value === 'km-KH-SokhaMedical') {
    return 'Dr. Sokha Assistive Persona (-10Hz Baritone · Smart Dosage/Currency Pacing)'
  }
  if (selectedVoiceName.value === 'km-KH-SreymomNeural') {
    return 'Sreymom Neural 24kHz + Khmer Closed-Syllable G2P'
  }
  return 'Piseth Neural 24kHz + Khmer Closed-Syllable G2P'
})

const toggleAssistivePacing = () => {
  assistivePacing.value = !assistivePacing.value
  triggerHaptic(30)
  speakAccessibility(
    assistivePacing.value
      ? 'បានបើកមុខងារអានបន្ថយល្បឿនត្រង់លេខ និងតម្លៃថ្នាំ'
      : 'បានបិទមុខងារបន្ថយល្បឿនត្រង់លេខ'
  )
}

const addCustomLexiconOverride = async () => {
  const w = customWordInput.value.trim()
  const r = customRespellInput.value.trim()
  if (!w || !r) return
  saveCustomLexiconEntry(w, r)
  lexiconRevision.value++
  try {
    await fetch('/api/lexicon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: w, respell: r })
    })
  } catch (_) {}
  lexiconSavedStatus.value = `បានរក្សាទុក៖ ${w} → ${r}`
  customWordInput.value = ''
  customRespellInput.value = ''
  triggerHaptic(40)
  speakAccessibility(`បានរក្សាទុកសូរអានពាក្យ ${r}`)
  setTimeout(() => {
    lexiconSavedStatus.value = ''
  }, 4000)
}

// Highlighting Tokens
const tokens = ref([])
let highlightInterval = null
let currentAudio = null

// Canvas Visualizer
const canvasRef = ref(null)
let animationId = null
const waveOffset = ref(0)

// Speed presets: 0.75x, 1.0x, 1.25x, 1.5x, 2.0x
const speedPresets = [0.75, 1.0, 1.25, 1.5, 2.0]

const setSpeedPreset = (val) => {
  rate.value = val
  if (currentAudio) currentAudio.playbackRate = val
  triggerHaptic(30)
  speakAccessibility(`ប្តូរល្បឿនអានទៅ ${val} ដង`)
}

// Adjust rate & volume dynamically
watch(rate, (newRate) => {
  if (currentAudio) currentAudio.playbackRate = newRate
})

watch(volume, (newVol) => {
  if (currentAudio) currentAudio.volume = newVol
})

// Load speech voices - 4 Distinct Khmer Voice Personas
const loadVoices = () => {
  if (typeof window === 'undefined') return

  voices.value = [
    {
      name: 'km-KH-PisethNeural',
      lang: 'km-KH',
      label: 'ពិសិដ្ឋ (Piseth — សំឡេងប្រុស)',
      gender: 'Male',
      isAzure: true
    },
    {
      name: 'km-KH-SreymomNeural',
      lang: 'km-KH',
      label: 'ស្រីមុំ (Sreymom — សំឡេងស្រី)',
      gender: 'Female',
      isAzure: true
    },
    {
      name: 'km-KH-SokhaMedical',
      lang: 'km-KH',
      label: 'គ្រូពេទ្យ សុខា (Dr. Sokha — អានវេជ្ជបញ្ជា/វិក្កយបត្រ)',
      gender: 'Male',
      isAzure: true
    },
    {
      name: 'km-KH-VitsOffline',
      lang: 'km-KH',
      label: 'សុភាព (Sopheap — សំឡេងប្រុស ស្រាល)',
      gender: 'Male',
      isAzure: true
    }
  ]
  if (!selectedVoiceName.value || !voices.value.find(v => v.name === selectedVoiceName.value)) {
    selectedVoiceName.value = 'km-KH-SokhaMedical' // default voice: Dr. Sokha
  }
}

// Segment Khmer or English sentences into words (100% identical to OcrPanel.vue globalIndex)
const segmentSentenceIntoWords = (sentenceText) => {
  if (!sentenceText) return []
  if (/[\u1780-\u17FF]/.test(sentenceText) && typeof Intl !== 'undefined' && Intl.Segmenter) {
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

const tokenTimeline = ref([])

const computeTokenAcousticWeight = (rawToken) => {
  const tStr = (rawToken || '').trim()
  if (!tStr) return 0.05
  // Pure visual separators / brackets / dashes take almost zero spoken time
  if (/^[-\u2010-\u2015=_()[\]{}"'«»/\\|+*]+$/.test(tStr)) {
    return 0.06
  }
  // Clause / sentence punctuation marks correspond to brief breath pauses
  if (/^[:;,.?!។៕]+$/.test(tStr)) {
    return /[។៕.?!]/.test(tStr) ? 0.42 : 0.22
  }
  // Currency symbols spoken as words
  if (tStr === '$' || tStr === '៛') {
    return 1.35
  }
  // Expand numbers/abbreviations/compounds via Khmer normalizer so spoken length matches voice
  const spoken = normalizeKhmerForSpeech(tStr).replace(/[^\u1780-\u17FFa-zA-Z0-9]/g, '')
  const charLen = Math.max(1, spoken.length || tStr.length)
  let weight = Math.max(0.85, Math.pow(charLen, 0.78) * 0.62)
  if (/[។៕.?!]$/.test(tStr)) {
    weight += 0.38
  }
  return weight
}

// Tokenize text into words matching OcrPanel.vue globalIndex 1-to-1 and build cumulative timeline
const prepareTokens = (rawText) => {
  if (!rawText) {
    tokens.value = []
    tokenTimeline.value = []
    emit('update:activeWordIndex', -1)
    return
  }

  const rawParas = rawText.split(/\n\s*\n|\n/)
  const extracted = []
  const weights = []

  for (const paraText of rawParas) {
    if (!paraText.trim()) continue
    const paraStartIdx = extracted.length
    const rawSentences = paraText.split(/([។៕.?!]+)/).filter(Boolean)
    for (let i = 0; i < rawSentences.length; i += 2) {
      const sText = (rawSentences[i] + (rawSentences[i + 1] || '')).trim()
      if (!sText) continue
      const wordStrings = segmentSentenceIntoWords(sText)
      for (const w of wordStrings) {
        extracted.push(w)
        weights.push(computeTokenAcousticWeight(w))
      }
    }
    const paraEndIdx = extracted.length - 1
    if (paraEndIdx >= paraStartIdx) {
      // Add natural pause after numbered list item at start of line (e.g. "1 ." or "១ .")
      if (/^[០-៩0-9]{1,3}\.?$/.test(extracted[paraStartIdx])) {
        weights[paraStartIdx] += 0.55
        if (paraStartIdx + 1 <= paraEndIdx && extracted[paraStartIdx + 1] === '.') {
          weights[paraStartIdx + 1] = 0.45
        }
      }
      // Add full sentence line-break pause at the end of every line/paragraph
      weights[paraEndIdx] += 0.95
    }
  }

  tokens.value = extracted
  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1
  let cum = 0
  tokenTimeline.value = extracted.map((w, idx) => {
    const startFrac = cum / totalWeight
    cum += weights[idx]
    const endFrac = cum / totalWeight
    return {
      index: idx,
      word: w,
      weight: weights[idx],
      startFrac,
      endFrac
    }
  })
}

// Real-time audio-locked word highlighting synchronization (33 FPS hardware audio clock sync)
let fallbackStartTime = 0
let fallbackStartOffsetFrac = 0

const startHighlighting = (startIndex = 0) => {
  if (!tokens.value.length) return
  const clampedStart = Math.max(0, Math.min(tokens.value.length - 1, startIndex))
  emit('update:activeWordIndex', clampedStart)

  if (highlightInterval) {
    clearInterval(highlightInterval)
    highlightInterval = null
  }

  const startEntry = tokenTimeline.value[clampedStart]
  fallbackStartOffsetFrac = startEntry ? startEntry.startFrac : 0
  fallbackStartTime = performance.now()

  highlightInterval = setInterval(() => {
    if (!tokens.value.length || !tokenTimeline.value.length) return

    // Mode A: Locked directly to HTML5 Audio playhead (currentAudio.currentTime / currentAudio.duration)
    if (currentAudio && Number.isFinite(currentAudio.duration) && currentAudio.duration > 0.15) {
      const leadPad = Math.min(0.08, currentAudio.duration * 0.03)
      const trailPad = Math.min(0.14, currentAudio.duration * 0.04)
      const effectiveDur = Math.max(0.15, currentAudio.duration - leadPad - trailPad)
      const effectiveTime = Math.max(0, currentAudio.currentTime - leadPad)
      const progress = Math.min(1.0, Math.max(0.0, effectiveTime / effectiveDur))

      // Find token whose [startFrac, endFrac] window contains current audio progress
      let matchedIdx = tokenTimeline.value.length - 1
      for (let i = 0; i < tokenTimeline.value.length; i++) {
        if (progress <= tokenTimeline.value[i].endFrac) {
          matchedIdx = i
          break
        }
      }

      if (matchedIdx !== props.activeWordIndex) {
        emit('update:activeWordIndex', matchedIdx)
      }
      return
    }

    // Mode B: Weighted natural Khmer cadence fallback (when Web Speech API is used or before duration metadata loads)
    const totalWeights = tokenTimeline.value.reduce((acc, item) => acc + item.weight, 0) || 1
    const estimatedTotalMs = (totalWeights * 195) / Math.max(0.5, rate.value)
    const elapsedMs = performance.now() - fallbackStartTime
    const progress = Math.min(1.0, fallbackStartOffsetFrac + elapsedMs / Math.max(400, estimatedTotalMs))

    let matchedIdx = tokenTimeline.value.length - 1
    for (let i = 0; i < tokenTimeline.value.length; i++) {
      if (progress <= tokenTimeline.value[i].endFrac) {
        matchedIdx = i
        break
      }
    }

    if (matchedIdx !== props.activeWordIndex) {
      emit('update:activeWordIndex', matchedIdx)
    }

    if (progress >= 1.0 && !currentAudio) {
      clearInterval(highlightInterval)
      highlightInterval = null
    }
  }, 30)
}

const resumeHighlighting = () => {
  startHighlighting(props.activeWordIndex >= 0 ? props.activeWordIndex : 0)
}

// Start Reading Playback
const startSpeech = async () => {
  if (!props.text) {
    speakAccessibility('មិនទាន់មានអត្ថបទសម្រាប់អាននៅឡើយទេ')
    return
  }
  
  const azureKey = localStorage.getItem('songkhem_azure_tts_key')
  const azureEndpoint = localStorage.getItem('songkhem_azure_tts_endpoint') || 'https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1'

  const provider = 'neural-khmer'
  const apiKey = azureKey
  const endpoint = azureEndpoint

  // Resume if paused
  if (isPaused.value) {
    if (currentAudio) {
      currentAudio.play()
    } else if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume()
    }
    isPaused.value = false
    isSpeaking.value = true
    resumeHighlighting()
    triggerHaptic(40)
    speakAccessibility('បន្តការអាន')
    return
  }

  stopSpeech()
  isSpeaking.value = true
  isPaused.value = false
  triggerHaptic([60, 40])
  speakAccessibility('ចាប់ផ្តើមអាន...')

  // Khmer Neural TTS (Local KhmerNeuralTTS Engine -> Azure Key -> Cloud Proxy -> Web Speech Fallback)
  if (provider === 'neural-khmer') {
    try {
      const selectedVoice = voices.value.find(v => v.name === selectedVoiceName.value)
      const voiceName = selectedVoice ? selectedVoice.name : 'km-KH-PisethNeural'
      const gender = selectedVoice?.gender || 'Male'

      // iOS Safari / iPhone Autoplay Fix: instantiate & unlock Audio element synchronously on user tap
      const unlockedAudio = new Audio()
      unlockedAudio.preload = 'auto'
      unlockedAudio.load()
      currentAudio = unlockedAudio

      const cacheVariantKey = `${voiceName}|v2|pace:${isAssistivePacingActive.value ? 1 : 0}|lex:${lexiconRevision.value}`
      let audioUrl = getTtsCache(props.text, cacheVariantKey, 1.0)
      if (!audioUrl) {
        if (apiKey && voiceName !== 'km-KH-VitsOffline') {
          audioUrl = await synthesizeTextAzureTTS(props.text, apiKey, endpoint, 1.0, 1.0, voiceName, gender)
        } else {
          try {
            audioUrl = await synthesizeLocalKhmerTTS(props.text, voiceName, 1.0, {
              assistivePacing: isAssistivePacingActive.value
            })
          } catch (localErr) {
            if (CLOUD_API_AVAILABLE) {
              audioUrl = await cloudTts(props.text, voiceName)
            } else {
              throw localErr
            }
          }
        }
        setTtsCache(props.text, cacheVariantKey, 1.0, audioUrl)
      }

      unlockedAudio.src = audioUrl
      unlockedAudio.playbackRate = rate.value
      unlockedAudio.volume = volume.value
      
      unlockedAudio.onended = () => {
        stopSpeech()
        speakAccessibility('ការអានអត្ថបទបានបញ្ចប់')
      }
      await unlockedAudio.play()
      startHighlighting(0)
      return
    } catch (error) {
      console.error('Neural Khmer TTS error, falling back to Web Speech:', error)
      isSpeaking.value = false
      fallbackWebSpeech()
      return
    }
  }

  // Fallback: Web Speech API
  fallbackWebSpeech()
}

const speakSingleWord = async (word) => {
  if (!word) return
  try {
    const previewAudio = new Audio()
    previewAudio.preload = 'auto'
    previewAudio.load()
    const voiceName = selectedVoiceName.value || 'km-KH-PisethNeural'
    const url = await synthesizeLocalKhmerTTS(word, voiceName, 1.0, { assistivePacing: false })
    previewAudio.src = url
    previewAudio.volume = volume.value
    await previewAudio.play()
  } catch (_) {}
}

const fallbackWebSpeech = () => {
  stopSpeech()
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
      const utterance = new SpeechSynthesisUtterance(props.text)
      const synthVoices = synth.getVoices ? synth.getVoices() : []
      const realVoice = (synthVoices || []).find(v => v.name === selectedVoiceName.value) || 
                        (synthVoices || []).find(v => (v.lang || '').toLowerCase().startsWith('km') || (v.name || '').toLowerCase().includes('khmer'))
      if (realVoice) {
        utterance.voice = realVoice
      }
      utterance.rate = rate.value
      utterance.volume = volume.value
      utterance.lang = 'km-KH'

      // Pitch adjustment for male vs female voice persona
      const currentVoice = voices.value.find(v => v.name === selectedVoiceName.value)
      if (currentVoice?.gender === 'Female') {
        utterance.pitch = 1.18
      } else if (currentVoice?.gender === 'Male') {
        utterance.pitch = 0.92
      } else {
        utterance.pitch = 1.0
      }
      
      utterance.onend = () => { stopSpeech() }
      utterance.onerror = () => { stopSpeech() }
      synth.speak(utterance)
    } catch (e) {
      console.warn('SpeechSynthesis error:', e)
    }
  }
  startHighlighting(0)
}

const pauseSpeech = () => {
  if (!isSpeaking.value) return
  
  if (currentAudio) {
    currentAudio.pause()
  } else if (typeof window !== 'undefined' && window.speechSynthesis) {
    try { window.speechSynthesis.pause() } catch (e) {}
  }
  
  isPaused.value = true
  isSpeaking.value = false
  if (highlightInterval) {
    clearInterval(highlightInterval)
    highlightInterval = null
  }
  triggerHaptic(40)
  speakAccessibility('បានផ្អាកការអាន')
}

const stopSpeech = () => {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try { window.speechSynthesis.cancel() } catch (e) {}
  }
  
  isSpeaking.value = false
  isPaused.value = false
  emit('update:activeWordIndex', -1)
  
  if (highlightInterval) {
    clearInterval(highlightInterval)
    highlightInterval = null
  }
}

const restartSpeech = () => {
  stopSpeech()
  startSpeech()
  triggerHaptic(50)
  speakAccessibility('អានឡើងវិញតាំងពីដើម')
}

// Seek to specific word (and sync audio playhead if playing/paused)
const seekToWord = (wordIndex) => {
  if (wordIndex < 0 || wordIndex >= tokens.value.length) return
  emit('update:activeWordIndex', wordIndex)
  const entry = tokenTimeline.value[wordIndex]
  if (entry && currentAudio && Number.isFinite(currentAudio.duration) && currentAudio.duration > 0.15) {
    const leadPad = Math.min(0.08, currentAudio.duration * 0.03)
    const trailPad = Math.min(0.14, currentAudio.duration * 0.04)
    const effectiveDur = Math.max(0.15, currentAudio.duration - leadPad - trailPad)
    currentAudio.currentTime = leadPad + entry.startFrac * effectiveDur
  }
  if (isSpeaking.value) {
    startHighlighting(wordIndex)
  }
}

// Jump relative words
const jumpWords = (delta) => {
  let next = Math.max(0, Math.min(tokens.value.length - 1, props.activeWordIndex + delta))
  seekToWord(next)
  triggerHaptic(30)
  speakAccessibility(delta > 0 ? 'រំលងទៅមុខ' : 'ថយក្រោយ')
}

// Canvas Visualizer
const drawVisualizer = () => {
  const canvas = canvasRef.value
  if (!canvas || !canvas.parentElement) return
  
  const ctx = canvas.getContext('2d')
  const width = canvas.width = canvas.parentElement.clientWidth || 360
  const height = canvas.height = 42
  
  ctx.clearRect(0, 0, width, height)
  
  const waveCount = 3
  let baseRgba = '0, 82, 204'
  if (typeof window !== 'undefined') {
    const theme = document.documentElement.getAttribute('data-theme')
    if (theme === 'contrast') {
      baseRgba = '251, 191, 36'
    } else if (theme === 'dark') {
      baseRgba = '59, 130, 246'
    }
  }

  const colors = [
    `rgba(${baseRgba}, 0.9)`,
    `rgba(${baseRgba}, 0.65)`,
    `rgba(${baseRgba}, 0.35)`
  ]
  
  waveOffset.value += isSpeaking.value ? 0.09 : 0.015
  
  for (let i = 0; i < waveCount; i++) {
    ctx.beginPath()
    ctx.lineWidth = isSpeaking.value ? 2.5 : 1.5
    ctx.strokeStyle = colors[i]
    
    const amplitude = isSpeaking.value 
      ? (7 + i * 4) * (0.8 + Math.sin(waveOffset.value * 2) * 0.25)
      : 2 + i * 0.8
      
    const frequency = 0.018 - i * 0.003
    
    for (let x = 0; x < width; x++) {
      const y = height / 2 + Math.sin(x * frequency + waveOffset.value + i * 3) * amplitude
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  
  animationId = requestAnimationFrame(drawVisualizer)
}

onMounted(() => {
  loadVoices()
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = loadVoices
  }
  drawVisualizer()
})

onUnmounted(() => {
  stopSpeech()
  if (animationId) cancelAnimationFrame(animationId)
})

watch(() => props.text, (newText) => {
  prepareTokens(newText)
  stopSpeech()
}, { immediate: true })

const togglePlayback = () => {
  if (isSpeaking.value) pauseSpeech()
  else startSpeech()
}

const cycleSpeed = (direction = 1) => {
  const speeds = [0.75, 1.0, 1.25, 1.5, 2.0]
  const currentIdx = speeds.indexOf(rate.value)
  let nextIdx = (currentIdx === -1 ? 1 : currentIdx) + direction
  if (nextIdx >= speeds.length) nextIdx = speeds.length - 1
  if (nextIdx < 0) nextIdx = 0
  setSpeed(speeds[nextIdx])
}

defineExpose({
  togglePlayback,
  startSpeech,
  pauseSpeech,
  stopPlayback: stopSpeech,
  seekToWord,
  skipWords: jumpWords,
  cycleSpeed,
  isSpeaking,
  isPaused
})
</script>

<template>
  <div class="audio-deck glass-card" role="region" :aria-label="t('navReader')">
    <!-- Visualizer Line & Audio Status Indicator -->
    <div class="visualizer-header-bar">
      <div class="visualizer-slot">
        <canvas ref="canvasRef" class="visualizer-canvas"></canvas>
      </div>

      <div class="audio-status-pill khmer-font">
        <span v-if="isSpeaking" class="audio-state-tag tag-playing">
          <span class="live-dot" aria-hidden="true"></span>
          <span>{{ t('readingStatusPlaying') }}</span>
        </span>
        <span v-else-if="isPaused" class="audio-state-tag tag-paused">
          <span>{{ t('readingStatusPaused') }}</span>
        </span>
        <span v-else class="audio-state-tag tag-idle">
          <span>{{ t('readingStatusReady') }}</span>
        </span>
      </div>
    </div>

    <!-- Main Tactile Player Controls -->
    <div class="deck-primary-controls">
      <!-- Primary Play / Pause Hero Button — full width, 72px -->
      <button 
        type="button" 
        class="deck-btn-hero khmer-font" 
        :class="{ 'btn-hero-playing': isSpeaking }"
        @click="togglePlayback" 
        :disabled="!text"
        :aria-label="isSpeaking ? t('pauseSpeech') + ' (Space)' : t('playSpeech') + ' (Space)'"
        :title="isSpeaking ? t('pauseSpeech') + ' (Space)' : t('playSpeech') + ' (Space)'"
      >
        <Pause v-if="isSpeaking" :size="32" fill="currentColor" />
        <Play v-else :size="32" fill="currentColor" />
        <span class="hero-play-label">{{ isSpeaking ? t('pauseSpeech') : t('playSpeech') }}</span>
        <kbd class="deck-kbd">Space</kbd>
      </button>

      <!-- Secondary: Jump back / Restart / Stop / Jump forward -->
      <div class="deck-secondary-row">
        <!-- Jump Back 10 words -->
        <button 
          type="button" 
          class="deck-btn btn-jump" 
          @click="jumpWords(-10)" 
          :disabled="!text"
          :aria-label="t('jumpBack10')"
          :title="t('jumpBack10')"
        >
          <SkipBack :size="22" />
          <span>{{ t('jumpBack10') }}</span>
          <span class="jump-tag">−10</span>
        </button>

        <!-- Replay from Start -->
        <button 
          type="button" 
          class="deck-btn btn-secondary-tool" 
          @click="restartSpeech" 
          :disabled="!text"
          :aria-label="t('replayFromStart')"
          :title="t('replayFromStart')"
        >
          <RotateCcw :size="22" />
          <span>{{ t('replayFromStart') }}</span>
        </button>

        <!-- Jump Forward 10 words -->
        <button 
          type="button" 
          class="deck-btn btn-jump" 
          @click="jumpWords(10)" 
          :disabled="!text"
          :aria-label="t('jumpForward10')"
          :title="t('jumpForward10')"
        >
          <SkipForward :size="22" />
          <span>{{ t('jumpForward10') }}</span>
          <span class="jump-tag">+10</span>
        </button>
      </div>
    </div>

    <!-- Secondary Audio Controls (Speed Stepper & Voice Selector) -->
    <div class="deck-secondary-controls">
      <!-- Speed Presets Stepper -->
      <div class="speed-stepper-row" role="group" :aria-label="t('readingSpeed')">
        <span class="stepper-label khmer-font">{{ t('readingSpeed') }}</span>
        <div class="speed-pills">
          <button 
            v-for="s in speedPresets" 
            :key="s"
            type="button" 
            class="speed-pill-btn" 
            :class="{ 'speed-active': rate === s }"
            @click="setSpeedPreset(s)"
            :aria-label="`${t('readingSpeed')} ${s}${t('speedTimes')}`"
          >
            {{ s }}x
          </button>
        </div>
      </div>

      <!-- Voice Selector -->
      <div class="voice-picker-slot">
        <label for="tts-voice-select" class="voice-label khmer-font">
          <Music2 :size="16" class="text-accent" />
          <span>{{ t('readingVoice') }}</span>
        </label>
        <select id="tts-voice-select" v-model="selectedVoiceName" class="accessible-voice-select khmer-font">
          <option v-for="voice in voices" :key="voice.name" :value="voice.name">
            {{ voice.label }}
          </option>
        </select>
      </div>

      <!-- Custom Khmer TTS Feature Row: Smart Assistive Pacing & G2P Phoneme Inspector -->
      <div class="custom-tts-feature-row">
        <button
          type="button"
          class="tts-feature-pill khmer-font"
          :class="{ 'feature-pill-active': isAssistivePacingActive }"
          @click="toggleAssistivePacing"
          :aria-pressed="isAssistivePacingActive"
          title="បន្ថែមដង្ហើមឈប់ខ្លីៗមុន និងក្រោយលេខ តម្លៃថ្នាំ និងកាលបរិច្ឆេទ"
        >
          <Sparkles :size="15" />
          <span>បន្ថយល្បឿនត្រង់លេខ/តម្លៃថ្នាំ (Smart Pacing)</span>
        </button>

        <button
          type="button"
          class="tts-feature-pill khmer-font"
          :class="{ 'feature-pill-active': showG2pInspector }"
          @click="showG2pInspector = !showG2pInspector"
          :aria-expanded="showG2pInspector"
        >
          <Sliders :size="15" />
          <span>ពិនិត្យសូរសៀងខ្មែរ G2P & IPA</span>
        </button>
      </div>

      <!-- Collapsible Khmer G2P & Phoneme X-Ray Inspector Card -->
      <div v-if="showG2pInspector" class="g2p-inspector-card" role="region" aria-label="Khmer G2P and Phoneme Inspector">
        <div class="g2p-header-row">
          <span class="g2p-title khmer-font">🧬 ប្រព័ន្ធវិភាគសូរសៀងខ្មែរ (Khmer G2P & Closed-Syllable IPA)</span>
          <span class="g2p-model-badge">{{ activeModelBadge }}</span>
        </div>

        <!-- 1. Normalized Spoken Khmer Output -->
        <div class="g2p-section">
          <div class="g2p-section-label khmer-font">១. អត្ថបទបំប្លែងសម្រាប់អាន (Normalized Spoken Khmer)៖</div>
          <div class="g2p-normalized-box khmer-font">
            {{ g2pAnalysis.normalizedText || 'សូមស្កេន ឬបញ្ចូលអត្ថបទដើម្បីមើលការបំប្លែងលេខ រូបិយប័ណ្ណ និងពាក្យបច្ចេកទេស...' }}
          </div>
        </div>

        <!-- 2. Word-by-Word A/O Register & Closed-Syllable IPA Breakdown -->
        <div v-if="g2pAnalysis.wordBreakdown.length > 0" class="g2p-section">
          <div class="g2p-section-label khmer-font">
            ២. ការបំបែកព្យាង្គ និងសូរសៀងអន្តរជាតិ (ចុចលើពាក្យដើម្បីស្តាប់សូរអាន)៖
          </div>
          <div class="g2p-chips-grid">
            <button
              v-for="(item, idx) in g2pAnalysis.wordBreakdown"
              :key="idx"
              type="button"
              class="g2p-word-chip"
              @click="speakSingleWord(item.word)"
              :title="`ចុចដើម្បីស្តាប់ពាក្យ៖ ${item.word} (${item.ipa})`"
            >
              <span class="chip-khmer khmer-font">{{ item.word }}</span>
              <span class="chip-ipa">/{{ item.ipa }}/</span>
              <span class="chip-register" :class="item.register.startsWith('អ-') ? 'reg-a' : 'reg-o'">
                {{ item.register }}
              </span>
            </button>
          </div>
        </div>

        <!-- 3. Custom Medical / Pali-Sanskrit Pronunciation Lexicon Tuner -->
        <div class="g2p-section g2p-lexicon-tuner">
          <div class="g2p-section-label khmer-font">
            ៣. បង្រៀនសូរអានពាក្យពិបាក ឬពាក្យបច្ចេកទេសពេទ្យថ្មី (Custom Lexicon Tuner)៖
          </div>
          <div class="lexicon-form-row">
            <input
              v-model="customWordInput"
              type="text"
              class="lexicon-input khmer-font"
              placeholder="ពាក្យដើម (ឧ. អ៊ីប៊ុយប្រូហ្វែន)"
              aria-label="ពាក្យដើម"
            />
            <input
              v-model="customRespellInput"
              type="text"
              class="lexicon-input khmer-font"
              placeholder="សូរអាន (ឧ. អ៊ី-ប៊ុយ-ប្រូ-ហ្វែន)"
              aria-label="សូរអាន"
            />
            <button
              type="button"
              class="lexicon-save-btn khmer-font"
              @click="addCustomLexiconOverride"
              :disabled="!customWordInput.trim() || !customRespellInput.trim()"
            >
              រក្សាទុកសូរអាន
            </button>
          </div>
          <div v-if="lexiconSavedStatus" class="lexicon-status-msg khmer-font" role="status">
            ✓ {{ lexiconSavedStatus }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./TtsPanel.css"></style>
