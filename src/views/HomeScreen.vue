<script setup>
import { ref, computed, onMounted, onBeforeUnmount, inject, watch } from 'vue'
import { useRouter } from 'vue-router'
import { 
  ArrowLeft, Sparkles, BookOpen, FileCheck2, Cpu, Zap, 
  Camera, ArrowRight, Eye, Play, Volume2,
  Upload, RefreshCw, AlertCircle, CheckCircle2, FileText
} from 'lucide-vue-next'
import DocumentUploader from '../components/DocumentUploader.vue'
import OcrPanel from '../components/OcrPanel.vue'
import TtsPanel from '../components/TtsPanel.vue'
import UserHistory from '../components/UserHistory.vue'
import AppToast from '../components/AppToast.vue'
import { ocrService } from '../services/ocrService'
import { storage, STORAGE_KEYS } from '../services/storage'
import { haptics } from '../services/haptics'
import { t, currentLang } from '../services/i18n'

const router = useRouter()

// Injected global accessibility context from App.vue
const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})
const activeMode = inject('activeMode', ref('scan'))
const setMode = inject('setMode', () => {})
const openSettings = inject('openSettings', () => {})
const openHelp = inject('openHelp', () => {})
const isAutoReadEnabled = inject('isAutoReadEnabled', ref(true))

// Component Refs
const ttsPanelRef = ref(null)
const ocrPanelRef = ref(null)
const scanAgainErrorBtnRef = ref(null)

// Core Application State
const isProcessing = ref(false)
const isLongProcessing = ref(false)
let processingTimeoutId = null
const ocrError = ref(null)

const extractedText = ref('')
const selectedFileName = ref('')
const selectedFile = ref(null)
const historyList = ref([])
const isCached = ref(false)

// Karaoke Highlighting Sync State
const activeWordIndex = ref(-1)
const highlightMode = ref('word') // 'word' | 'sentence' | 'paragraph'

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

// Realistic Khmer Sample Library
const rawSamples = [
  {
    id: 'announcement',
    titleKm: 'សេចក្តីជូនដំណឹង',
    titleEn: 'Official Notice',
    categoryKm: 'ឯកសាររដ្ឋបាល',
    categoryEn: 'Official Notice',
    text: `ព្រះរាជាណាចក្រកម្ពុជា\nជាតិ សាសនា ព្រះមហាក្សត្រ\n---\nក្រសួងអប់រំ យុវជន និងកីឡា\nសេចក្តីជូនដំណឹង\nស្តីពីការប្រើប្រាស់ប្រព័ន្ធបច្ចេកវិទ្យាជំនួយសម្រាប់សិស្ស-និស្សិតដែលមានពិការភាពគំហើញ។ ក្រសួងសូមលើកទឹកចិត្តឱ្យគ្រឹះស្ថានសិក្សាទាំងអស់ពង្រឹងការប្រើប្រាស់ឧបករណ៍អានឯកសារជាសំឡេង (Screen Reader & OCR) ដើម្បីបង្កើនសមភាពក្នុងការទទួលបានចំណេះដឹង។`
  },
  {
    id: 'story',
    titleKm: 'រឿងព្រេង: ធនញ្ជ័យ',
    titleEn: 'Folk Story: Thon Chey',
    categoryKm: 'អក្សរសិល្ប៍',
    categoryEn: 'Literature',
    text: `កាលពីព្រេងនាយ មានកុមារម្នាក់ឈ្មោះធនញ្ជ័យ ជាក្មេងឆ្លាតវៃនិងមានប្រាជ្ញាលើសក្មេងដទៃ។ ធនញ្ជ័យតែងតែយកចំណេះដឹងនិងប្រាជ្ញាស្មារតីរបស់ខ្លួនមកដោះស្រាយបញ្ហាលំបាកៗក្នុងភូមិ និងជួយដល់ប្រជាជនស្លូតត្រង់។`
  },
  {
    id: 'poem',
    titleKm: 'កំណាព្យ: ភុជង្គលីលា',
    titleEn: 'Poem: Bhuchang Leela',
    categoryKm: 'កំណាព្យខ្មែរ',
    categoryEn: 'Poetry',
    text: `សូមថ្វាយបង្គំ ព្រះពុទ្ធឧត្តម ប្រសើរថ្លៃថ្លា\nព្រះធម៌វរគុណ នាំចិត្តជ្រះថ្លា ព្រះសង្ឃសច្ចា រក្សាធម៌ពិត។\nកម្ពុជាថ្កុំថ្កើង រុងរឿងគង់វង្ស ដោយគុណកុសល សីលធម៌ប្រណិត។`
  },
  {
    id: 'receipt',
    titleKm: 'វិក័យប័ត្រទូទាត់',
    titleEn: 'Medical Receipt',
    categoryKm: 'ជីវភាពរស់នៅ',
    categoryEn: 'Daily Life',
    text: `ឱសថស្ថាន សុខភាពល្អ\nវិក័យប័ត្រទូទាត់ប្រាក់\nកាលបរិច្ឆេទ: ១៦ កញ្ញា ២០២៦\n---\n១. ថ្នាំបន្តក់ភ្នែក (Eye Drops): ២ ដប = $៦.០០\n២. វីតាមីន A (Vitamin A): ១ ប្រអប់ = $៤.៥០\nសរុបទាំងអស់: $១០.៥០\nសូមអរគុណ និងសូមជូនពរឱ្យឆាប់ជាសះស្បើយ!`
  }
]

