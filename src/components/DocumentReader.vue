<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, inject, nextTick } from 'vue'
import { 
  ArrowLeft, Settings, BookOpen, Copy, Play, Pause, 
  RotateCcw, RotateCw, Check, X, Volume2, Sparkles, AlertCircle, Camera, Upload
} from 'lucide-vue-next'
import { t, currentLang } from '../services/i18n'
import { haptics } from '../services/haptics'
import { synthesizeTextAzureTTS } from '../services/tts'
import { getTtsCache, setTtsCache } from '../services/cache'
import signalIconUrl from '../assets/signalIcon.svg'
import './DocumentReader.css'

const props = defineProps({
  text: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: ''
  },
  isProcessing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['back', 'toast', 'switch-mode'])

// Injected global accessibility context
const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})
const openSettings = inject('openSettings', () => {})

// --- State Management ---
const activeWordIndex = ref(-1)
const isSpeaking = ref(false)
const isPaused = ref(false)
const rate = ref(1.0)
const volume = ref(1.0)
let currentAudio = null
let highlightInterval = null

// Speed presets: 0.75x, 1.0x, 1.25x, 1.5x, 2.0x
const speedPresets = [0.75, 1.0, 1.25, 1.5, 2.0]

// --- Dynamic Spring Action Feature State (Strict Hold-to-Open Physics) ---
const isActionsOpen = ref(false)
const isHolding = ref(false)
const isHinting = ref(false)
let holdTimer = null
let holdTriggered = false
let retractTimer = null
const HOLD_TRIGGER_MS = 420

const startHold = (e) => {
  // Only primary mouse button or touch
  if (e.pointerType === 'mouse' && e.button !== 0) return
  if (retractTimer) {
    clearTimeout(retractTimer)
    retractTimer = null
  }
  isHolding.value = true
  holdTriggered = false
  // Initial micro-tactile tick on press
  triggerHaptic(20)
  
  if (holdTimer) clearTimeout(holdTimer)
  holdTimer = setTimeout(() => {
    holdTriggered = true
    isActionsOpen.value = true
    isHolding.value = false
    // Tactile double vibration pattern when jelly pops out
    triggerHaptic([45, 30, 50])
    speakAccessibility(currentLang.value === 'km' 
      ? 'បានបើកម៉ឺនុយមុខងារ: សង្ខេប និងចម្លង' 
      : 'Menu opened: summarize and copy')
  }, HOLD_TRIGGER_MS)
}

const cancelHold = () => {
  if (holdTimer) {
    clearTimeout(holdTimer)
    holdTimer = null
  }
  isHolding.value = false
}

// Click event handler: Strictly gated so short click (<420ms) does NOT open!
const handleClick = (e) => {
  if (holdTriggered) {
    // Already opened by the hold timer, consume the trailing click
    holdTriggered = false
    return
  }

  // If menu is ALREADY open, tapping button closes it
  if (isActionsOpen.value) {
    isActionsOpen.value = false
    triggerHaptic(20)
    return
  }

  // User just clicked without holding (< 420ms): Do NOT open! Show spring wobble hint to teach hold
  cancelHold()
  triggerHaptic(20)
  isHinting.value = true
  setTimeout(() => { isHinting.value = false }, 380)
}

const toggleByKeyboard = () => {
  isActionsOpen.value = !isActionsOpen.value
  triggerHaptic(30)
}

// When not hovering over the feature or button, retract smoothly with debounce
const onAnchorMouseLeave = () => {
  cancelHold()
  if (isActionsOpen.value) {
    if (retractTimer) clearTimeout(retractTimer)
    retractTimer = setTimeout(() => {
      isActionsOpen.value = false
      triggerHaptic(15)
    }, 450)
  }
}

const onAnchorMouseEnter = () => {
  if (retractTimer) {
    clearTimeout(retractTimer)
    retractTimer = null
  }
}

