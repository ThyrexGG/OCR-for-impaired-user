<script setup>
import { ref, computed, onMounted, onBeforeUnmount, inject, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Camera, AlertCircle, RotateCcw } from 'lucide-vue-next'
import DocumentUploader from '../components/DocumentUploader.vue'
import DocumentReader from '../components/DocumentReader.vue'
import UserHistory from '../components/UserHistory.vue'
import AppToast from '../components/AppToast.vue'
import { ocrService } from '../services/ocrService'
import { getScanError } from '../services/scanErrors'
import { clearOcrCache } from '../services/cache'
import { startWaitingCue, stopWaitingCue } from '../services/waitingCue'
import { announcer } from '../services/announcer'
import { storage, STORAGE_KEYS } from '../services/storage'
import { haptics } from '../services/haptics'
import { t, currentLang } from '../services/i18n'
import { tp } from '../services/talkback'
import { sampleLibrary } from '../services/sampleDocs'
import { prewarmKhmerTts } from '../composables/useKhmerTts'
import { useSwipeNav } from '../composables/useSwipeNav'


const router = useRouter()

// Injected global accessibility context from App.vue
const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})
const activeMode = inject('activeMode', ref('scan'))
const setMode = inject('setMode', () => {})
const openSettings = inject('openSettings', () => {})
const openHelp = inject('openHelp', () => {})

// Auto-populate sample document if reader or history mode is opened without data (e.g. guidelines walkthrough)
watch(activeMode, (newMode) => {
  if (newMode === 'reader' && (!extractedText.value || !extractedText.value.trim())) {
    extractedText.value = sampleLibrary[0].text
    selectedFileName.value = currentLang.value === 'km' ? sampleLibrary[0].title : sampleLibrary[0].titleEn
  } else if (newMode === 'recent' && (!historyList.value || historyList.value.length === 0)) {
    addToHistory(
      currentLang.value === 'km' ? sampleLibrary[0].title : sampleLibrary[0].titleEn,
      sampleLibrary[0].text,
      true
    )
  }
})
const isAutoReadEnabled = inject('isAutoReadEnabled', ref(true))
const lastVoiceCommand = inject('lastVoiceCommand', ref(null))

// Multi-Page scanning state
const isAppendingPage = ref(false)
const pageCounter = ref(1)

// Component Refs
const documentReaderRef = ref(null)
const getPlayer = () => documentReaderRef.value
const scanAgainErrorBtnRef = ref(null)
const originMode = ref('scan')

// Core Application State
const isProcessing = ref(false)
const isLongProcessing = ref(false)
const ocrProgress = ref(0)
const progressStage = ref('scanning') // 'scanning' | 'extracting' | 'preparing_reader' | 'ready'
let processingTimeoutId = null
let processingTickId = null
let prewarmProgressInterval = null

const progressStageLabel = computed(() => {
  const isKm = currentLang.value === 'km'
  switch (progressStage.value) {
    case 'scanning':
      return isKm ? 'កំពុងស្កេន និងអានឯកសារ...' : 'Scanning document...'
    case 'extracting':
      return isKm ? 'កំពុងស្រង់អត្ថបទ...' : 'Extracting text...'
    case 'preparing_reader':
      return isKm ? 'កំពុងរៀបចំសំឡេងអាន...' : 'Preparing audio reader...'
    case 'ready':
      return isKm ? 'រួចរាល់!' : 'Ready!'
    default:
      return isKm ? 'កំពុងដំណើរការ...' : 'Processing...'
  }
})

// While a scan runs, say so now and then: a user who cannot see the spinner has no other way
// to tell "working" from "stuck".
const clearProcessingTimers = () => {
  stopWaitingCue()
  clearTimeout(processingTimeoutId)
  clearInterval(processingTickId)
  if (prewarmProgressInterval) {
    clearInterval(prewarmProgressInterval)
    prewarmProgressInterval = null
  }
  processingTimeoutId = null
  processingTickId = null
}
const ocrErrorKind = ref(null)
const ocrError = computed(() => {
  if (!ocrErrorKind.value) return null
  return getScanError(ocrErrorKind.value, currentLang.value)
})

