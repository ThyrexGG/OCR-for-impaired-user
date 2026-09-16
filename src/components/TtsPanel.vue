<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, inject } from 'vue'
import { 
  Play, Pause, Square, RotateCcw, Volume2, Sparkles, 
  Sliders, Music2, SkipBack, SkipForward, Repeat, Camera
} from 'lucide-vue-next'
import { synthesizeTextAzureTTS } from '../services/tts'
import { getTtsCache, setTtsCache } from '../services/cache'

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

// Load speech voices
const loadVoices = () => {
  if (typeof window === 'undefined') return
  
  if (import.meta.env.VITE_AZURE_TTS_API_KEY) {
    voices.value = [
      { name: 'km-KH-PisethNeural', lang: 'km-KH', label: 'Piseth (សំឡេងប្រុស)', gender: 'Male' },
      { name: 'km-KH-SreymomNeural', lang: 'km-KH', label: 'Sreymom (សំឡេងស្រី)', gender: 'Female' }
    ]
    if (!selectedVoiceName.value || !voices.value.find(v => v.name === selectedVoiceName.value)) {
      selectedVoiceName.value = 'km-KH-PisethNeural'
    }
    return
  }

  if (!window.speechSynthesis) return
  
  try {
    const available = window.speechSynthesis.getVoices() || []
    voices.value = available.map(v => ({ 
      name: v.name, 
      lang: v.lang, 
      label: `${v.name} (${v.lang})`, 
      gender: 'Default' 
    }))
    
    const khmerVoice = available.find(v => {
      const l = (v.lang || '').toLowerCase()
      const n = (v.name || '').toLowerCase()
      return l.includes('km') || l.includes('khmer') || n.includes('khmer')
    })

    if (khmerVoice) {
      selectedVoiceName.value = khmerVoice.name
    } else if (available.length > 0 && !selectedVoiceName.value) {
      selectedVoiceName.value = available[0].name
    }
  } catch (error) {
    console.warn('Speech synthesis getVoices error:', error)
  }
}

// Tokenize text into words
const prepareTokens = (rawText) => {
  if (!rawText) {
    tokens.value = []
    emit('update:activeWordIndex', -1)
    return
  }
  const words = rawText.trim().split(/\s+/).filter(w => w.length > 0)
  tokens.value = words
}

// Word-by-word timing synchronization
const startHighlighting = (startIndex = 0) => {
  emit('update:activeWordIndex', startIndex)
  
  const durationPerWord = Math.max(280, Math.round(700 / rate.value))
  
  if (highlightInterval) clearInterval(highlightInterval)
  highlightInterval = setInterval(() => {
    if (props.activeWordIndex < tokens.value.length - 1) {
      emit('update:activeWordIndex', props.activeWordIndex + 1)
    } else {
      if (highlightInterval) {
        clearInterval(highlightInterval)
        highlightInterval = null
      }
    }
  }, durationPerWord)
}

const resumeHighlighting = () => {
  const durationPerWord = Math.max(280, Math.round(700 / rate.value))
  if (highlightInterval) clearInterval(highlightInterval)
  highlightInterval = setInterval(() => {
    if (props.activeWordIndex < tokens.value.length - 1) {
      emit('update:activeWordIndex', props.activeWordIndex + 1)
    } else {
      if (highlightInterval) {
        clearInterval(highlightInterval)
        highlightInterval = null
      }
    }
  }, durationPerWord)
}

// Start Reading Playback
const startSpeech = async () => {
  if (!props.text) {
    speakAccessibility('មិនទាន់មានអត្ថបទសម្រាប់អាននៅឡើយទេ')
    return
  }
  
  let provider = 'web-speech'
  let apiKey = ''
  let endpoint = ''

  if (import.meta.env.VITE_AZURE_TTS_API_KEY) {
    provider = 'azure-tts'
    apiKey = import.meta.env.VITE_AZURE_TTS_API_KEY
    endpoint = import.meta.env.VITE_AZURE_TTS_ENDPOINT
  }

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

  // Azure Neural TTS
  if (provider === 'azure-tts' && apiKey) {
    try {
      const selectedVoice = voices.value.find(v => v.name === selectedVoiceName.value)
      const voiceName = selectedVoice ? selectedVoice.name : 'km-KH-PisethNeural'
      const gender = selectedVoice?.gender || 'Male'

      let audioUrl = getTtsCache(props.text, voiceName, 1.0)
      if (!audioUrl) {
        audioUrl = await synthesizeTextAzureTTS(props.text, apiKey, endpoint, 1.0, 1.0, voiceName, gender)
        setTtsCache(props.text, voiceName, 1.0, audioUrl)
      }

      currentAudio = new Audio(audioUrl)
      currentAudio.playbackRate = rate.value
      currentAudio.volume = volume.value
      
      currentAudio.onended = () => {
        stopSpeech()
        speakAccessibility('ការអានអត្ថបទបានបញ្ចប់')
      }
      currentAudio.play()
      startHighlighting(0)
      return
    } catch (error) {
      console.error(error)
      isSpeaking.value = false
      fallbackWebSpeech()
      return
    }
  }

  // Fallback: Web Speech API
  fallbackWebSpeech()
}