const closeActions = () => {
  cancelHold()
  if (retractTimer) clearTimeout(retractTimer)
  if (isActionsOpen.value) {
    isActionsOpen.value = false
    triggerHaptic(20)
  }
}

const onPillHover = () => {
  if (retractTimer) {
    clearTimeout(retractTimer)
    retractTimer = null
  }
  triggerHaptic(15)
}

// --- Copy Document Feature ---
const isCopied = ref(false)
const handleCopy = async () => {
  if (!props.text) return
  closeActions()
  try {
    await navigator.clipboard.writeText(props.text)
    isCopied.value = true
    triggerHaptic(50)
    const msg = currentLang.value === 'km' ? 'បានចម្លង' : 'Copied'
    speakAccessibility(msg)
    emit('toast', { message: msg, type: 'success' })
    setTimeout(() => { isCopied.value = false }, 2500)
  } catch (err) {
    emit('toast', { message: currentLang.value === 'km' ? 'មិនអាចចម្លងបាន' : 'Copy failed', type: 'error' })
  }
}

// --- Summarize Feature ---
const isSummaryModalOpen = ref(false)
const summaryPoints = computed(() => {
  if (!props.text) return []
  const clean = props.text.replace(/\r\n/g, '\n').trim()
  if (!clean) return []

  const lines = clean.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !/^[-*_]{3,}$/.test(l))

  const bulletMatch = lines.filter(l => /^[0-9]+[.)\s]|^[•\-\*]\s/.test(l))
  if (bulletMatch.length >= 2) {
    return bulletMatch.slice(0, 5).map(l => l.replace(/^[0-9]+[.)\s]*|^[•\-\*]\s*/, '').trim())
  }

  const rawSentences = clean.split(/[។៕\.\!\?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 8)

  if (rawSentences.length > 0) {
    return rawSentences.slice(0, 4)
  }

  return [clean.slice(0, 180) + '...']
})

const handleOpenSummary = () => {
  closeActions()
  isSummaryModalOpen.value = true
  triggerHaptic(40)
  speakAccessibility(currentLang.value === 'km' 
    ? 'បានបើកផ្ទាំងសង្ខេបខ្លឹមសារសំខាន់ៗ' 
    : 'Opened document summary')
}

const handleCloseSummary = () => {
  isSummaryModalOpen.value = false
  triggerHaptic(20)
  speakAccessibility(currentLang.value === 'km' ? 'បានបិទផ្ទាំងសង្ខេប' : 'Closed summary')
}

const isSpeakingSummary = ref(false)
const handleReadSummaryAloud = () => {
  const fullSummary = summaryPoints.value.join('. ')
  isSpeakingSummary.value = true
  speakAccessibility(fullSummary)
}

// --- Tokenization for Word-by-Word Highlight ---
const wordTokens = ref([])

const prepareWordTokens = (sourceText) => {
  if (!sourceText) {
    wordTokens.value = []
    return
  }

  const paragraphs = sourceText.split(/\n\s*\n|\n/)
  let globalIndex = 0
  const parsed = []

  paragraphs.forEach((paraText, pIdx) => {
    const trimmedPara = paraText.trim()
    if (!trimmedPara) return

    let words = []
    // Use Intl.Segmenter for Khmer script if available
    if (/[\u1780-\u17FF]/.test(trimmedPara) && typeof Intl !== 'undefined' && Intl.Segmenter) {
      try {
        const segmenter = new Intl.Segmenter('km', { granularity: 'word' })
        for (const { segment } of segmenter.segment(trimmedPara)) {
          const t = segment.trim()
          if (t) words.push(t)
        }
      } catch (e) {
        words = trimmedPara.split(/\s+/).filter(w => w.length > 0)
      }
    } else {
      words = trimmedPara.split(/\s+/).filter(w => w.length > 0)
    }

    const tokenObjects = words.map((w) => ({
      index: globalIndex++,
      text: w,
      paragraphIndex: pIdx
    }))

    parsed.push({
      paragraphIndex: pIdx,
      words: tokenObjects
    })
  })

  wordTokens.value = parsed
}