const extractedText = ref('')
const selectedFileName = ref('')
const selectedFile = ref(null)
const historyList = ref([])
const isCached = ref(false)


// Toast System
const toasts = ref([])
let toastIdCounter = 0
const addToast = ({ message, type = 'info', actionLabel, onAction, duration = 4000 }) => {
  const id = ++toastIdCounter
  const toast = { id, message, type, actionLabel, onAction }
  toasts.value.push(toast)
  if (duration > 0) {
    setTimeout(() => { dismissToast(id) }, duration)
  }
  return id
}

const dismissToast = (id) => {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

// History Helpers (Repository pattern via storage service)
const saveHistory = () => {
  storage.setJson(STORAGE_KEYS.HISTORY, historyList.value)
}

const addToHistory = (name, text, cached = false) => {
  if (!text || !text.trim()) return
  const now = new Date()
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString(currentLang.value === 'km' ? 'km-KH' : 'en-US', { month: 'short', day: 'numeric' })
  const wordsCount = text.trim().split(/\s+/).filter(w => w.length > 0).length

  if (historyList.value.length > 0 && historyList.value[0].text === text) return

  historyList.value.unshift({
    id: Date.now(),
    name: name || t('scannedDocTitle'),
    text: text.trim(),
    timestamp: timeStr,
    date: dateStr,
    wordsCount,
    cached
  })

  if (historyList.value.length > 25) {
    historyList.value = historyList.value.slice(0, 25)
  }
  saveHistory()
}

onMounted(() => {
  // Load real user history from storage (Clean production state — no mock data)
  const saved = storage.getJson(STORAGE_KEYS.HISTORY, [])
  if (saved && Array.isArray(saved)) {
    // Purge any legacy sample mock items or invalid blank items from earlier testing
    historyList.value = saved.filter(item => 
      item && 
      item.name &&
      item.name.trim() !== '' &&
      !item.pending &&
      item.id !== 1 && 
      item.id !== 2 && 
      !item.name?.includes('សេចក្តីជូនដំណឹង_ក្រសួង') && 
      !item.name?.includes('រឿងព្រេង_ធនញ្ជ័យ')
    )
  } else {
    historyList.value = []
  }
  saveHistory()

  // Global Keyboard Shortcuts
  const handleGlobalKeydown = (e) => {
    const tag = (e.target.tagName || '').toLowerCase()
    const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable

    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault()
      if (selectedFile.value && !isProcessing.value) {
        handleTriggerOcr()
      }
    } else if (e.code === 'Space' && !isInput) {
      e.preventDefault()
      getPlayer()?.togglePlayback()
    } else if (e.key === 'Escape') {
      getPlayer()?.stopPlayback()
    }
  }

  window.addEventListener('keydown', handleGlobalKeydown)
  onBeforeUnmount(() => window.removeEventListener('keydown', handleGlobalKeydown))

  // Watch Hands-Free Voice Commands
  watch(lastVoiceCommand, (cmd) => {
    if (!cmd) return
    if (cmd.action === 'play') {
      if (activeMode.value !== 'reader') setMode('reader')
      setTimeout(() => {
        getPlayer()?.togglePlayback()
      }, 200)
    } else if (cmd.action === 'stop') {
      getPlayer()?.stopPlayback()
    } else if (cmd.action === 'scan') {
      if (selectedFile.value && !isProcessing.value) {
        handleTriggerOcr()
      } else {
        setMode('scan')
      }
    } else if (cmd.action === 'skip-forward') {
      getPlayer()?.skipWords?.(5)
    } else if (cmd.action === 'skip-back') {
      getPlayer()?.skipWords?.(-5)
    } else if (cmd.action === 'faster') {
      getPlayer()?.cycleSpeed?.(1)
    } else if (cmd.action === 'slower') {
      getPlayer()?.cycleSpeed?.(-1)
    }
  })
})

