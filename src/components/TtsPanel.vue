<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, inject } from 'vue'
import { Play, Pause, Square, RotateCcw, Volume2, Sparkles, Sliders, Music2 } from 'lucide-vue-next'
import { synthesizeTextAzureTTS } from '../services/tts'
import { getTtsCache, setTtsCache } from '../services/cache'

const props = defineProps({
  text: {
    type: String,
    default: ''
  }
})

const speakAccessibility = inject('speakAccessibility', () => {})

// Audio & Synthesis State
const voices = ref([])
const selectedVoiceName = ref('')
const rate = ref(1.0)
const volume = ref(1.0)
const isSpeaking = ref(false)
const isPaused = ref(false)

// Highlighting State
const words = ref([])
const activeWordIndex = ref(-1)
const wordsContainerRef = ref(null)
let highlightInterval = null
let currentAudio = null

// Canvas Visualizer
const canvasRef = ref(null)
let animationId = null
const waveOffset = ref(0)

// Quick speed presets
const speedPresets = [0.8, 1.0, 1.2, 1.5]

const setSpeedPreset = (val) => {
  rate.value = val
  if (currentAudio) currentAudio.playbackRate = val
  speakAccessibility(`ប្តូរល្បឿនអានទៅ ${val} ដង`)
}

// Live audio updates
watch(rate, (newRate) => {
  if (currentAudio) currentAudio.playbackRate = newRate
})

watch(volume, (newVol) => {
  if (currentAudio) currentAudio.volume = newVol
})

// Load speech synthesis voices
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
    const availableVoices = window.speechSynthesis.getVoices() || []
    voices.value = availableVoices.map(v => ({ 
      name: v.name, 
      lang: v.lang, 
      label: `${v.name} (${v.lang})`, 
      gender: 'Default' 
    }))
    
    // Find Khmer voice if available
    const khmerVoice = availableVoices.find(v => {
      const l = (v.lang || '').toLowerCase()
      const n = (v.name || '').toLowerCase()
      return l.includes('km') || l.includes('khmer') || n.includes('khmer')
    })

    if (khmerVoice) {
      selectedVoiceName.value = khmerVoice.name
    } else if (availableVoices.length > 0) {
      const defaultVoice = availableVoices.find(v => v.default) || availableVoices[0]
      if (defaultVoice && !selectedVoiceName.value) {
        selectedVoiceName.value = defaultVoice.name
      }
    }
  } catch (error) {
    console.warn('Speech synthesis getVoices error:', error)
    voices.value = []
  }
}

// Split Khmer text into visual segments for highlighting
const prepareWords = (textToSplit) => {
  if (!textToSplit) {
    words.value = []
    activeWordIndex.value = -1
    return
  }
  
  // Split cleanly by whitespace without breaking complex Khmer clusters
  const tokens = textToSplit.trim().split(/\s+/).filter(w => w.length > 0)
  words.value = tokens.map((w, idx) => ({ text: w, id: `token-${idx}-${Date.now()}` }))
}

// Auto-scroll active word into view
const scrollToActiveWord = async () => {
  await nextTick()
  if (!wordsContainerRef.value || activeWordIndex.value === -1) return
  const activeEl = wordsContainerRef.value.querySelector('.word-active')
  if (activeEl) {
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }
}

// Word-by-word visual highlight simulation
const startHighlighting = () => {
  activeWordIndex.value = 0
  scrollToActiveWord()
  
  const durationPerWord = Math.max(350, Math.round(750 / rate.value))
  
  if (highlightInterval) clearInterval(highlightInterval)
  highlightInterval = setInterval(() => {
    if (activeWordIndex.value < words.value.length - 1) {
      activeWordIndex.value++
      scrollToActiveWord()
    } else {
      if (highlightInterval) {
        clearInterval(highlightInterval)
        highlightInterval = null
      }
    }
  }, durationPerWord)
}

const resumeHighlighting = () => {
  const durationPerWord = Math.max(350, Math.round(750 / rate.value))
  if (highlightInterval) clearInterval(highlightInterval)
  highlightInterval = setInterval(() => {
    if (activeWordIndex.value < words.value.length - 1) {
      activeWordIndex.value++
      scrollToActiveWord()
    } else {
      if (highlightInterval) {
        clearInterval(highlightInterval)
        highlightInterval = null
      }
    }
  }, durationPerWord)
}

// Playback Trigger
const startSpeech = async () => {
  if (!props.text) {
    speakAccessibility('មិនទាន់មានអត្ថបទសម្រាប់អាននៅឡើយទេ។')
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

  // Azure Neural TTS
  if (provider === 'azure-tts' && apiKey) {
    if (isPaused.value && currentAudio) {
      currentAudio.play()
      isPaused.value = false
      isSpeaking.value = true
      resumeHighlighting()
      speakAccessibility('បន្តការអាន')
      return
    }

    stopSpeech()
    isSpeaking.value = true
    isPaused.value = false
    speakAccessibility('ចាប់ផ្តើមអានអត្ថបទ...')
    
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
        speakAccessibility('ការអានអត្ថបទបានបញ្ចប់។')
      }
      currentAudio.play()
      startHighlighting()
    } catch (error) {
      console.error(error)
      isSpeaking.value = false
      fallbackWebSpeech()
    }
    return
  }

  // Fallback: Web Speech API
  fallbackWebSpeech()
}