// Flattened list of all word tokens
const allTokens = computed(() => {
  return wordTokens.value.flatMap(p => p.words)
})

// --- Audio Playback Engine & Timers ---
const scrollToActiveWord = () => {
  nextTick(() => {
    const el = document.querySelector('.reading-word-active')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  })
}

const startHighlightTimer = (startIdx = 0) => {
  if (highlightInterval) clearInterval(highlightInterval)
  activeWordIndex.value = startIdx
  const total = allTokens.value.length
  if (total === 0) return

  // Average 250ms per word adjusted for rate
  const msPerWord = Math.max(120, Math.round(260 / rate.value))

  highlightInterval = setInterval(() => {
    if (activeWordIndex.value + 1 < total) {
      activeWordIndex.value++
      // Auto scroll active word into view smoothly
      scrollToActiveWord()
    } else {
      clearInterval(highlightInterval)
      highlightInterval = null
    }
  }, msPerWord)
}

const resumeHighlightTimer = () => {
  startHighlightTimer(activeWordIndex.value >= 0 ? activeWordIndex.value : 0)
}

const stopAudio = () => {
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
  activeWordIndex.value = -1
  if (highlightInterval) {
    clearInterval(highlightInterval)
    highlightInterval = null
  }
}

const pauseAudio = () => {
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
  triggerHaptic(30)
  speakAccessibility(currentLang.value === 'km' ? 'បានផ្អាកការអាន' : 'Paused reading')
}

const fallbackWebSpeech = (startIndex = 0) => {
  stopAudio()
  isSpeaking.value = true
  isPaused.value = false

  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  if (synth) {
    try {
      synth.cancel()
      const utterance = new SpeechSynthesisUtterance(props.text)
      const voices = synth.getVoices ? synth.getVoices() : []
      const khmerVoice = voices.find(v => (v.lang || '').toLowerCase().includes('km'))
      if (khmerVoice) utterance.voice = khmerVoice
      utterance.rate = rate.value
      utterance.volume = volume.value
      utterance.lang = 'km-KH'
      utterance.onend = () => { stopAudio() }
      utterance.onerror = () => { stopAudio() }
      synth.speak(utterance)
    } catch (e) {
      console.warn('SpeechSynthesis error:', e)
    }
  }

  startHighlightTimer(startIndex)
}

const startAudio = async (startIndex = 0) => {
  if (!props.text.trim()) return

  if (isPaused.value && currentAudio) {
    currentAudio.play()
    isPaused.value = false
    isSpeaking.value = true
    resumeHighlightTimer()
    triggerHaptic(30)
    speakAccessibility(currentLang.value === 'km' ? 'បន្តការអាន' : 'Resumed reading')
    return
  }

  stopAudio()
  isSpeaking.value = true
  isPaused.value = false
  triggerHaptic(40)

  const provider = import.meta.env.VITE_TTS_PROVIDER || 'web-speech'
  const apiKey = import.meta.env.VITE_AZURE_TTS_API_KEY
  const endpoint = import.meta.env.VITE_AZURE_TTS_ENDPOINT

  // Azure Neural TTS
  if (provider === 'azure-tts' && apiKey) {
    try {
      let audioUrl = getTtsCache(props.text, 'km-KH-PisethNeural', rate.value)
      if (!audioUrl) {
        audioUrl = await synthesizeTextAzureTTS(
          props.text, 
          apiKey, 
          endpoint, 
          rate.value, 
          1.0, 
          'km-KH-PisethNeural', 
          'Male'
        )
        setTtsCache(props.text, 'km-KH-PisethNeural', rate.value, audioUrl)
      }

      currentAudio = new Audio(audioUrl)
      currentAudio.playbackRate = rate.value
      currentAudio.volume = volume.value

      currentAudio.onended = () => {
        stopAudio()
        speakAccessibility(currentLang.value === 'km' ? 'ការអានបានបញ្ចប់' : 'Reading completed')
      }

      currentAudio.play()
      startHighlightTimer(startIndex)
      return
    } catch (e) {
      console.warn('Azure TTS fallback to Web Speech:', e)
      fallbackWebSpeech(startIndex)
      return
    }
  }

  fallbackWebSpeech(startIndex)
}