// File Events
const onFileSelected = async (file) => {
  if (!file) return
  selectedFileName.value = file.name
  selectedFile.value = file
  extractedText.value = ''
  ocrErrorKind.value = null
  isCached.value = false
  addToast({ message: currentLang.value === 'km' ? 'បានជ្រើសរើសឯកសារ' : 'File selected', type: 'info' })
  await handleTriggerOcr()
}

const onClearFile = () => {
  selectedFileName.value = ''
  selectedFile.value = null
  extractedText.value = ''
  ocrErrorKind.value = null
  isCached.value = false
  isProcessing.value = false
}

// Trigger OCR Execution (SOLID: Strategy & Port via ocrService)
const handleTriggerOcr = async () => {
  if (isProcessing.value || !selectedFile.value) return
  if (activeMode.value && activeMode.value !== 'reader') {
    originMode.value = activeMode.value
  }
  
  ocrErrorKind.value = null
  isLongProcessing.value = false
  isProcessing.value = true
  haptics.pulse('shutter')

  // Like the app: a soft looping du-du-du while the page is read, instead of spoken "please wait" messages
  clearProcessingTimers()
  announcer.stop()
  startWaitingCue()
  processingTimeoutId = setTimeout(() => {
    if (isProcessing.value) {
      isLongProcessing.value = true
      processingTickId = setInterval(() => haptics.pulse('tap'), 9000)
    }
  }, 5000)

  // Optimistic History item
  const pendingId = 'pending_' + Date.now()
  historyList.value.unshift({
    id: pendingId,
    name: selectedFileName.value || t('scannedDocTitle'),
    pending: true,
    timestamp: t('extractingText'),
    date: currentLang.value === 'km' ? 'ថ្ងៃនេះ' : 'Today'
  })

  ocrProgress.value = 5
  progressStage.value = 'scanning'
  const result = await ocrService.recognize(selectedFile.value, {
    onProgress: (p) => {
      const mapped = Math.min(70, 5 + Math.round((p / 100) * 65))
      if (mapped > ocrProgress.value) ocrProgress.value = mapped
    }
  })

  if (result.ok) {
    const { text, cached, wordsCount } = result.data
    progressStage.value = 'extracting'
    ocrProgress.value = Math.max(ocrProgress.value, 75)

    if (cached) {
      ocrProgress.value = 95
    } else {
      // Pre-warm Khmer TTS voice synthesis and cache during the loading screen
      // Keeps progress smooth and eliminates waiting once the Reader screen opens
      progressStage.value = 'preparing_reader'
      ocrProgress.value = Math.max(ocrProgress.value, 80)

      prewarmProgressInterval = setInterval(() => {
        if (ocrProgress.value < 96) {
          ocrProgress.value += 1
        }
      }, 350)

      try {
        await prewarmKhmerTts(text, { timeoutMs: 30000 })
      } catch (_) {}

      if (prewarmProgressInterval) {
        clearInterval(prewarmProgressInterval)
        prewarmProgressInterval = null
      }
    }

    progressStage.value = 'ready'
    ocrProgress.value = 100
    // Visual hold on 100% so the Apple track fills smoothly and the green checkmark registers
    await new Promise((r) => setTimeout(r, 450))

    clearProcessingTimers()
    isProcessing.value = false
    isLongProcessing.value = false

    if (isAppendingPage.value && extractedText.value) {
      pageCounter.value++
      const pageHeader = `\n\n--- ${currentLang.value === 'km' ? 'ទំព័រទី ' + pageCounter.value : 'Page ' + pageCounter.value} ---\n\n`
      extractedText.value = extractedText.value + pageHeader + text.trim()
      isAppendingPage.value = false
      haptics.pulse('success')
      addToast({ 
        message: currentLang.value === 'km' ? `បានបន្ថែមទំព័រទី ${pageCounter.value}` : `Added Page ${pageCounter.value}`, 
        type: 'success' 
      })
      speakAccessibility(
        currentLang.value === 'km' 
          ? `បានបន្ថែមទំព័រទី ${pageCounter.value} ទៅក្នុងឯកសាររួចរាល់` 
          : `Added Page ${pageCounter.value} to document`
      )
    } else {
      pageCounter.value = 1
      isAppendingPage.value = false
      extractedText.value = text
      isCached.value = cached

      const finalizedItem = {
        id: Date.now(),
        name: selectedFileName.value || t('scannedDocTitle'),
        text: text.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        // The real date: a fixed "today" still said today a week later
        date: new Date().toLocaleDateString(currentLang.value === 'km' ? 'km-KH' : 'en-US', { month: 'short', day: 'numeric' }),
        wordsCount,
        cached
      }

      const idx = historyList.value.findIndex(i => i.id === pendingId)
      if (idx !== -1) {
        historyList.value.splice(idx, 1, finalizedItem)
      } else {
        historyList.value.unshift(finalizedItem)
      }
      saveHistory()

      haptics.pulse('success')
      const toastMsg = cached ? t('instantCacheHit') : t('toastScannedSuccess')
      addToast({ message: toastMsg, type: cached ? 'cache' : 'success' })
      speakAccessibility([t('toastScannedSuccess'), `${wordsCount} ${t('wordsCount')}`])
    }

    // Transition to Reader mode and start speech if auto-read is enabled
    if (activeMode.value && activeMode.value !== 'reader') {
      originMode.value = activeMode.value
    }
    setMode('reader')
    if (isAutoReadEnabled.value) {
      setTimeout(() => {
        documentReaderRef.value?.startSpeech()
      }, 400)
    }
  } else {
    clearProcessingTimers()
    isProcessing.value = false
    isLongProcessing.value = false

    // Remove pending item from history
    const idx = historyList.value.findIndex(i => i.id === pendingId)
    if (idx !== -1) historyList.value.splice(idx, 1)

    ocrProgress.value = 0
    progressStage.value = 'scanning'
    ocrErrorKind.value = result.error.kind || 'unknown'
    haptics.pulse('error')
    const errObj = ocrError.value || result.error
    const spoken = currentLang.value === 'km'
      ? (errObj.title ? [errObj.title, ...errObj.say.split('។').map((part) => part.trim()).filter(Boolean)] : [errObj.message])
      : (errObj.title ? [errObj.title, ...errObj.say.split('.').map((part) => part.trim()).filter(Boolean)] : [errObj.message])
    speakAccessibility(spoken)
    nextTick(() => {
      scanAgainErrorBtnRef.value?.focus()
    })
  }
}