const sampleLibrary = computed(() => {
  const isKm = currentLang.value === 'km'
  return rawSamples.map(s => ({
    id: s.id,
    title: isKm ? s.titleKm : s.titleEn,
    category: isKm ? s.categoryKm : s.categoryEn,
    text: s.text
  }))
})

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
  // Load history from storage repository
  const saved = storage.getJson(STORAGE_KEYS.HISTORY, null)
  if (saved && Array.isArray(saved) && saved.length > 0) {
    historyList.value = saved
  } else {
    historyList.value = [
      {
        id: 1,
        name: 'សេចក្តីជូនដំណឹង_ក្រសួង.pdf',
        text: rawSamples[0].text,
        timestamp: '10:30 AM',
        date: currentLang.value === 'km' ? 'ថ្ងៃនេះ' : 'Today',
        wordsCount: 42
      },
      {
        id: 2,
        name: 'រឿងព្រេង_ធនញ្ជ័យ.jpg',
        text: rawSamples[1].text,
        timestamp: currentLang.value === 'km' ? 'ម្សិលមិញ' : 'Yesterday',
        date: currentLang.value === 'km' ? 'ម្សិលមិញ' : 'Yesterday',
        wordsCount: 38
      }
    ]
    saveHistory()
  }

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
      if (ttsPanelRef.value) {
        ttsPanelRef.value.togglePlayback()
      }
    } else if (e.key === 'Escape') {
      if (ttsPanelRef.value) {
        ttsPanelRef.value.stopPlayback()
      }
    }
  }

  window.addEventListener('keydown', handleGlobalKeydown)
  onBeforeUnmount(() => window.removeEventListener('keydown', handleGlobalKeydown))
})

// File Events
const onFileSelected = (file) => {
  selectedFileName.value = file.name
  selectedFile.value = file
  extractedText.value = ''
  ocrError.value = null
  isCached.value = false
  addToast({ message: `បានជ្រើសរើស ${file.name}`, type: 'info' })
}

const onClearFile = () => {
  selectedFileName.value = ''
  selectedFile.value = null
  extractedText.value = ''
  ocrError.value = null
  isCached.value = false
  isProcessing.value = false
}