const fallbackWebSpeech = () => {
  stopSpeech()
  isSpeaking.value = true
  isPaused.value = false

  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  if (synth) {
    try {
      const utterance = new SpeechSynthesisUtterance(props.text)
      const synthVoices = synth.getVoices ? synth.getVoices() : []
      const realVoice = (synthVoices || []).find(v => v.name === selectedVoiceName.value) || 
                        (synthVoices || []).find(v => (v.lang || '').toLowerCase().includes('km'))
      if (realVoice) {
        utterance.voice = realVoice
      }
      utterance.rate = rate.value
      utterance.volume = volume.value
      utterance.lang = 'km-KH'
      
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

// Seek to specific word
const seekToWord = (wordIndex) => {
  if (wordIndex < 0 || wordIndex >= tokens.value.length) return
  emit('update:activeWordIndex', wordIndex)
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
  const colors = [
    'rgba(245, 158, 11, 0.9)',
    'rgba(251, 191, 36, 0.65)',
    'rgba(253, 230, 138, 0.35)'
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

defineExpose({
  togglePlayback,
  startSpeech,
  pauseSpeech,
  stopPlayback: stopSpeech,
  seekToWord,
  isSpeaking,
  isPaused
})
</script>

<template>
  <div class="audio-deck glass-card" role="region" aria-label="ផ្ទាំងបញ្ជាការអានជាសំឡេង">
    <!-- Visualizer Line & Audio Status Indicator -->
    <div class="visualizer-header-bar">
      <div class="visualizer-slot">
        <canvas ref="canvasRef" class="visualizer-canvas"></canvas>
      </div>

      <div class="audio-status-pill khmer-font">
        <span v-if="isSpeaking" class="audio-state-tag tag-playing">
          <span class="live-dot" aria-hidden="true"></span>
          <span>កំពុងអាន...</span>
        </span>
        <span v-else-if="isPaused" class="audio-state-tag tag-paused">
          <span>បានផ្អាក</span>
        </span>
        <span v-else class="audio-state-tag tag-idle">
          <span>ត្រៀមអាន</span>
        </span>
      </div>
    </div>

    <!-- Main Tactile Player Controls -->
    <div class="deck-primary-controls">
      <!-- Jump Back 10 words -->
      <button 
        type="button" 
        class="deck-btn btn-jump" 
        @click="jumpWords(-10)" 
        :disabled="!text"
        aria-label="ថយក្រោយ ១០ ពាក្យ"
        title="ថយក្រោយ"
      >
        <SkipBack :size="20" />
        <span class="jump-tag">-10</span>
      </button>

      <!-- Primary Play / Pause Hero Button -->
      <button 
        type="button" 
        class="deck-btn-hero khmer-font" 
        :class="{ 'btn-hero-playing': isSpeaking }"
        @click="togglePlayback" 
        :disabled="!text"
        :aria-label="isSpeaking ? 'ផ្អាកការអាន (Space)' : 'ចាប់ផ្តើមអានជាសំឡេង (Space)'"
        :title="isSpeaking ? 'ផ្អាកការអាន (Space)' : 'ចាប់ផ្តើមអាន (Space)'"
      >
        <Pause v-if="isSpeaking" :size="32" fill="currentColor" />
        <Play v-else :size="32" fill="currentColor" />
        <span class="hero-play-label">{{ isSpeaking ? 'ផ្អាក (Pause)' : 'អានជាសំឡេង (PLAY)' }}</span>
        <kbd class="deck-kbd">Space</kbd>
      </button>

      <!-- Jump Forward 10 words -->
      <button 
        type="button" 
        class="deck-btn btn-jump" 
        @click="jumpWords(10)" 
        :disabled="!text"
        aria-label="ទៅមុខ ១០ ពាក្យ"
        title="ទៅមុខ"
      >
        <SkipForward :size="20" />
        <span class="jump-tag">+10</span>
      </button>

      <!-- Replay from Start -->
      <button 
        type="button" 
        class="deck-btn btn-secondary-tool" 
        @click="restartSpeech" 
        :disabled="!text"
        aria-label="អានឡើងវិញពីដើម"
        title="អានឡើងវិញពីដើម"
      >
        <RotateCcw :size="20" />
      </button>

      <!-- Stop Playback -->
      <button 
        type="button" 
        class="deck-btn btn-danger-tool" 
        @click="stopSpeech" 
        :disabled="!isSpeaking && !isPaused && activeWordIndex === -1"
        aria-label="បញ្ឈប់ការអាន (Esc)"
        title="បញ្ឈប់ការអាន (Esc)"
      >
        <Square :size="18" fill="currentColor" />
      </button>
    </div>

    <!-- Secondary Audio Controls (Speed Stepper & Voice Selector) -->
    <div class="deck-secondary-controls">
      <!-- Speed Presets Stepper -->
      <div class="speed-stepper-row" role="group" aria-label="ល្បឿនអាន">
        <span class="stepper-label khmer-font">ល្បឿនអាន៖</span>
        <div class="speed-pills">
          <button 
            v-for="s in speedPresets" 
            :key="s"
            type="button" 
            class="speed-pill-btn" 
            :class="{ 'speed-active': rate === s }"
            @click="setSpeedPreset(s)"
            :aria-label="`ល្បឿន ${s} ដង`"
          >
            {{ s }}x
          </button>
        </div>
      </div>

      <!-- Voice Selector -->
      <div class="voice-picker-slot">
        <label for="tts-voice-select" class="voice-label khmer-font">
          <Music2 :size="16" class="text-accent" />
          <span>សំឡេងអាន៖</span>
        </label>
        <select id="tts-voice-select" v-model="selectedVoiceName" class="accessible-voice-select khmer-font">
          <option v-for="voice in voices" :key="voice.name" :value="voice.name">
            {{ voice.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Bottom Action: Scan Another Document -->
    <div class="deck-bottom-actions">
      <button 
        type="button" 
        class="btn-deck-scan-again khmer-font" 
        @click="$emit('scan-again')"
        aria-label="ស្កេនឯកសារថ្មីមួយទៀត (Scan Another Document)"
      >
        <Camera :size="18" />
        <span>ស្កេនឯកសារថ្មី (Scan Another Document)</span>
      </button>
    </div>
  </div>
</template>

<style scoped src="./TtsPanel.css"></style>
