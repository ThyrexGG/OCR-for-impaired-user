<script setup>
import { ref, onMounted, onBeforeUnmount, inject, watch } from 'vue'
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
import { extractDocumentText } from '../services/ocr'
import { getFileFingerprint, getOcrCache, setOcrCache } from '../services/cache'

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
const ocrProgress = ref(0)
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
const sampleLibrary = [
  {
    id: 'announcement',
    title: 'សេចក្តីជូនដំណឹង (Notice)',
    category: 'ឯកសាររដ្ឋបាល',
    text: `ព្រះរាជាណាចក្រកម្ពុជា\nជាតិ សាសនា ព្រះមហាក្សត្រ\n---\nក្រសួងអប់រំ យុវជន និងកីឡា\nសេចក្តីជូនដំណឹង\nស្តីពីការប្រើប្រាស់ប្រព័ន្ធបច្ចេកវិទ្យាជំនួយសម្រាប់សិស្ស-និស្សិតដែលមានពិការភាពគំហើញ។ ក្រសួងសូមលើកទឹកចិត្តឱ្យគ្រឹះស្ថានសិក្សាទាំងអស់ពង្រឹងការប្រើប្រាស់ឧបករណ៍អានឯកសារជាសំឡេង (Screen Reader & OCR) ដើម្បីបង្កើនសមភាពក្នុងការទទួលបានចំណេះដឹង។`
  },
  {
    id: 'story',
    title: 'រឿងព្រេង: ធនញ្ជ័យ (Folk Story)',
    category: 'អក្សរសិល្ប៍',
    text: `កាលពីព្រេងនាយ មានកុមារម្នាក់ឈ្មោះធនញ្ជ័យ ជាក្មេងឆ្លាតវៃនិងមានប្រាជ្ញាលើសក្មេងដទៃ។ ធនញ្ជ័យតែងតែយកចំណេះដឹងនិងប្រាជ្ញាស្មារតីរបស់ខ្លួនមកដោះស្រាយបញ្ហាលំបាកៗក្នុងភូមិ និងជួយដល់ប្រជាជនស្លូតត្រង់។`
  },
  {
    id: 'poem',
    title: 'កំណាព្យ: ភុជង្គលីលា (Poem)',
    category: 'កំណាព្យខ្មែរ',
    text: `សូមថ្វាយបង្គំ ព្រះពុទ្ធឧត្តម ប្រសើរថ្លៃថ្លា\nព្រះធម៌វរគុណ នាំចិត្តជ្រះថ្លា ព្រះសង្ឃសច្ចា រក្សាធម៌ពិត។\nកម្ពុជាថ្កុំថ្កើង រុងរឿងគង់វង្ស ដោយគុណកុសល សីលធម៌ប្រណិត។`
  },
  {
    id: 'receipt',
    title: 'វិក័យប័ត្រទូទាត់ (Receipt)',
    category: 'ជីវភាពរស់នៅ',
    text: `ឱសថស្ថាន សុខភាពល្អ\nវិក័យប័ត្រទូទាត់ប្រាក់\nកាលបរិច្ឆេទ: ១៦ កញ្ញា ២០២៦\n---\n១. ថ្នាំបន្តក់ភ្នែក (Eye Drops): ២ ដប = $៦.០០\n២. វីតាមីន A (Vitamin A): ១ ប្រអប់ = $៤.៥០\nសរុបទាំងអស់: $១០.៥០\nសូមអរគុណ និងសូមជូនពរឱ្យឆាប់ជាសះស្បើយ!`
  }
]

// History Helpers
const saveHistory = () => {
  try {
    localStorage.setItem('songkhem_history', JSON.stringify(historyList.value))
  } catch (err) {
    console.error('History save error:', err)
  }
}

