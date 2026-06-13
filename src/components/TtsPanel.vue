<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Play, Pause, Square, Volume2, Sparkles } from 'lucide-vue-next'
import { synthesizeTextAzureTTS } from '../services/tts'

const props = defineProps({
  text: {
    type: String,
    default: ''
  }
})

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
let highlightInterval = null

// Live Audio Controls
watch(rate, (newRate) => {
  if (currentAudio) currentAudio.playbackRate = newRate
})

watch(volume, (newVol) => {
  if (currentAudio) currentAudio.volume = newVol
})

// Audio Object for Google TTS
let currentAudio = null

// Canvas Audio Visualizer
const canvasRef = ref(null)
let animationId = null
const waveOffset = ref(0)

// Load speech synthesis voices
const loadVoices = () => {
  if (typeof window === 'undefined') return
  
  if (import.meta.env.VITE_AZURE_TTS_API_KEY) {
    voices.value = [
      { name: 'km-KH-PisethNeural', lang: 'km-KH', label: 'Piseth (Male / ប្រុស)', gender: 'Male' },
      { name: 'km-KH-SreymomNeural', lang: 'km-KH', label: 'Sreymom (Female / ស្រី)', gender: 'Female' }
    ]
    if (!selectedVoiceName.value || !voices.value.find(v => v.name === selectedVoiceName.value)) {
      selectedVoiceName.value = 'km-KH-PisethNeural'
    }
    return
  }

  if (!window.speechSynthesis) return
  
  try {
    let availableVoices = window.speechSynthesis.getVoices() || []
    voices.value = availableVoices.map(v => ({ name: v.name, lang: v.lang, label: v.name, gender: 'Unknown' }))
    
    // Try to find a Khmer voice safely
    const khmerVoice = availableVoices.find(voice => {
      const lang = voice?.lang?.toLowerCase() || ''
      const name = voice?.name?.toLowerCase() || ''
      return lang.includes('km') || lang.includes('khmer') || name.includes('khmer')
    })

    if (khmerVoice) {
      selectedVoiceName.value = khmerVoice.name
    } else if (availableVoices.length > 0) {
      const defaultVoice = availableVoices.find(voice => voice?.default) || availableVoices[0]
      if (defaultVoice) {
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
    return
  }
  
  // Split strictly by any whitespace (newlines, spaces, tabs)
  // This prevents randomly slicing Khmer words in the middle of a syllable
  const tokens = textToSplit.trim().split(/\s+/).filter(w => w.length > 0)
  
  words.value = tokens.map(w => ({ text: w, id: Math.random() }))
}

// Word-by-word visual highlight simulation
const startHighlighting = () => {
  activeWordIndex.value = 0
  // Khmer text typically takes a bit longer per visual "word" segment to read
  const durationPerWord = Math.max(400, 800 - (rate.value - 1) * 300)
  
  highlightInterval = setInterval(() => {
    if (activeWordIndex.value < words.value.length - 1) {
      activeWordIndex.value++
    } else {
      // Just stop highlighting, let the audio finish playing naturally
      if (highlightInterval) {
        clearInterval(highlightInterval)
        highlightInterval = null
      }
    }
  }, durationPerWord)
}

const resumeHighlighting = () => {
  const durationPerWord = Math.max(400, 800 - (rate.value - 1) * 300)
  highlightInterval = setInterval(() => {
    if (activeWordIndex.value < words.value.length - 1) {
      activeWordIndex.value++
    } else {
      if (highlightInterval) {
        clearInterval(highlightInterval)
        highlightInterval = null
      }
    }
  }, durationPerWord)
}

// Web Speech API trigger
const startSpeech = async () => {
  if (!props.text) return
  
  let provider = 'web-speech'
  let apiKey = ''
  let endpoint = ''

  if (import.meta.env.VITE_AZURE_TTS_API_KEY) {
    provider = 'azure-tts'
    apiKey = import.meta.env.VITE_AZURE_TTS_API_KEY
    endpoint = import.meta.env.VITE_AZURE_TTS_ENDPOINT
  }

  if (provider === 'azure-tts' && apiKey) {
    if (isPaused.value && currentAudio) {
      currentAudio.play()
      isPaused.value = false
      isSpeaking.value = true
      resumeHighlighting()
      return
    }

    stopSpeech()
    isSpeaking.value = true
    isPaused.value = false
    
    try {
      const selectedVoice = voices.value.find(v => v.name === selectedVoiceName.value)
      const voiceName = selectedVoice ? selectedVoice.name : 'km-KH-PisethNeural'
      const gender = selectedVoice && selectedVoice.gender ? selectedVoice.gender : 'Male'

      // We request 1.0x speed from Azure and handle Speed/Volume dynamically via HTML5 Audio so sliders are instantly responsive!
      const audioUrl = await synthesizeTextAzureTTS(props.text, apiKey, endpoint, 1.0, 1.0, voiceName, gender)
      currentAudio = new Audio(audioUrl)
      currentAudio.playbackRate = rate.value
      currentAudio.volume = volume.value
      
      currentAudio.onended = () => {
        stopSpeech()
      }
      currentAudio.play()
      startHighlighting()
    } catch (error) {
      console.error(error)
      alert(`កំហុស TTS API: ${error.message || 'មិនអាចដំណើរការសេវាកម្ម Azure TTS បានទេ'}`)
      isSpeaking.value = false
    }
    return
  }

  // Fallback to Web Speech API
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
      console.warn('SpeechSynthesis start failed:', error)
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

// Canvas wave drawing
const drawVisualizer = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  const width = canvas.width = canvas.parentElement.clientWidth
  const height = canvas.height = 60
  
  ctx.clearRect(0, 0, width, height)
  
  const waveCount = 2
  const colors = [
    'rgba(59, 130, 246, 0.25)', // Blue
    'rgba(16, 185, 129, 0.15)'  // Green
  ]
  
  waveOffset.value += isSpeaking.value ? 0.08 : 0.01
  
  for (let i = 0; i < waveCount; i++) {
    ctx.beginPath()
    ctx.lineWidth = 2
    ctx.strokeStyle = colors[i]
    
    const amplitude = isSpeaking.value 
      ? (10 + i * 6) * (0.8 + Math.sin(waveOffset.value * 2) * 0.2)
      : 2 + i * 1
      
    const frequency = 0.015 - i * 0.003
    
    for (let x = 0; x < width; x++) {
      const y = height / 2 + Math.sin(x * frequency + waveOffset.value + i * 5) * amplitude
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

// Watchers at the bottom to prevent hoisting issues
watch(() => props.text, (newText) => {
  prepareWords(newText)
  if (typeof stopSpeech === 'function') {
    stopSpeech()
  }
}, { immediate: true })
</script>

<template>
  <div class="tts-card">
    <div class="card-header">
      <div class="title-wrap">
        <div class="icon-box-indigo">
          <Volume2 :size="20" />
        </div>
        <h2 class="khmer-font">អានអត្ថបទជាសំឡេង (TTS)</h2>
      </div>
      <span v-if="isSpeaking" class="badge badge-green khmer-font">កំពុងអាន</span>
      <span v-else-if="isPaused" class="badge badge-amber khmer-font">ផ្អាក</span>
      <span v-else class="badge badge-slate khmer-font">រង់ចាំ</span>
    </div>

    <!-- Speech highlighting workspace -->
    <div class="words-container">
      <div v-if="words.length === 0" class="viewer-empty">
        <Sparkles :size="24" class="icon-slate-light" />
        <span class="khmer-font">អត្ថបទអក្សរខ្មែរនឹងបង្ហាញរំលេចពាក្យម្តងមួយៗនៅទីនេះពេលអាន។</span>
      </div>
      <div v-else class="words-grid khmer-font">
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

    <!-- Canvas Wave Visualizer -->
    <div class="visualizer-wrapper">
      <canvas ref="canvasRef" class="visualizer-canvas"></canvas>
    </div>

    <!-- Parameters & Controls -->
    <div class="controls-panel">
      <!-- Voice Config -->
      <div class="form-row">
        <div class="col-field">
          <span class="label-title khmer-font">ជ្រើសរើសសំឡេងអាន៖</span>
          <select v-model="selectedVoiceName" class="voice-select">
            <option v-for="voice in voices" :key="voice.name" :value="voice.name">
              {{ voice.label || voice.name }} ({{ voice.lang }})
            </option>
          </select>
        </div>
      </div>

      <!-- Playback Speed Sliders -->
      <div class="form-row flex-row">
        <div class="slider-field">
          <div class="slider-header">
            <span class="khmer-font">ល្បឿនអាន៖</span>
            <span class="val-text">{{ rate }}x</span>
          </div>
          <input type="range" min="0.5" max="2.0" step="0.1" v-model.number="rate" class="custom-slider" />
        </div>
        
        <div class="slider-field">
          <div class="slider-header">
            <span class="khmer-font">កម្រិតសំឡេង៖</span>
            <span class="val-text">{{ Math.round(volume * 100) }}%</span>
          </div>
          <input type="range" min="0.0" max="1.0" step="0.1" v-model.number="volume" class="custom-slider" />
        </div>
      </div>

      <!-- Playback Actions -->
      <div class="btn-actions-row">
        <button 
          v-if="!isSpeaking" 
          class="btn btn-primary flex-grow" 
          @click="startSpeech" 
          :disabled="!text"
        >
          <Play :size="18" fill="currentColor" />
          <span class="khmer-font">អានអត្ថបទ</span>
        </button>
        <button 
          v-else 
          class="btn btn-warning flex-grow" 
          @click="pauseSpeech"
        >
          <Pause :size="18" fill="currentColor" />
          <span class="khmer-font">ផ្អាក</span>
        </button>
        
        <button 
          class="btn btn-outline btn-stop" 
          @click="stopSpeech" 
          :disabled="!isSpeaking && !isPaused && activeWordIndex === -1"
        >
          <Square :size="16" fill="currentColor" />
          <span class="khmer-font">បញ្ឈប់</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tts-card {
  background: #000000;
  border: 4px solid #FFFFFF;
  border-radius: 0;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-box-indigo {
  background: #000000;
  border: 4px solid #FFFFFF;
  color: #FFFFFF;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.title-wrap h2 {
  color: #FFFFFF;
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
}

.icon-slate-light {
  color: rgba(255, 255, 255, 0.5);
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 0;
  font-size: 1.2rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 4px solid #FFFFFF;
}

.badge-green {
  background: #FFFF00;
  color: #000000;
  border-color: #FFFF00;
}

.badge-amber {
  background: #000000;
  color: #FFFFFF;
}

.badge-slate {
  background: #000000;
  color: #FFFFFF;
}

/* Words container */
.words-container {
  min-height: 150px;
  max-height: 250px;
  background: #000000;
  border: 4px solid #FFFFFF;
  border-radius: 0;
  padding: 16px;
  overflow-y: auto;
}

.viewer-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 1.5rem;
  color: #FFFFFF;
  text-align: center;
}

.words-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  text-align: left;
}

.word-token {
  padding: 4px 8px;
  border-radius: 0;
  color: #FFFFFF;
  font-size: 1.8rem;
}

.word-active {
  background: #FFFF00;
  color: #000000;
  font-weight: 800;
}

/* Visualizer wrapper */
.visualizer-wrapper {
  height: 50px;
  background: #000000;
  border: 4px solid #FFFFFF;
  border-radius: 0;
  overflow: hidden;
}

.visualizer-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

/* Controls panel */
.controls-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 16px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.flex-row {
  flex-direction: row;
  gap: 20px;
}

.col-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label-title {
  font-size: 1.2rem;
  color: #FFFFFF;
  font-weight: 800;
}

.voice-select {
  padding: 16px 20px;
  font-size: 1.5rem;
  background: #000000;
  color: #FFFFFF;
  border: 4px solid #FFFFFF;
  border-radius: 0;
  outline: none;
  cursor: pointer;
}
.voice-select option {
  color: #000000;
}

.voice-select:focus {
  border-color: #FFFF00;
}

.slider-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  font-size: 1.2rem;
  color: #FFFFFF;
  font-weight: 800;
}

.val-text {
  font-weight: 800;
  color: #FFFF00;
}

.custom-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 12px;
  background: #FFFFFF;
  border-radius: 0;
  outline: none;
}

.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 32px;
  height: 32px;
  border-radius: 0;
  background: #FFFF00;
  border: 4px solid #000000;
  cursor: pointer;
}

.btn-actions-row {
  display: flex;
  gap: 16px;
  margin-top: 16px;
}

.flex-grow {
  flex-grow: 1;
}

.btn-stop {
  flex-shrink: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  border-radius: 0;
  font-weight: 800;
  font-size: 1.5rem;
  cursor: pointer;
  background: #000000;
  color: #FFFFFF;
  border: 4px solid #FFFFFF;
}

.btn:hover:not(:disabled) {
  background: #FFFF00;
  color: #000000;
  border-color: #FFFF00;
}

.btn-primary { }
.btn-warning { }
.btn-outline { }

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: #666666;
  color: #666666;
}

@media (max-width: 480px) {
  .tts-card {
    padding: 16px;
    border-radius: 16px;
    gap: 16px;
  }

  .title-wrap h2 {
    font-size: 1.05rem;
  }

  .icon-box-indigo {
    padding: 8px;
    border-radius: 10px;
  }
  .icon-box-indigo svg {
    width: 20px;
    height: 20px;
  }

  .badge {
    padding: 4px 8px;
    font-size: 0.7rem;
  }

  .words-container {
    padding: 12px;
    min-height: 80px;
    max-height: 120px;
  }

  .word-token {
    font-size: 0.95rem;
    padding: 2px 4px;
  }

  .controls-panel {
    gap: 12px;
    padding-top: 12px;
  }

  .flex-row {
    flex-direction: column;
    gap: 12px;
  }

  .btn {
    padding: 12px;
    font-size: 0.95rem;
  }
  
  .voice-select {
    padding: 10px 12px;
    font-size: 0.9rem;
  }
}
</style>