// In-place File Selection directly from History (minimal steps for user)
const onFileSelectedFromHistory = async (file) => {
  if (!file) return
  originMode.value = 'recent'
  // onFileSelected already runs the OCR
  await onFileSelected(file)
}

// History Actions
const onLoadHistoryItem = (item) => {
  selectedFileName.value = item.name
  extractedText.value = item.text
  ocrErrorKind.value = null
  isCached.value = !!item.cached
  addToast({ message: currentLang.value === 'km' ? 'បានបើកឯកសារ' : 'Opened', type: 'info' })
  if (activeMode.value && activeMode.value !== 'reader') {
    originMode.value = activeMode.value
  }
  setMode('reader')
}

const onQuickPlayHistoryItem = (item) => {
  selectedFileName.value = item.name
  extractedText.value = item.text
  ocrErrorKind.value = null
  isCached.value = !!item.cached
  addToast({ message: currentLang.value === 'km' ? 'កំពុងអាន' : 'Playing', type: 'info' })
  if (activeMode.value && activeMode.value !== 'reader') {
    originMode.value = activeMode.value
  }
  setMode('reader')
  setTimeout(() => {
    documentReaderRef.value?.startSpeech()
  }, 300)
}

const onDeleteHistoryItem = (id) => {
  const idx = historyList.value.findIndex(i => i.id === id)
  if (idx === -1) return
  
  const deletedItem = historyList.value[idx]
  historyList.value.splice(idx, 1)
  saveHistory()

  addToast({
    message: currentLang.value === 'km' ? 'បានលុប' : 'Deleted',
    type: 'warning',
    actionLabel: currentLang.value === 'km' ? 'មិនធ្វើវិញ' : 'Undo',
    duration: 5000,
    onAction: () => {
      historyList.value.splice(idx, 0, deletedItem)
      saveHistory()
      triggerHaptic(40)
      addToast({ message: currentLang.value === 'km' ? 'បានស្តារឡើងវិញ' : 'Restored', type: 'success' })
    }
  })
}

