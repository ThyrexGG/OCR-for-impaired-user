<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, inject, nextTick } from 'vue'
import { 
  ArrowLeft, Settings, BookOpen, Copy, Play, Pause, 
  RotateCcw, RotateCw, Check, X, Volume2, Sparkles, AlertCircle, Camera, Upload
} from 'lucide-vue-next'
import { t, currentLang } from '../services/i18n'
import { haptics } from '../services/haptics'
import { announcer } from '../services/announcer'
import { useKhmerTts, SPEED_PRESETS } from '../composables/useKhmerTts'
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

// --- Khmer TTS Engine (songKHEM-VITS / Neural personas, assistive pacing, audio-locked highlight) ---
const activeWordIndex = ref(-1)

const tts = useKhmerTts({
  getText: () => props.text,
  activeWordIndex
})
const {
  voices, selectedVoiceName, assistivePacing, rate,
  isSpeaking, isPaused, paragraphs: wordTokens
} = tts

const scrollToActiveWord = () => {
  nextTick(() => {
    const el = document.querySelector('.reader-text-container .reading-word-active')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  })
}

// Only follow the highlight while audio is playing so manual scrolling is never hijacked
watch(activeWordIndex, (idx) => {
  if (idx >= 0 && isSpeaking.value) scrollToActiveWord()
})

const toggleAudio = () => tts.toggle()
const startAudio = (startIndex = 0) => tts.start(startIndex)
const pauseAudio = () => tts.pause()
const stopAudio = () => tts.stop()

// Click-to-seek word
const seekToWord = (index) => {
  triggerHaptic(25)
  tts.seekToWord(index)
  if (!isSpeaking.value) scrollToActiveWord()
}

// Rewind / Fast-forward by 5 words
const jumpRelative = (delta) => {
  tts.jumpWords(delta)
  if (!isSpeaking.value) scrollToActiveWord()
  const dirMsg = delta > 0
    ? (currentLang.value === 'km' ? 'ទៅមុខ ៥ ពាក្យ' : 'Fast forward 5 words')
    : (currentLang.value === 'km' ? 'ថយក្រោយ ៥ ពាក្យ' : 'Rewind 5 words')
  // Screen-reader live region only: spoken guidance would talk over the reading itself
  announcer.announce(dirMsg)
}

// --- Voice & Speed Picker (4 Khmer personas incl. trained songKHEM-VITS) ---
const isVoiceModalOpen = ref(false)

const openVoiceModal = () => {
  isVoiceModalOpen.value = true
  triggerHaptic(30)
  speakAccessibility(currentLang.value === 'km' ? 'បានបើកការជ្រើសរើសសំឡេង' : 'Opened voice settings')
}

const closeVoiceModal = () => {
  isVoiceModalOpen.value = false
  triggerHaptic(20)
}

const chooseVoice = (name) => {
  tts.setVoice(name)
  triggerHaptic(30)
}

// Re-tokenize on text change; index alignment with the engine comes from the shared tokenizer
watch(() => props.text, (newText) => {
  tts.stop()
  tts.prepare(newText)
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
  cycleSpeed: tts.cycleSpeed,
  skipWords: jumpRelative,
  seekToWord,
  isSpeaking,
  isPaused
})

onBeforeUnmount(() => {
  cancelHold()
})
</script>

<template>
  <div class="reader-screen-viewport" role="region" :aria-label="t('navReader')">
    <!-- 1. TOP HEADER (Back Arrow, Title, Settings Gear) -->
    <div class="reader-top-bar" role="group" :aria-label="t('navReader')">
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
    </div>

    <!-- 2. MAIN READING AREA -->
    <div class="reader-main-canvas" @click="closeActions">
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
            data-talkback="off"
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
    </div>

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
          :tabindex="isActionsOpen ? 0 : -1"
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
          :tabindex="isActionsOpen ? 0 : -1"
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
    <div v-if="text && text.trim()" class="reader-bottom-player-bar" role="group" :aria-label="currentLang === 'km' ? 'ឧបករណ៍បញ្ជាសំឡេង' : 'Audio controls'">
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

        <!-- Voice & Speed (songKHEM-VITS / Neural personas) -->
        <button
          type="button"
          class="player-round-btn btn-voice"
          @click="openVoiceModal"
          :aria-label="currentLang === 'km' ? 'ជ្រើសរើសសំឡេង និងល្បឿន' : 'Choose voice and speed'"
        >
          <Volume2 :size="22" />
        </button>
      </div>
    </div>

    <!-- 5b. VOICE & SPEED MODAL DIALOG -->
    <div
      v-if="isVoiceModalOpen"
      class="reader-summary-backdrop"
      @click.self="closeVoiceModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-dialog-title"
    >
      <div class="reader-summary-card glass-card khmer-font">
        <div class="summary-card-header">
          <div class="summary-header-left">
            <div class="summary-icon-gem">
              <Volume2 :size="20" />
            </div>
            <h2 id="voice-dialog-title" class="summary-header-title">
              {{ currentLang === 'km' ? 'សំឡេង និងល្បឿនអាន' : 'Voice & Speed' }}
            </h2>
          </div>
          <button
            type="button"
            class="summary-close-btn"
            @click="closeVoiceModal"
            :aria-label="currentLang === 'km' ? 'បិទ' : 'Close'"
          >
            <X :size="20" />
          </button>
        </div>

        <div class="summary-card-body">
          <div class="voice-option-list" role="radiogroup" :aria-label="currentLang === 'km' ? 'សំឡេង' : 'Voice'">
            <button
              v-for="voice in voices"
              :key="voice.name"
              type="button"
              class="voice-option-btn"
              :class="{ 'voice-option-active': selectedVoiceName === voice.name }"
              role="radio"
              :aria-checked="selectedVoiceName === voice.name"
              @click="chooseVoice(voice.name)"
            >
              <span class="voice-option-label">{{ voice.label }}</span>
              <Check v-if="selectedVoiceName === voice.name" :size="18" />
            </button>
          </div>

          <label class="voice-pacing-row">
            <input
              type="checkbox"
              :checked="assistivePacing"
              @change="tts.setAssistivePacing($event.target.checked)"
            />
            <span>{{ currentLang === 'km' ? 'អានយឺតត្រង់លេខ និងតម្លៃថ្នាំ' : 'Slow down on numbers and dosages' }}</span>
          </label>

          <div class="voice-speed-row" role="group" :aria-label="currentLang === 'km' ? 'ល្បឿន' : 'Speed'">
            <button
              v-for="speed in SPEED_PRESETS"
              :key="speed"
              type="button"
              class="voice-speed-chip"
              :class="{ 'voice-speed-active': rate === speed }"
              @click="tts.setRate(speed)"
            >
              {{ speed }}x
            </button>
          </div>
        </div>

        <div class="summary-card-footer">
          <button
            type="button"
            class="btn-summary-action btn-summary-done"
            @click="closeVoiceModal"
          >
            <Check :size="18" />
            <span>{{ currentLang === 'km' ? 'យល់ព្រម' : 'Got it' }}</span>
          </button>
        </div>
      </div>
    </div>

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