// Sample Loader
const loadSample = (sample) => {
  selectedFileName.value = `${sample.title}.txt`
  selectedFile.value = new File([sample.text], `${sample.id}.txt`, { type: 'text/plain' })
  extractedText.value = sample.text
  ocrError.value = null
  isCached.value = true
  addToHistory(sample.title, sample.text, true)
  haptics.pulse('selection')
  addToast({ message: `${t('toastLoadedDoc')} "${sample.title}"`, type: 'info' })
  speakAccessibility(t('readingSampleSuccess'))
  setMode('reader')
  
  if (isAutoReadEnabled.value && ttsPanelRef.value) {
    setTimeout(() => {
      ttsPanelRef.value.startSpeech()
    }, 400)
  }
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
  if (processingTimeoutId) clearTimeout(processingTimeoutId)
  processingTimeoutId = setTimeout(() => {
    if (isProcessing.value) {
      isLongProcessing.value = true
      speakAccessibility(t('longProcessingNotice'))
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

  const result = await ocrService.recognize(selectedFile.value)

  if (processingTimeoutId) clearTimeout(processingTimeoutId)
  isProcessing.value = false
  isLongProcessing.value = false

  if (result.ok) {
    const { text, cached, wordsCount } = result.data
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
    speakAccessibility(`${t('toastScannedSuccess')} ${wordsCount} ${t('wordsCount')}`)

    // Transition to Reader mode and start speech if auto-read is enabled
    setMode('reader')
    if (isAutoReadEnabled.value && ttsPanelRef.value) {
      setTimeout(() => {
        ttsPanelRef.value.startSpeech()
      }, 400)
    }
  } else {
    // Remove pending item from history
    const idx = historyList.value.findIndex(i => i.id === pendingId)
    if (idx !== -1) historyList.value.splice(idx, 1)

    ocrError.value = result.error.message
    haptics.pulse('error')
    speakAccessibility(`${t('ocrErrorTitle')} - ${result.error.message}`)
    nextTick(() => {
      scanAgainErrorBtnRef.value?.focus()
    })
  }
}

// History Actions
const onLoadHistoryItem = (item) => {
  selectedFileName.value = item.name
  extractedText.value = item.text
  ocrError.value = null
  isCached.value = !!item.cached
  addToast({ message: `បានផ្ទុក "${item.name}"`, type: 'info' })
  setMode('reader')
}

const onQuickPlayHistoryItem = (item) => {
  selectedFileName.value = item.name
  extractedText.value = item.text
  ocrError.value = null
  isCached.value = !!item.cached
  addToast({ message: `ចាប់ផ្តើមអាន "${item.name}"`, type: 'info' })
  setMode('reader')
  if (ttsPanelRef.value) {
    setTimeout(() => { ttsPanelRef.value.startSpeech() }, 300)
  }
}

const onDeleteHistoryItem = (id) => {
  const idx = historyList.value.findIndex(i => i.id === id)
  if (idx === -1) return
  
  const deletedItem = historyList.value[idx]
  historyList.value.splice(idx, 1)
  saveHistory()

  addToast({
    message: `បានលុប "${deletedItem.name}"`,
    type: 'warning',
    actionLabel: 'មិនធ្វើវិញ (Undo)',
    duration: 6000,
    onAction: () => {
      historyList.value.splice(idx, 0, deletedItem)
      saveHistory()
      triggerHaptic(40)
      speakAccessibility(`បានស្តារឡើងវិញនូវឯកសារ ${deletedItem.name}`)
      addToast({ message: `បានស្តារ "${deletedItem.name}" ឡើងវិញ`, type: 'success' })
    }
  })
}

const onClearHistory = () => {
  const previousHistory = [...historyList.value]
  historyList.value = []
  saveHistory()
  
  addToast({
    message: 'បានសម្អាតប្រវត្តិអានទាំងអស់',
    type: 'warning',
    actionLabel: 'មិនធ្វើវិញ (Undo)',
    duration: 6000,
    onAction: () => {
      historyList.value = previousHistory
      saveHistory()
      addToast({ message: 'បានស្តារប្រវត្តិឡើងវិញ', type: 'success' })
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
  ocrError.value = null
  selectedFile.value = null
  selectedFileName.value = ''
  extractedText.value = ''
  if (ttsPanelRef.value) {
    ttsPanelRef.value.stopPlayback()
  }
  setMode('scan')
  speakAccessibility('ត្រឡប់ទៅការស្កេនឯកសារ')
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
    <!-- MODE 1 & 2: CAMERA (full-screen) + UPLOAD (dropzone & samples) with Instagram-style swipe navigation -->
    <div 
      v-if="activeMode === 'scan' || activeMode === 'upload'" 
      class="mode-container scan-mode-container" 
      :class="{ 'camera-fullscreen': activeMode === 'scan' }"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
    >
      <!-- OCR PROCESSING STATE (Clear, timeout-aware screen) -->
      <div v-if="isProcessing" class="ocr-processing-card glass-card" role="status" aria-live="assertive">
        <div class="processing-glow-icon bg-brand">
          <Sparkles :size="36" />
        </div>
        <h2 class="processing-title khmer-font">{{ t('scanningTitle') }}</h2>
        <p class="processing-desc khmer-font">
          {{ t('scanningDesc') }}
        </p>

        <!-- Shimmer Progress Beam -->
        <div class="processing-beam-track" aria-hidden="true">
          <div class="processing-beam-fill"></div>
        </div>

        <!-- Timeout Awareness Warning -->
        <div v-if="isLongProcessing" class="processing-timeout-notice khmer-font">
          <AlertCircle :size="18" class="text-accent" />
          <span>{{ t('longProcessingNotice') }}</span>
        </div>
      </div>

      <!-- OCR ERROR STATE (Human-readable tips + SCAN AGAIN button) -->
      <div v-else-if="ocrError" class="ocr-error-card glass-card" role="alert">
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

      <!-- Camera Viewfinder (scan tab) or Upload Dropzone + Samples (upload tab) -->
      <DocumentUploader
        v-else
        :mode="activeMode === 'upload' ? 'upload' : 'camera'"
        :is-processing="isProcessing"
        :samples="sampleLibrary"
        @file-selected="onFileSelected"
        @clear-file="onClearFile"
        @trigger-ocr="handleTriggerOcr"
        @load-sample="loadSample"
        @switch-mode="setMode"
      />
    </div>

    <!-- MODE 3: READING MODE (Unified Khmer Document Reader & Karaoke Deck) -->
    <div v-show="activeMode === 'reader'" class="mode-container reader-mode-container">
      <div class="reader-layout-grid" :class="{ 'reader-grid-empty': !extractedText }">
        <!-- Reading Canvas or Upload-style Empty State -->
        <OcrPanel 
          ref="ocrPanelRef"
          v-model:text="extractedText"
          :is-processing="isProcessing"
          :file-name="selectedFileName"
          :is-cached="isCached"
          :active-word-index="activeWordIndex"
          v-model:highlight-mode="highlightMode"
          :is-speaking="ttsPanelRef?.isSpeaking"
          :samples="sampleLibrary"
          @seek-word="onSeekWord"
          @read-aloud="handleReadAloud"
          @scan-again="handleScanAgain"
          @load-sample="loadSample"
          @switch-mode="setMode"
          @toast="addToast"
        />

        <!-- Tactile Audio Player Deck (Persistent Sticky at Bottom of View) ONLY when text is present -->
        <TtsPanel 
          v-if="extractedText"
          ref="ttsPanelRef"
          :text="extractedText"
          v-model:active-word-index="activeWordIndex"
          @scan-again="handleScanAgain"
        />
      </div>
    </div>

    <!-- MODE 4: RECENT READS MODE (Accessible History Shelf) -->
    <div v-show="activeMode === 'recent'" class="mode-container recent-mode-container">
      <UserHistory 
        :history="historyList"
        @load-item="onLoadHistoryItem"
        @quick-play="onQuickPlayHistoryItem"
        @delete-item="onDeleteHistoryItem"
        @clear-history="onClearHistory"
      />
    </div>

    <!-- Accessible Toast Notifications & Undo Snackbars -->
    <AppToast :toasts="toasts" @dismiss="dismissToast" />
  </div>
</template>

<style scoped src="./HomeScreen.css"></style>