const onClearHistory = () => {
  const previousHistory = [...historyList.value]
  historyList.value = []
  saveHistory()
  // Saved scan results go too, so a rescan reads the page afresh (Settings no longer has its own button)
  clearOcrCache()
  
  addToast({
    message: currentLang.value === 'km' ? 'បានសម្អាត' : 'Cleared',
    type: 'warning',
    actionLabel: currentLang.value === 'km' ? 'មិនធ្វើវិញ' : 'Undo',
    duration: 5000,
    onAction: () => {
      historyList.value = previousHistory
      saveHistory()
      addToast({ message: currentLang.value === 'km' ? 'បានស្តារឡើងវិញ' : 'Restored', type: 'success' })
    }
  })
}

// Scan Again or Retry from Error Screen / Reader
const handleScanAgain = () => {
  triggerHaptic(40)
  if (ocrError.value?.retry && selectedFile.value) {
    ocrErrorKind.value = null
    handleTriggerOcr()
    return
  }
  isAppendingPage.value = false
  pageCounter.value = 1
  ocrErrorKind.value = null
  selectedFile.value = null
  selectedFileName.value = ''
  extractedText.value = ''
  documentReaderRef.value?.stopPlayback()
  const returnTarget = (originMode.value && originMode.value !== 'reader') ? originMode.value : 'scan'
  setMode(returnTarget)
  speakAccessibility(currentLang.value === 'km' ? 'ត្រឡប់ទៅទំព័រដើម' : 'Returned back')
}

// Add Next Page (Multi-page mode)
const handleAddPage = () => {
  isAppendingPage.value = true
  triggerHaptic(50)
  speakAccessibility(
    currentLang.value === 'km' 
      ? 'សូមថត ឬជ្រើសរើសទំព័របន្ទាប់' 
      : 'Please scan or upload the next page'
  )
  setMode('scan')
}

// Swipe gesture navigation between Camera and Upload (Instagram-style)
const { onTouchStart, onTouchEnd, onPointerDown, onPointerUp } = useSwipeNav({
  onSwipeLeft: () => {
    if (activeMode.value === 'scan') {
      setMode('upload')
      triggerHaptic(40)
    }
  },
  onSwipeRight: () => {
    if (activeMode.value === 'upload') {
      setMode('scan')
      triggerHaptic(40)
    }
  }
})
</script>