const fallbackWebSpeech = () => {
  if (isPaused.value && typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.resume()
    isPaused.value = false
    isSpeaking.value = true
    resumeHighlighting()
    return
  }

  stopSpeech()
  isSpeaking.value = true
  isPaused.value = false

  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  if (synth) {
    try {
      const utterance = new SpeechSynthesisUtterance(props.text)
      const voice = (voices.value || []).find(v => v?.name === selectedVoiceName.value)
      if (voice) utterance.voice = voice
      utterance.rate = rate.value
      utterance.volume = volume.value
      
      utterance.onend = () => {
        stopSpeech()
      }
      utterance.onerror = () => {
        stopSpeech()
      }
      
      synth.speak(utterance)
    } catch (error) {
      console.warn('SpeechSynthesis execution warning:', error)
    }
  }
  
  startHighlighting()
}

const pauseSpeech = () => {
  if (!isSpeaking.value) return
  
  if (currentAudio) {
    currentAudio.pause()
  } else if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.pause()
    } catch (e) {}
  }
  
  isPaused.value = true
  isSpeaking.value = false
  
  if (highlightInterval) {
    clearInterval(highlightInterval)
    highlightInterval = null
  }
  speakAccessibility('បានផ្អាកការអាន')
}

const stopSpeech = () => {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel()
    } catch (e) {}
  }
  
  isSpeaking.value = false
  isPaused.value = false
  activeWordIndex.value = -1
  
  if (highlightInterval) {
    clearInterval(highlightInterval)
    highlightInterval = null
  }
}

const restartSpeech = () => {
  stopSpeech()
  startSpeech()
  speakAccessibility('អានឡើងវិញតាំងពីដើម')
}