const toggleAudio = () => {
  if (isSpeaking.value) {
    pauseAudio()
  } else {
    startAudio(activeWordIndex.value >= 0 ? activeWordIndex.value : 0)
  }
}

// Click-to-seek word
const seekToWord = (index) => {
  activeWordIndex.value = index
  triggerHaptic(25)
  if (isSpeaking.value) {
    startHighlightTimer(index)
  }
  scrollToActiveWord()
}

// Rewind / Fast-forward by 5 words
const jumpRelative = (delta) => {
  const total = allTokens.value.length
  if (total === 0) return
  const current = activeWordIndex.value >= 0 ? activeWordIndex.value : 0
  const next = Math.max(0, Math.min(total - 1, current + delta))
  seekToWord(next)
  triggerHaptic(35)
  const dirMsg = delta > 0 
    ? (currentLang.value === 'km' ? 'ទៅមុខ ៥ ពាក្យ' : 'Fast forward 5 words')
    : (currentLang.value === 'km' ? 'ថយក្រោយ ៥ ពាក្យ' : 'Rewind 5 words')
  speakAccessibility(dirMsg)
}

// Watcher declared after functions are initialized
watch(() => props.text, (newText) => {
  prepareWordTokens(newText)
  stopAudio()
}, { immediate: true })

// Back handler
const handleBack = () => {
  stopAudio()
  triggerHaptic(30)
  speakAccessibility(currentLang.value === 'km' ? 'ត្រឡប់ទៅការស្កេន' : 'Back to scanner')
  emit('back')
}

defineExpose({
  startSpeech: () => startAudio(0),
  pauseSpeech: pauseAudio,
  stopPlayback: stopAudio,
  togglePlayback: toggleAudio,
  seekToWord,
  isSpeaking,
  isPaused
})

onBeforeUnmount(() => {
  stopAudio()
  cancelHold()
})
</script>

