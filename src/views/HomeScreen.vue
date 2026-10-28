<script setup>
import { ref, computed, onMounted, onBeforeUnmount, inject, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { 
  ArrowLeft, Sparkles, BookOpen, FileCheck2, Cpu, Zap, 
  Camera, ArrowRight, Eye, Play, Volume2,
  Upload, RefreshCw, AlertCircle, CheckCircle2, FileText
} from 'lucide-vue-next'
import DocumentUploader from '../components/DocumentUploader.vue'
import DocumentReader from '../components/DocumentReader.vue'
import OcrPanel from '../components/OcrPanel.vue'
import TtsPanel from '../components/TtsPanel.vue'
import UserHistory from '../components/UserHistory.vue'
import AppToast from '../components/AppToast.vue'
import { ocrService } from '../services/ocrService'
import { storage, STORAGE_KEYS } from '../services/storage'
import { haptics } from '../services/haptics'
import { t, currentLang } from '../services/i18n'
import { tp } from '../services/talkback'
import { sampleLibrary } from '../services/sampleDocs'


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
const ttsPanelRef = ref(null)
// The active audio player: dedicated DocumentReader (reader mode) or legacy TtsPanel
const getPlayer = () => documentReaderRef.value || ttsPanelRef.value
const ocrPanelRef = ref(null)
const scanAgainErrorBtnRef = ref(null)
const originMode = ref('scan')

// Core Application State
const isProcessing = ref(false)
const isLongProcessing = ref(false)
const ocrProgress = ref(0)
let processingTimeoutId = null
let processingTickId = null

// While a scan runs, say so now and then: a user who cannot see the spinner has no other way
// to tell "working" from "stuck".
const clearProcessingTimers = () => {
  clearTimeout(processingTimeoutId)
  clearInterval(processingTickId)
  processingTimeoutId = null
  processingTickId = null
}
const ocrError = ref(null)

const extractedText = ref('')
const selectedFileName = ref('')
const selectedFile = ref(null)
const historyList = ref([])
const isCached = ref(false)

// Karaoke Highlighting Sync State
const activeWordIndex = ref(-1)
const highlightMode = ref('paragraph') // 'word' | 'sentence' | 'paragraph'

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
  ocrError.value = null
  isCached.value = false
  addToast({ message: currentLang.value === 'km' ? 'បានជ្រើសរើសឯកសារ' : 'File selected', type: 'info' })
  await handleTriggerOcr()
}

const onClearFile = () => {
  selectedFileName.value = ''
  selectedFile.value = null
  extractedText.value = ''
  ocrError.value = null
  isCached.value = false
  isProcessing.value = false
}