// Canvas Wave Visualizer Animation
const drawVisualizer = () => {
  const canvas = canvasRef.value
  if (!canvas || !canvas.parentElement) return
  
  const ctx = canvas.getContext('2d')
  const width = canvas.width = canvas.parentElement.clientWidth || 400
  const height = canvas.height = 48
  
  ctx.clearRect(0, 0, width, height)
  
  const waveCount = 3
  const colors = [
    'rgba(245, 158, 11, 0.85)',  // Vibrant Warm Amber
    'rgba(251, 191, 36, 0.60)',  // Honey Gold
    'rgba(253, 230, 138, 0.35)'  // Soft Champagne Gold
  ]
  
  waveOffset.value += isSpeaking.value ? 0.08 : 0.01
  
  for (let i = 0; i < waveCount; i++) {
    ctx.beginPath()
    ctx.lineWidth = isSpeaking.value ? 2.5 : 1.5
    ctx.strokeStyle = colors[i]
    
    const amplitude = isSpeaking.value 
      ? (8 + i * 5) * (0.8 + Math.sin(waveOffset.value * 2) * 0.25)
      : 2 + i * 0.8
      
    const frequency = 0.016 - i * 0.003
    
    for (let x = 0; x < width; x++) {
      const y = height / 2 + Math.sin(x * frequency + waveOffset.value + i * 3) * amplitude
      if (x === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
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
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})

watch(() => props.text, (newText) => {
  prepareWords(newText)
  if (typeof stopSpeech === 'function') {
    stopSpeech()
  }
}, { immediate: true })

const togglePlayback = () => {
  if (isSpeaking.value) {
    pauseSpeech()
  } else {
    startSpeech()
  }
}

defineExpose({
  togglePlayback,
  startSpeech,
  pauseSpeech,
  stopPlayback: stopSpeech
})
</script>

<template>
  <div class="tts-card glass-card">
    <!-- Header Bar -->
    <div class="tts-header-bar">
      <div class="header-left">
        <div class="header-icon-box bg-brand">
          <Volume2 :size="20" />
        </div>
        <div class="title-meta">
          <h2 class="card-title khmer-font">អានអត្ថបទជាសំឡេង (TTS)</h2>
          <span class="tts-subtitle khmer-font">Khmer Speech Synthesizer</span>
        </div>
      </div>

      <div class="header-right">
        <span v-if="isSpeaking" class="badge badge-brand khmer-font">
          <span class="live-dot"></span>
          <span>កំពុងអាន</span>
        </span>
        <span v-else-if="isPaused" class="badge badge-brand khmer-font">
          <span>បានផ្អាក</span>
        </span>
        <span v-else class="badge badge-slate khmer-font">
          <span>រង់ចាំ</span>
        </span>
      </div>
    </div>

    <!-- Speech Karaoke Highlighting Workspace with Auto-Scroll -->
    <div class="karaoke-viewer" ref="wordsContainerRef" aria-live="polite" aria-label="ផ្ទាំងរំលេចពាក្យពេលអាន">
      <div v-if="words.length === 0" class="viewer-empty">
        <Sparkles :size="28" class="icon-subtle" />
        <p class="khmer-font">អត្ថបទនឹងបង្ហាញរំលេចពាក្យម្តងមួយៗ (Karaoke Highlight) នៅទីនេះពេលចាប់ផ្តើមអាន។</p>
      </div>
      <div v-else class="words-flow khmer-font">
        <span 
          v-for="(word, index) in words" 
          :key="word.id"
          class="word-token"
          :class="{ 'word-active': index === activeWordIndex }"
        >
          {{ word.text }}
        </span>
      </div>
    </div>

    <!-- Dynamic Wave Visualizer -->
    <div class="visualizer-container" aria-hidden="true">
      <canvas ref="canvasRef" class="visualizer-canvas"></canvas>
    </div>

    <!-- Tactile Media Player Deck -->
    <div class="media-deck">
      <!-- Voice Config Field -->
      <div class="voice-picker-row">
        <label for="voice-select" class="picker-label khmer-font">
          <Music2 :size="16" class="text-accent" />
          <span>ជ្រើសរើសសំឡេងអាន៖</span>
        </label>
        <select id="voice-select" v-model="selectedVoiceName" class="accessible-select khmer-font">
          <option v-for="voice in voices" :key="voice.name" :value="voice.name">
            {{ voice.label }}
          </option>
        </select>
      </div>

      <!-- Quick Speed Preset Pills -->
      <div class="speed-presets-row">
        <span class="speed-label khmer-font">ល្បឿនអានរហ័ស៖</span>
        <div class="preset-buttons">
          <button 
            v-for="p in speedPresets" 
            :key="p"
            type="button"
            class="preset-pill"
            :class="{ 'preset-active': rate === p }"
            @click="setSpeedPreset(p)"
            :aria-label="`ល្បឿន ${p} ដង`"
          >
            {{ p }}x
          </button>
        </div>
      </div>

      <!-- Live Sliders for Speed and Volume -->
      <div class="sliders-grid">
        <div class="slider-block">
          <div class="slider-header">
            <span class="khmer-font slider-title">ល្បឿនអាន (Speed):</span>
            <span class="slider-val">{{ rate.toFixed(1) }}x</span>
          </div>
          <input 
            type="range" 
            min="0.5" 
            max="2.0" 
            step="0.1" 
            v-model.number="rate" 
            class="accessible-range" 
            aria-label="កែសម្រួលល្បឿនអាន"
          />
        </div>

        <div class="slider-block">
          <div class="slider-header">
            <span class="khmer-font slider-title">កម្រិតសំឡេង (Volume):</span>
            <span class="slider-val">{{ Math.round(volume * 100) }}%</span>
          </div>
          <input 
            type="range" 
            min="0.0" 
            max="1.0" 
            step="0.05" 
            v-model.number="volume" 
            class="accessible-range" 
            aria-label="កែសម្រួលកម្រិតសំឡេង"
          />
        </div>
      </div>

      <!-- Main Playback Actions (Accessible Min 48px Target) -->
      <div class="playback-controls-row">
        <!-- Play / Pause Main CTA -->
        <button 
          v-if="!isSpeaking" 
          type="button"
          class="btn btn-primary btn-playback-main khmer-font" 
          @click="startSpeech" 
          :disabled="!text"
          aria-label="ចាប់ផ្តើមអានអត្ថបទជាសំឡេង (Space)"
          title="ចាប់ផ្តើមអាន (Space)"
        >
          <Play :size="22" fill="currentColor" />
          <span>អានអត្ថបទ (Play)</span>
          <kbd class="kbd-hint">Space</kbd>
        </button>

        <button 
          v-else 
          type="button"
          class="btn btn-warning btn-playback-main khmer-font" 
          @click="pauseSpeech"
          aria-label="ផ្អាកការអានជាសំឡេង (Space)"
          title="ផ្អាក (Space)"
        >
          <Pause :size="22" fill="currentColor" />
          <span>ផ្អាក (Pause)</span>
          <kbd class="kbd-hint">Space</kbd>
        </button>

        <!-- Replay from Start -->
        <button 
          type="button"
          class="btn btn-secondary btn-deck-tool" 
          @click="restartSpeech" 
          :disabled="!text"
          aria-label="អានឡើងវិញពីដើម"
          title="អានឡើងវិញ"
        >
          <RotateCcw :size="18" />
        </button>

        <!-- Stop Playback -->
        <button 
          type="button"
          class="btn btn-outline btn-deck-tool btn-stop" 
          @click="stopSpeech" 
          :disabled="!isSpeaking && !isPaused && activeWordIndex === -1"
          aria-label="បញ្ឈប់ការអាន (Esc)"
          title="បញ្ឈប់ (Esc)"
        >
          <Square :size="18" fill="currentColor" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./TtsPanel.css"></style>