<template>
  <div class="reader-screen-viewport" role="region" :aria-label="t('navReader')">
    <!-- 1. TOP HEADER (Back Arrow, Title, Settings Gear) -->
    <header class="reader-top-bar" role="banner">
      <button 
        type="button" 
        class="reader-icon-btn reader-back-btn" 
        @click="handleBack"
        :aria-label="currentLang === 'km' ? 'ត្រឡប់ក្រោយ' : 'Go back'"
      >
        <ArrowLeft :size="24" />
      </button>

      <h1 class="reader-top-title khmer-font">
        {{ currentLang === 'km' ? 'អានឯកសារ' : 'Read document' }}
      </h1>

      <button 
        type="button" 
        class="reader-icon-btn reader-settings-btn" 
        @click="openSettings"
        :aria-label="t('settings')"
      >
        <Settings :size="22" />
      </button>
    </header>

    <!-- 2. MAIN READING AREA -->
    <main class="reader-main-canvas" role="main" @click="closeActions">
      <!-- Text Reading Content -->
      <div v-if="text && text.trim()" class="reader-text-container khmer-font">
        <p 
          v-for="paragraph in wordTokens" 
          :key="paragraph.paragraphIndex" 
          class="reader-paragraph"
        >
          <span 
            v-for="word in paragraph.words" 
            :key="word.index"
            class="reader-word-token"
            :class="{ 'reading-word-active': activeWordIndex === word.index }"
            @click.stop="seekToWord(word.index)"
            tabindex="0"
            role="button"
            :aria-label="word.text"
            @keydown.enter.stop="seekToWord(word.index)"
            @keydown.space.prevent.stop="seekToWord(word.index)"
          >
            {{ word.text }}
          </span>
        </p>
      </div>

      <!-- Empty State: Scan or Upload Prompt -->
      <div v-else class="reader-empty-sheet khmer-font">
        <h2 class="empty-title">
          {{ currentLang === 'km' ? 'មិនទាន់មានឯកសារអានទេ' : 'No document loaded' }}
        </h2>
        <p class="empty-subtitle">
          {{ currentLang === 'km' ? 'សូមថតរូបភាព ឬជ្រើសរើសឯកសារដើម្បីចាប់ផ្តើមអាន' : 'Take a photo or upload a file to start reading' }}
        </p>
        <div class="empty-actions-row">
          <button 
            type="button" 
            class="btn-reader-hero btn-hero-scan" 
            @click="emit('switch-mode', 'scan')"
          >
            <Camera :size="20" />
            <span>{{ currentLang === 'km' ? 'ស្កេនរូបភាព' : 'Scan document' }}</span>
          </button>
          <button 
            type="button" 
            class="btn-reader-hero btn-hero-upload" 
            @click="emit('switch-mode', 'upload')"
          >
            <Upload :size="20" />
            <span>{{ currentLang === 'km' ? 'ជ្រើសរើសឯកសារ' : 'Upload file' }}</span>
          </button>
        </div>
      </div>
    </main>

    <!-- Backdrop overlay to dismiss floating actions when tapping anywhere outside -->
    <div 
      v-if="isActionsOpen" 
      class="reader-actions-backdrop" 
      @click="closeActions"
      aria-hidden="true"
    />

    <!-- 3. FLOATING ACTION FEATURE (Hold to Zoom & Jelly Pop-Out, Retract on unhover) -->
    <div 
      v-if="text && text.trim()" 
      class="reader-speed-dial-anchor"
      @mouseenter="onAnchorMouseEnter"
      @mouseleave="onAnchorMouseLeave"
    >
      <!-- Action Pills (Jelly pop-out) -->
      <div 
        class="reader-action-pills-deck"
        :class="{ 'deck-visible': isActionsOpen }"
        role="menu"
        :aria-hidden="!isActionsOpen"
      >
        <!-- Pill 1: Summarize (សង្ខេប) -->
        <button 
          type="button" 
          class="action-pill-btn pill-summarize khmer-font"
          @click="handleOpenSummary"
          @mouseenter="onPillHover"
          role="menuitem"
          :aria-label="currentLang === 'km' ? 'សង្ខេបខ្លឹមសារ' : 'Summarize document'"
        >
          <BookOpen :size="18" class="pill-icon" />
          <span class="pill-label">{{ currentLang === 'km' ? 'សង្ខេប' : 'Summarize' }}</span>
        </button>

        <!-- Pill 2: Copy (ចម្លង) -->
        <button 
          type="button" 
          class="action-pill-btn pill-copy khmer-font"
          @click="handleCopy"
          @mouseenter="onPillHover"
          role="menuitem"
          :aria-label="currentLang === 'km' ? 'ចម្លងអត្ថបទ' : 'Copy text'"
        >
          <Copy :size="18" class="pill-icon" />
          <span class="pill-label">{{ currentLang === 'km' ? 'ចម្លង' : 'Copy' }}</span>
        </button>
      </div>

      <!-- Trigger FAB with Signal Icon & Spring Zoom -->
      <button 
        type="button" 
        class="reader-fab-trigger"
        :class="{ 'fab-active': isActionsOpen, 'fab-holding': isHolding, 'fab-hint': isHinting }"
        @pointerdown="startHold"
        @pointerup="cancelHold"
        @pointerleave="cancelHold"
        @click="handleClick"
        @keydown.enter.prevent="toggleByKeyboard"
        @keydown.space.prevent="toggleByKeyboard"
        role="button"
        aria-haspopup="menu"
        :aria-expanded="isActionsOpen"
        :aria-label="currentLang === 'km' 
          ? 'មុខងារបន្ថែម (សង្ខេប និងចម្លង) - សង្កត់ដើម្បីបើក' 
          : 'Additional features (summarize and copy) - hold to open'"
      >
        <img :src="signalIconUrl" alt="" class="fab-signal-icon" draggable="false" />
      </button>
    </div>

    <!-- 4. BOTTOM AUDIO PLAYBACK BAR (Rewind, Large Orange Play/Pause, Fast Forward) -->
    <footer v-if="text && text.trim()" class="reader-bottom-player-bar" role="region" :aria-label="currentLang === 'km' ? 'ឧបករណ៍បញ្ជាសំឡេង' : 'Audio controls'">
      <div class="player-controls-cluster">
        <!-- Rewind Button (<<) -->
        <button 
          type="button" 
          class="player-round-btn btn-rewind" 
          @click="jumpRelative(-5)"
          :aria-label="currentLang === 'km' ? 'ថយក្រោយ ៥ ពាក្យ' : 'Rewind 5 words'"
        >
          <RotateCcw :size="22" />
        </button>

        <!-- Hero Play / Pause Button (Large Orange Circle) -->
        <button 
          type="button" 
          class="player-round-btn btn-hero-play"
          :class="{ 'is-playing': isSpeaking }"
          @click="toggleAudio"
          :aria-label="isSpeaking 
            ? (currentLang === 'km' ? 'ផ្អាកការអាន' : 'Pause reading') 
            : (currentLang === 'km' ? 'ចាប់ផ្តើមអាន' : 'Play reading')"
        >
          <Pause v-if="isSpeaking" :size="28" />
          <Play v-else :size="28" class="play-icon-offset" />
        </button>

        <!-- Fast Forward Button (>>) -->
        <button 
          type="button" 
          class="player-round-btn btn-forward" 
          @click="jumpRelative(5)"
          :aria-label="currentLang === 'km' ? 'ទៅមុខ ៥ ពាក្យ' : 'Fast forward 5 words'"
        >
          <RotateCw :size="22" />
        </button>
      </div>
    </footer>

    <!-- 5. SUMMARY MODAL DIALOG -->
    <div 
      v-if="isSummaryModalOpen" 
      class="reader-summary-backdrop" 
      @click.self="handleCloseSummary"
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-dialog-title"
    >
      <div class="reader-summary-card glass-card khmer-font">
        <div class="summary-card-header">
          <div class="summary-header-left">
            <div class="summary-icon-gem">
              <Sparkles :size="20" />
            </div>
            <h2 id="summary-dialog-title" class="summary-header-title">
              {{ currentLang === 'km' ? 'សង្ខេបខ្លឹមសារសំខាន់ៗ' : 'Key Points Summary' }}
            </h2>
          </div>
          <button 
            type="button" 
            class="summary-close-btn" 
            @click="handleCloseSummary"
            :aria-label="currentLang === 'km' ? 'បិទ' : 'Close'"
          >
            <X :size="20" />
          </button>
        </div>

        <div class="summary-card-body">
          <ul class="summary-points-list">
            <li 
              v-for="(point, idx) in summaryPoints" 
              :key="idx" 
              class="summary-point-row"
            >
              <span class="point-bullet-dot"></span>
              <span class="point-text">{{ point }}</span>
            </li>
          </ul>
        </div>

        <div class="summary-card-footer">
          <button 
            type="button" 
            class="btn-summary-action btn-summary-listen" 
            @click="handleReadSummaryAloud"
          >
            <Volume2 :size="18" />
            <span>{{ currentLang === 'km' ? 'ស្តាប់ជាសំឡេង' : 'Listen aloud' }}</span>
          </button>
          <button 
            type="button" 
            class="btn-summary-action btn-summary-done" 
            @click="handleCloseSummary"
          >
            <Check :size="18" />
            <span>{{ currentLang === 'km' ? 'យល់ព្រម' : 'Got it' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