<template>
  <div class="assistant-workspace-wrapper">
    <!-- SIMPLE THEMED PROGRESS DIALOG (Matches reference layout with linear progress bar) -->
    <div v-if="isProcessing" class="simple-progress-backdrop" role="status" aria-live="assertive">
      <div class="simple-progress-dialog">
        <!-- Dialog Title -->
        <h2 class="simple-progress-title khmer-font">
          {{ currentLang === 'km' ? 'សូមរង់ចាំ...' : 'Please Wait..' }}
        </h2>

        <!-- Monotonic Linear Progress Bar -->
        <div 
          class="simple-progress-track"
          role="progressbar"
          :aria-valuenow="ocrProgress"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuetext="progressStageLabel"
        >
          <div 
            class="simple-progress-fill" 
            :style="{ width: `${ocrProgress}%` }"
          ></div>
        </div>

        <!-- Meta Row: Stage Label Left + Percentage Right -->
        <div class="simple-progress-meta khmer-font">
          <span class="simple-progress-stage">{{ progressStageLabel }}</span>
          <span class="simple-progress-percent">{{ ocrProgress }}%</span>
        </div>

        <!-- Timeout Notice if unusually long -->
        <div v-if="isLongProcessing" class="simple-progress-timeout khmer-font">
          <AlertCircle :size="15" />
          <span>{{ t('longProcessingNotice') }}</span>
        </div>
      </div>
    </div>

    <!-- OCR ERROR STATE (Context-aware tips + Retry / Scan Again button) -->
    <div v-if="ocrError && !isProcessing" class="mode-container scan-mode-container" role="alert">
      <div class="ocr-error-card glass-card">
        <div class="error-glow-icon bg-danger">
          <AlertCircle :size="40" />
        </div>
        <h2 class="error-title khmer-font">{{ ocrError.title }}</h2>
        <p class="error-desc khmer-font">{{ ocrError.say }}</p>

        <div v-if="ocrError.tips && ocrError.tips.length" class="error-tips-box khmer-font">
          <h3 class="tips-heading">{{ t('tipsHeading') }}</h3>
          <ul class="tips-list">
            <li v-for="(tip, idx) in ocrError.tips" :key="idx">{{ tip }}</li>
          </ul>
        </div>

        <button 
          ref="scanAgainErrorBtnRef"
          type="button" 
          class="btn btn-primary btn-scan-again-hero khmer-font"
          @click="handleScanAgain"
          :aria-label="ocrError.retry ? (currentLang === 'km' ? 'ព្យាយាមម្តងទៀត' : 'Try Again') : t('scanAgainBtn')"
        >
          <RotateCcw v-if="ocrError.retry" :size="24" />
          <Camera v-else :size="24" />
          <span>{{ ocrError.retry ? (currentLang === 'km' ? 'ព្យាយាមម្តងទៀត' : 'Try Again') : t('scanAgainBtn') }}</span>
        </button>
      </div>
    </div>

    <!-- MODE 1 & 2: CAMERA (full-screen) + UPLOAD (dropzone & samples) with Instagram-style swipe navigation -->
    <div 
      v-else-if="activeMode === 'scan' || activeMode === 'upload'" 
      class="mode-container scan-mode-container" 
      :class="{ 'camera-fullscreen': activeMode === 'scan' }"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
    >
      <DocumentUploader
        :mode="activeMode === 'upload' ? 'upload' : 'camera'"
        :is-processing="isProcessing"
        :recent-docs="historyList"
        @file-selected="onFileSelected"
        @clear-file="onClearFile"
        @trigger-ocr="handleTriggerOcr"
        @open-recent="onLoadHistoryItem"
        @switch-mode="setMode"
      />
    </div>

    <!-- MODE 3: READING MODE (Dedicated Clean Document Reader per Screenshot) -->
    <div v-show="!isProcessing && !ocrError && activeMode === 'reader'" class="mode-container reader-mode-container">
      <DocumentReader 
        ref="documentReaderRef"
        :text="extractedText"
        :file-name="selectedFileName"
        :is-processing="isProcessing"
        @back="handleScanAgain"
        @switch-mode="setMode"
        @toast="addToast"
      />
    </div>

    <!-- MODE 4: RECENT READS MODE (Accessible History Shelf with in-place upload) -->
    <div v-show="!isProcessing && !ocrError && activeMode === 'recent'" class="mode-container recent-mode-container">
      <UserHistory 
        :history="historyList"
        :is-processing="isProcessing"
        @load-item="onLoadHistoryItem"
        @quick-play="onQuickPlayHistoryItem"
        @delete-item="onDeleteHistoryItem"
        @clear-history="onClearHistory"
        @switch-mode="setMode"
        @file-selected="onFileSelectedFromHistory"
      />
    </div>

    <!-- Accessible Toast Notifications & Undo Snackbars -->
    <AppToast :toasts="toasts" @dismiss="dismissToast" />
  </div>
</template>

<style scoped src="./HomeScreen.css"></style>