// Trigger OCR Execution (SOLID: Strategy & Port via ocrService)
const handleTriggerOcr = async () => {
  if (isProcessing.value || !selectedFile.value) return
  
  ocrError.value = null
  isLongProcessing.value = false
  isProcessing.value = true
  haptics.pulse('shutter')
  speakAccessibility(t('scanningDesc'))

  // Timeout warning after 5 seconds per §6.4
  clearProcessingTimers()
  processingTimeoutId = setTimeout(() => {
    if (isProcessing.value) {
      isLongProcessing.value = true
      speakAccessibility(t('longProcessingNotice'), false)
      processingTickId = setInterval(() => {
        haptics.pulse('tap')
        speakAccessibility(tp('scanning'), false)
      }, 9000)
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

  ocrProgress.value = 0
  const result = await ocrService.recognize(selectedFile.value, {
    onProgress: (p) => {
      ocrProgress.value = p
    }
  })

  clearProcessingTimers()
  isProcessing.value = false
  isLongProcessing.value = false

  if (result.ok) {
    const { text, cached, wordsCount } = result.data
    ocrProgress.value = 100

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
        date: currentLang.value === 'km' ? 'ថ្ងៃនេះ' : 'Today',
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
    originMode.value = activeMode.value
    setMode('reader')
    if (isAutoReadEnabled.value) {
      setTimeout(() => {
        if (documentReaderRef.value) {
          documentReaderRef.value.startSpeech()
        } else if (ttsPanelRef.value) {
          ttsPanelRef.value.startSpeech()
        }
      }, 400)
    }
  } else {
    // Remove pending item from history
    const idx = historyList.value.findIndex(i => i.id === pendingId)
    if (idx !== -1) historyList.value.splice(idx, 1)

    ocrProgress.value = 0
    ocrError.value = result.error.message
    haptics.pulse('error')
    speakAccessibility(`${t('ocrErrorTitle')} - ${result.error.message}`)
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
  ocrError.value = null
  isCached.value = !!item.cached
  addToast({ message: currentLang.value === 'km' ? 'បានបើកឯកសារ' : 'Opened', type: 'info' })
  originMode.value = 'recent'
  setMode('reader')
}

const onQuickPlayHistoryItem = (item) => {
  selectedFileName.value = item.name
  extractedText.value = item.text
  ocrError.value = null
  isCached.value = !!item.cached
  addToast({ message: currentLang.value === 'km' ? 'កំពុងអាន' : 'Playing', type: 'info' })
  originMode.value = 'recent'
  setMode('reader')
  setTimeout(() => {
    if (documentReaderRef.value) {
      documentReaderRef.value.startSpeech()
    } else if (ttsPanelRef.value) {
      ttsPanelRef.value.startSpeech()
    }
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

// Click-to-seek word from OCR into TTS
const onSeekWord = (wordIndex) => {
  activeWordIndex.value = wordIndex
  if (ttsPanelRef.value && typeof ttsPanelRef.value.seekToWord === 'function') {
    ttsPanelRef.value.seekToWord(wordIndex)
  }
}

// Trigger Read Aloud from OcrPanel
const handleReadAloud = () => {
  if (ttsPanelRef.value) {
    ttsPanelRef.value.togglePlayback()
  }
}

// Scan Again from OcrPanel / Error Screen
const handleScanAgain = () => {
  triggerHaptic(40)
  isAppendingPage.value = false
  pageCounter.value = 1
  ocrError.value = null
  selectedFile.value = null
  selectedFileName.value = ''
  extractedText.value = ''
  if (documentReaderRef.value) {
    documentReaderRef.value.stopPlayback()
  }
  if (ttsPanelRef.value) {
    ttsPanelRef.value.stopPlayback()
  }
  const returnTarget = originMode.value || 'scan'
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
let touchStartX = 0
let touchStartY = 0
let touchStartTime = 0

const onTouchStart = (e) => {
  if (e.touches && e.touches.length === 1) {
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
    touchStartTime = Date.now()
  }
}

const onTouchEnd = (e) => {
  if (!e.changedTouches || e.changedTouches.length !== 1) return
  const deltaX = e.changedTouches[0].clientX - touchStartX
  const deltaY = e.changedTouches[0].clientY - touchStartY
  const deltaTime = Date.now() - touchStartTime

  if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && deltaTime < 700) {
    if (deltaX < -40 && activeMode.value === 'scan') {
      // Swiped Left on Camera -> Switch to Upload
      setMode('upload')
      triggerHaptic(40)
    } else if (deltaX > 40 && activeMode.value === 'upload') {
      // Swiped Right on Upload -> Switch to Camera
      setMode('scan')
      triggerHaptic(40)
    }
  }
}

// Pointer drag fallback for mouse / trackpad testing
let pointerStartX = 0
let pointerStartY = 0
let pointerStartTime = 0
let isDragging = false

const onPointerDown = (e) => {
  if (e.button !== 0 || e.target.closest('button, input, a, select, textarea, [role="button"]')) return
  pointerStartX = e.clientX
  pointerStartY = e.clientY
  pointerStartTime = Date.now()
  isDragging = true
}

const onPointerUp = (e) => {
  if (!isDragging) return
  isDragging = false
  const deltaX = e.clientX - pointerStartX
  const deltaY = e.clientY - pointerStartY
  const deltaTime = Date.now() - pointerStartTime

  if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && deltaTime < 700) {
    if (deltaX < -40 && activeMode.value === 'scan') {
      setMode('upload')
      triggerHaptic(40)
    } else if (deltaX > 40 && activeMode.value === 'upload') {
      setMode('scan')
      triggerHaptic(40)
    }
  }
}
</script>

<template>
  <div class="assistant-workspace-wrapper">
    <!-- OCR PROGRESSION OVERLAY: Centered in the middle of the screen, minimal, no logo -->
    <div v-if="isProcessing" class="ocr-progression-overlay" role="status" aria-live="assertive">
      <div class="ocr-processing-card">
        <h2 class="processing-title khmer-font">{{ t('scanningTitle') }}</h2>
        <p class="processing-desc khmer-font">
          {{ t('scanningDesc') }}
        </p>

        <!-- Shimmer Progress Beam -->
        <div class="processing-beam-track" aria-hidden="true">
          <div class="processing-beam-fill" :style="{ width: ocrProgress > 0 ? `${ocrProgress}%` : undefined }"></div>
        </div>
        <p v-if="ocrProgress > 0" class="khmer-font" style="margin-top: 8px; font-weight: 600; color: var(--color-brand); text-align: center;">
          ដំណើរការ៖ {{ ocrProgress }}%
        </p>

        <!-- Timeout Awareness Warning -->
        <div v-if="isLongProcessing" class="processing-timeout-notice khmer-font">
          <AlertCircle :size="18" class="text-accent" />
          <span>{{ t('longProcessingNotice') }}</span>
        </div>
      </div>
    </div>

    <!-- OCR ERROR STATE (Human-readable tips + SCAN AGAIN button) -->
    <div v-if="ocrError && !isProcessing" class="mode-container scan-mode-container" role="alert">
      <div class="ocr-error-card glass-card">
        <div class="error-glow-icon bg-danger">
          <AlertCircle :size="40" />
        </div>
        <h2 class="error-title khmer-font">{{ t('ocrErrorTitle') }}</h2>
        <p class="error-desc khmer-font">{{ ocrError }}</p>

        <div class="error-tips-box khmer-font">
          <h3 class="tips-heading">{{ t('tipsHeading') }}</h3>
          <ul class="tips-list">
            <li>{{ t('tip1') }}</li>
            <li>{{ t('tip2') }}</li>
            <li>{{ t('tip3') }}</li>
            <li>{{ t('tip4') }}</li>
          </ul>
        </div>

        <button 
          ref="scanAgainErrorBtnRef"
          type="button" 
          class="btn btn-primary btn-scan-again-hero khmer-font"
          @click="handleScanAgain"
          :aria-label="t('scanAgainBtn')"
        >
          <Camera :size="24" />
          <span>{{ t('scanAgainBtn') }}</span>
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