const addToHistory = (name, text, cached = false) => {
  if (!text || !text.trim()) return
  const now = new Date()
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('km-KH', { month: 'short', day: 'numeric' })
  const wordsCount = text.trim().split(/\s+/).filter(w => w.length > 0).length

  if (historyList.value.length > 0 && historyList.value[0].text === text) return

  historyList.value.unshift({
    id: Date.now(),
    name: name || 'ឯកសារស្កេនថ្មី',
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
  // Load history
  try {
    const saved = localStorage.getItem('songkhem_history')
    if (saved) {
      historyList.value = JSON.parse(saved)
    } else {
      historyList.value = [
        {
          id: 1,
          name: 'សេចក្តីជូនដំណឹង_ក្រសួង.pdf',
          text: sampleLibrary[0].text,
          timestamp: '10:30 AM',
          date: 'ថ្ងៃនេះ',
          wordsCount: 42
        },
        {
          id: 2,
          name: 'រឿងព្រេង_ធនញ្ជ័យ.jpg',
          text: sampleLibrary[1].text,
          timestamp: 'ម្សិលមិញ',
          date: 'ម្សិលមិញ',
          wordsCount: 38
        }
      ]
      saveHistory()
    }
  } catch (e) {
    console.warn('Could not load history:', e)
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
  triggerHaptic([60, 40])
  addToast({ message: `បានផ្ទុកគំរូ "${sample.title}"`, type: 'info' })
  speakAccessibility(`បានផ្ទុកគំរូ ${sample.title} ជោគជ័យ។ ចូលទៅផ្ទាំងអាន។`)
  setMode('reader')
  
  if (isAutoReadEnabled.value && ttsPanelRef.value) {
    setTimeout(() => {
      ttsPanelRef.value.startSpeech()
    }, 400)
  }
}

// Trigger OCR Execution
const handleTriggerOcr = async () => {
  if (isProcessing.value || !selectedFile.value) return
  
  ocrError.value = null
  isLongProcessing.value = false

  // 1. Check OCR Cache by file fingerprint
  const fingerprint = await getFileFingerprint(selectedFile.value)
  const cachedText = getOcrCache(fingerprint)

  if (cachedText) {
    extractedText.value = cachedText
    isCached.value = true
    addToHistory(selectedFileName.value, cachedText, true)
    addToast({ message: 'ផ្ទុកអត្ថបទពី Cache ភ្លាមៗ (Instant Hit)', type: 'cache' })
    triggerHaptic([60, 40, 60])
    speakAccessibility('បានស្កេន និងស្រង់អត្ថបទពី Cache ភ្លាមៗរួចរាល់')
    
    // Switch to Reader Mode
    setMode('reader')
    if (isAutoReadEnabled.value && ttsPanelRef.value) {
      setTimeout(() => { ttsPanelRef.value.startSpeech() }, 300)
    }
    return
  }

  isCached.value = false
  isProcessing.value = true
  triggerHaptic([80, 50, 80])
  speakAccessibility('កំពុងស្កេន និងស្រង់អត្ថបទ សូមរង់ចាំបន្តិច...')

  // Timeout warning after 5 seconds
  if (processingTimeoutId) clearTimeout(processingTimeoutId)
  processingTimeoutId = setTimeout(() => {
    if (isProcessing.value) {
      isLongProcessing.value = true
      speakAccessibility('ដំណើរការនេះអាចចំណាយពេលបន្តិច សូមកុំបិទទំព័រ (This is taking longer than usual)')
    }
  }, 5000)

  // Optimistic History item
  const pendingId = 'pending_' + Date.now()
  historyList.value.unshift({
    id: pendingId,
    name: selectedFileName.value || 'ឯកសារកំពុងស្កេន...',
    pending: true,
    timestamp: 'កំពុងស្កេន...',
    date: 'ថ្ងៃនេះ'
  })

  ocrProgress.value = 0

  const storedOcrEngine = localStorage.getItem('songkhem_ocr_engine') || 
    (import.meta.env.VITE_AZURE_VISION_API_KEY ? 'azure-read' : (import.meta.env.VITE_GOOGLE_VISION_API_KEY ? 'google-vision' : 'tesseract'))
  const googleApiKey = localStorage.getItem('songkhem_google_api_key') || import.meta.env.VITE_GOOGLE_VISION_API_KEY || ''
  const googleEndpoint = localStorage.getItem('songkhem_google_endpoint') || import.meta.env.VITE_GOOGLE_VISION_ENDPOINT || ''
  const azureApiKey = localStorage.getItem('songkhem_azure_vision_key') || import.meta.env.VITE_AZURE_VISION_API_KEY || ''
  const azureEndpoint = localStorage.getItem('songkhem_azure_vision_endpoint') || import.meta.env.VITE_AZURE_VISION_ENDPOINT || ''

  const ocrConfig = {
    provider: storedOcrEngine,
    googleApiKey,
    googleEndpoint,
    azureApiKey,
    azureEndpoint
  }

  const finalizeOcr = (resultText) => {
    if (processingTimeoutId) clearTimeout(processingTimeoutId)
    isLongProcessing.value = false
    ocrProgress.value = 100
    extractedText.value = resultText
    setOcrCache(fingerprint, resultText, selectedFileName.value)

    const wordsCount = resultText.trim().split(/\s+/).filter(w => w.length > 0).length
    const finalizedItem = {
      id: Date.now(),
      name: selectedFileName.value || 'ឯកសារស្កេនថ្មី',
      text: resultText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: 'ថ្ងៃនេះ',
      wordsCount
    }

    const idx = historyList.value.findIndex(i => i.id === pendingId)
    if (idx !== -1) {
      historyList.value.splice(idx, 1, finalizedItem)
    } else {
      historyList.value.unshift(finalizedItem)
    }
    saveHistory()
    isProcessing.value = false
    triggerHaptic([80, 40, 100])
    addToast({ message: 'ស្កេនស្រង់អត្ថបទជោគជ័យ', type: 'success' })
    speakAccessibility('បានស្កេនស្រង់អត្ថបទជោគជ័យ។ ចូលទៅផ្ទាំងអាន។')

    // Automatically transition to Reader mode and start speech if auto-read is enabled
    setMode('reader')
    if (isAutoReadEnabled.value && ttsPanelRef.value) {
      setTimeout(() => {
        ttsPanelRef.value.startSpeech()
      }, 400)
    }
  }

  const handleOcrFailure = (err) => {
    if (processingTimeoutId) clearTimeout(processingTimeoutId)
    isProcessing.value = false
    isLongProcessing.value = false
    ocrProgress.value = 0
    
    // Remove pending item from history
    const idx = historyList.value.findIndex(i => i.id === pendingId)
    if (idx !== -1) historyList.value.splice(idx, 1)

    ocrError.value = err.message || 'មិនអាចស្រង់អត្ថបទពីឯកសារនេះបានទេ'
    triggerHaptic([100, 60, 100])
    speakAccessibility(`មិនអាចស្រង់អត្ថបទពីឯកសារនេះបានទេ។ ${ocrError.value}`)
    nextTick(() => {
      scanAgainErrorBtnRef.value?.focus()
    })
  }

  try {
    const text = await extractDocumentText(selectedFile.value, ocrConfig, (progress) => {
      ocrProgress.value = progress
    })
    finalizeOcr(text)
  } catch (error) {
    console.error('OCR Extraction Error:', error)
    handleOcrFailure(error)
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
  if (ttsPanelRef.value) {
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
</script>

<template>
  <div class="assistant-workspace-wrapper">
    <!-- MODE 1 & 2: CAMERA (full-screen) + UPLOAD (dropzone & samples) share one flow -->
    <div v-show="activeMode === 'scan' || activeMode === 'upload'" class="mode-container scan-mode-container" :class="{ 'camera-fullscreen': activeMode === 'scan' }">
      <!-- Hero header only on the Upload page - the Camera page stays chrome-free for max viewfinder space -->
      <div v-if="activeMode === 'upload'" class="home-hero-deck">
        <div class="mode-hero-header">
          <h1 class="mode-hero-title khmer-font">ផ្ទុកឯកសារ ឬសាកល្បងគំរូ (Upload Document)</h1>
          <p class="mode-hero-subtitle khmer-font">
            ជ្រើសរើសរូបភាព ឬ PDF ពីទូរស័ព្ទ ឬសាកល្បងជាមួយឯកសារគំរូខាងក្រោម។
          </p>
        </div>
      </div>

      <!-- OCR PROCESSING STATE (Clear, timeout-aware screen) -->
      <div v-if="isProcessing" class="ocr-processing-card glass-card" role="status" aria-live="assertive">
        <div class="processing-glow-icon bg-brand">
          <Sparkles :size="36" />
        </div>
        <h2 class="processing-title khmer-font">កំពុងស្កេនឯកសារ (Scanning Document)</h2>
        <p class="processing-desc khmer-font">
          កំពុងស្រង់អត្ថបទខ្មែរ... សូមរង់ចាំបន្តិច (Extracting text... Please wait).
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
          <span>ដំណើរការនេះអាចចំណាយពេលបន្តិច សូមកុំបិទទំព័រ (This is taking longer than usual. Please keep the page open).</span>
        </div>
      </div>

      <!-- OCR ERROR STATE (Human-readable tips + SCAN AGAIN button) -->
      <div v-else-if="ocrError" class="ocr-error-card glass-card" role="alert">
        <div class="error-glow-icon bg-danger">
          <AlertCircle :size="40" />
        </div>
        <h2 class="error-title khmer-font">មិនអាចស្រង់អត្ថបទពីឯកសារនេះបានទេ</h2>
        <p class="error-desc khmer-font">{{ ocrError }}</p>

        <div class="error-tips-box khmer-font">
          <h3 class="tips-heading">វិធីដោះស្រាយដែលត្រូវបានណែនាំ (Recommended Tips)៖</h3>
          <ul class="tips-list">
            <li>សូមថតនៅកន្លែងដែលមានពន្លឺគ្រប់គ្រាន់ (Ensure good lighting).</li>
            <li>កាន់កាមេរ៉ាឱ្យនឹងនរ កុំឱ្យរំញ័រ (Hold camera steady).</li>
            <li>រំកិលកាមេរ៉ាឱ្យកៀកនឹងអត្ថបទបន្ថែមទៀត (Move closer to text).</li>
            <li>ថតរូបភាពសន្លឹកឯកសារម្តងទៀត (Take another photo).</li>
          </ul>
        </div>

        <button 
          ref="scanAgainErrorBtnRef"
          type="button" 
          class="btn btn-primary btn-scan-again-hero khmer-font"
          @click="handleScanAgain"
          aria-label="ស្កេនម្តងទៀត (Scan Again)"
        >
          <Camera :size="24" />
          <span>ស្កេនម្តងទៀត (SCAN AGAIN)</span>
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
      <div class="reader-layout-grid">
        <!-- Reading Canvas with Karaoke Highlighting & Options Drawer -->
        <OcrPanel 
          ref="ocrPanelRef"
          v-model:text="extractedText"
          :is-processing="isProcessing"
          :file-name="selectedFileName"
          :is-cached="isCached"
          :active-word-index="activeWordIndex"
          v-model:highlight-mode="highlightMode"
          :is-speaking="ttsPanelRef?.isSpeaking"
          @seek-word="onSeekWord"
          @read-aloud="handleReadAloud"
          @scan-again="handleScanAgain"
          @toast="addToast"
        />

        <!-- Tactile Audio Player Deck (Persistent Sticky at Bottom of View) -->
        <TtsPanel 
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
