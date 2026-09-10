<script setup>
import { ref, onMounted, onBeforeUnmount, inject } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Sparkles, BookOpen, FileCheck2, Cpu, Zap } from 'lucide-vue-next'
import DocumentUploader from '../components/DocumentUploader.vue'
import OcrPanel from '../components/OcrPanel.vue'
import TtsPanel from '../components/TtsPanel.vue'
import UserHistory from '../components/UserHistory.vue'
import AppToast from '../components/AppToast.vue'
import { detectTextGoogleVision, detectTextAzureVision } from '../services/ocr'
import { getFileFingerprint, getOcrCache, setOcrCache } from '../services/cache'

const router = useRouter()
const speakAccessibility = inject('speakAccessibility', () => {})

// Component Refs
const ttsPanelRef = ref(null)

// Global Application State
const isProcessing = ref(false)
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
    setTimeout(() => {
      dismissToast(id)
    }, duration)
  }
  return id
}

const dismissToast = (id) => {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

// Rich Sample Khmer Documents for 1-click test driving
const sampleLibrary = [
  {
    id: 'announcement',
    title: 'សេចក្តីជូនដំណឹង (Notice)',
    text: `ព្រះរាជាណាចក្រកម្ពុជា\nជាតិ សាសនា ព្រះមហាក្សត្រ\n---\nក្រសួងអប់រំ យុវជន និងកីឡា\nសេចក្តីជូនដំណឹង\nស្តីពីការប្រើប្រាស់ប្រព័ន្ធបច្ចេកវិទ្យាជំនួយសម្រាប់សិស្ស-និស្សិតដែលមានពិការភាពគំហើញ។ ក្រសួងសូមលើកទឹកចិត្តឱ្យគ្រឹះស្ថានសិក្សាទាំងអស់ពង្រឹងការប្រើប្រាស់ឧបករណ៍អានឯកសារជាសំឡេង (Screen Reader & OCR) ដើម្បីបង្កើនសមភាពក្នុងការទទួលបានចំណេះដឹង។`
  },
  {
    id: 'story',
    title: 'រឿងព្រេង: ធនញ្ជ័យ (Folk Story)',
    text: `កាលពីព្រេងនាយ មានកុមារម្នាក់ឈ្មោះធនញ្ជ័យ ជាក្មេងឆ្លាតវៃនិងមានប្រាជ្ញាលើសក្មេងដទៃ។ ធនញ្ជ័យតែងតែយកចំណេះដឹងនិងប្រាជ្ញាស្មារតីរបស់ខ្លួនមកដោះស្រាយបញ្ហាលំបាកៗក្នុងភូមិ និងជួយដល់ប្រជាជនស្លូតត្រង់។`
  },
  {
    id: 'poem',
    title: 'កំណាព្យ: ភុជង្គលីលា (Poem)',
    text: `សូមថ្វាយបង្គំ ព្រះពុទ្ធឧត្តម ប្រសើរថ្លៃថ្លា\nព្រះធម៌វរគុណ នាំចិត្តជ្រះថ្លា ព្រះសង្ឃសច្ចា រក្សាធម៌ពិត។\nកម្ពុជាថ្កុំថ្កើង រុងរឿងគង់វង្ស ដោយគុណកុសល សីលធម៌ប្រណិត។`
  }
]

// History Persistence Helpers
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

  // Deduplicate if top item is identical
  if (historyList.value.length > 0 && historyList.value[0].text === text) return

  historyList.value.unshift({
    id: Date.now(),
    name: name || 'ឯកសារស្កេនថ្មី (Scanned Doc)',
    text: text.trim(),
    timestamp: timeStr,
    date: dateStr,
    wordsCount,
    cached
  })

  // Limit to 20 items
  if (historyList.value.length > 20) {
    historyList.value = historyList.value.slice(0, 20)
  }
  saveHistory()
}

onMounted(() => {
  try {
    const saved = localStorage.getItem('songkhem_history')
    if (saved) {
      historyList.value = JSON.parse(saved)
    } else {
      // Seed with initial realistic scans for immediate usability
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

  // Global Keyboard Shortcuts (Space to play/pause, Ctrl+Enter to OCR)
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

const onFileSelected = (file) => {
  selectedFileName.value = file.name
  selectedFile.value = file
  extractedText.value = ''
  isCached.value = false
  addToast({ message: `បានជ្រើសរើស ${file.name}`, type: 'info' })
  speakAccessibility(`បានជ្រើសរើសឯកសារ ${file.name} រួចរាល់។ ចុច Ctrl+Enter ឬប៊ូតុងបម្លែងជាអត្ថបទ OCR។`)
}

const onClearFile = () => {
  selectedFileName.value = ''
  selectedFile.value = null
  extractedText.value = ''
  isCached.value = false
  isProcessing.value = false
  speakAccessibility('បានសម្អាតឯកសាររួចរាល់។')
}

const loadSample = (sample) => {
  selectedFileName.value = `${sample.title}.txt`
  selectedFile.value = new File([sample.text], `${sample.id}.txt`, { type: 'text/plain' })
  extractedText.value = sample.text
  isCached.value = true
  addToHistory(sample.title, sample.text, true)
  addToast({ message: `បានផ្ទុកគំរូ "${sample.title}"`, type: 'info' })
  speakAccessibility(`បានផ្ទុកគំរូអត្ថបទ ${sample.title} ជោគជ័យ។`)
}

const handleTriggerOcr = async () => {
  if (isProcessing.value || !selectedFile.value) return
  
  // 1. Check OCR Cache by file fingerprint for instantaneous hit
  const fingerprint = await getFileFingerprint(selectedFile.value)
  const cachedText = getOcrCache(fingerprint)

  if (cachedText) {
    extractedText.value = cachedText
    isCached.value = true
    addToHistory(selectedFileName.value, cachedText, true)
    addToast({ message: '⚡ បានផ្ទុកអត្ថបទពី Cache ភ្លាមៗ (Instant Hit)', type: 'cache' })
    speakAccessibility('បានផ្ទុកអត្ថបទស្កេនពី Cache ភ្លាមៗរួចរាល់។')
    return
  }

  isCached.value = false
  isProcessing.value = true

  // 2. Optimistic Rendering: insert in-progress item immediately into history
  const pendingId = 'pending_' + Date.now()
  const optimisticCard = {
    id: pendingId,
    name: selectedFileName.value || 'ឯកសារកំពុងស្កេន...',
    pending: true,
    timestamp: 'កំពុងស្កេន...',
    date: 'ថ្ងៃនេះ'
  }
  historyList.value.unshift(optimisticCard)
  speakAccessibility('កំពុងចាប់ផ្តើមស្កេនអត្ថបទខ្មែរ សូមរង់ចាំបន្តិច...')

  let ocrProvider = ''
  let envApiKey = ''
  let envEndpoint = ''

  if (import.meta.env.VITE_AZURE_VISION_API_KEY) {
    ocrProvider = 'azure-read'
    envApiKey = import.meta.env.VITE_AZURE_VISION_API_KEY
    envEndpoint = import.meta.env.VITE_AZURE_VISION_ENDPOINT
  } else if (import.meta.env.VITE_GOOGLE_VISION_API_KEY) {
    ocrProvider = 'google-vision'
    envApiKey = import.meta.env.VITE_GOOGLE_VISION_API_KEY
    envEndpoint = import.meta.env.VITE_GOOGLE_VISION_ENDPOINT
  }

  const finalizeOcr = (resultText) => {
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

    // Replace optimistic item with finalized
    const idx = historyList.value.findIndex(i => i.id === pendingId)
    if (idx !== -1) {
      historyList.value.splice(idx, 1, finalizedItem)
    } else {
      historyList.value.unshift(finalizedItem)
    }
    saveHistory()
    isProcessing.value = false
    addToast({ message: 'ស្កេនស្រង់អត្ថបទជោគជ័យ', type: 'success' })
  }

  if (envApiKey) {
    try {
      let text = ''
      if (ocrProvider === 'google-vision') {
        text = await detectTextGoogleVision(selectedFile.value, envApiKey, envEndpoint)
      } else if (ocrProvider === 'azure-read') {
        text = await detectTextAzureVision(selectedFile.value, envApiKey, envEndpoint)
      }
      finalizeOcr(text)
      speakAccessibility('បានស្កេនស្រង់អត្ថបទជោគជ័យ។')
    } catch (error) {
      console.error(error)
      speakAccessibility('មានកំហុសក្នុងការស្កេន API។ បានប្តូរទៅប្រើប្រព័ន្ធគំរូជំនួស។')
      const randomSample = sampleLibrary[Math.floor(Math.random() * sampleLibrary.length)]
      finalizeOcr(randomSample.text)
    }
  } else {
    // Realistic OCR Simulation with actual Khmer text
    setTimeout(() => {
      const randomSample = sampleLibrary[Math.floor(Math.random() * sampleLibrary.length)]
      finalizeOcr(randomSample.text)
      speakAccessibility('ការស្កេន OCR គំរូត្រូវបានបញ្ចប់ជោគជ័យ។ អត្ថបទបានបង្ហាញនៅផ្ទាំងខាងស្តាំ។')
    }, 1400)
  }
}

const handleReScan = () => {
  extractedText.value = ''
  handleTriggerOcr()
}

// User History Handlers
const onLoadHistoryItem = (item) => {
  selectedFileName.value = item.name
  extractedText.value = item.text
  isCached.value = !!item.cached
  addToast({ message: `បានផ្ទុក "${item.name}"`, type: 'info' })
}

const onQuickPlayHistoryItem = (item) => {
  selectedFileName.value = item.name
  extractedText.value = item.text
  isCached.value = !!item.cached
  addToast({ message: `ចាប់ផ្តើមអាន "${item.name}"`, type: 'info' })
  if (ttsPanelRef.value) {
    setTimeout(() => {
      ttsPanelRef.value.startSpeech()
    }, 100)
  }
}

// Optimistic deletion with interactive Undo snackbar
const onDeleteHistoryItem = (id) => {
  const idx = historyList.value.findIndex(i => i.id === id)
  if (idx === -1) return
  
  const deletedItem = historyList.value[idx]
  // Optimistically remove from list immediately
  historyList.value.splice(idx, 1)
  saveHistory()
  speakAccessibility(`បានលុបឯកសារ ${deletedItem.name}`)

  // Show interactive undo toast
  addToast({
    message: `បានលុប "${deletedItem.name}"`,
    type: 'warning',
    actionLabel: 'មិនធ្វើវិញ (Undo)',
    duration: 5000,
    onAction: () => {
      historyList.value.splice(idx, 0, deletedItem)
      saveHistory()
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
    message: 'បានសម្អាតប្រវត្តិស្កេនទាំងអស់',
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

const goBack = () => {
  speakAccessibility('ត្រឡប់ទៅទំព័រដើម')
  router.push('/')
}
</script>

<template>
  <div class="workspace-container">
    <!-- Header Navigation -->
    <header class="workspace-header glass-card">
      <div class="header-left">
        <button 
          class="btn-back" 
          @click="goBack" 
          aria-label="ត្រឡប់ទៅទំព័រដើម (Back to Home)" 
          title="ត្រឡប់ទៅទំព័រដើម"
        >
          <ArrowLeft :size="18" />
          <span class="khmer-font btn-back-text">ទំព័រដើម</span>
        </button>

        <div class="header-branding">
          <div class="logo-box">
            <img :src="'/logo.png'" alt="SONGKHEM Logo" class="app-logo-small" />
          </div>
          <div class="header-titles">
            <h1 class="header-title khmer-font">កន្លែងស្កេន និងអានឯកសារ</h1>
            <p class="header-subtitle khmer-font">Khmer Document OCR & Speech Reader Workspace</p>
          </div>
        </div>
      </div>

      <div class="header-right">
        <!-- Status Badge -->
        <div class="engine-badge khmer-font">
          <Cpu :size="15" class="text-accent" />
          <span>ម៉ាស៊ីន OCR & TTS ត្រៀមរួចជាស្រេច</span>
        </div>
      </div>
    </header>

    <!-- Sample Documents Quick Picker Bar -->
    <section class="sample-bar glass-card" aria-label="គំរូឯកសារសាកល្បងរហ័ស">
      <div class="sample-bar-label khmer-font">
        <BookOpen :size="16" class="text-accent" />
        <span>សាកល្បងជាមួយគំរូអត្ថបទរហ័ស៖</span>
      </div>
      <div class="sample-buttons">
        <button 
          v-for="sample in sampleLibrary" 
          :key="sample.id"
          class="sample-pill-btn khmer-font"
          @click="loadSample(sample)"
          :aria-label="`ផ្ទុកគំរូ ${sample.title}`"
        >
          <Sparkles :size="13" />
          <span>{{ sample.title }}</span>
        </button>
      </div>
    </section>

    <!-- Main Workspace Grid -->
    <div class="workspace-grid">
      <!-- Left Column: Document Scanner & User History -->
      <div class="column-left">
        <!-- 1. Document Uploader -->
        <section class="panel-section" aria-label="ផ្នែកផ្ទុកនិងថតឯកសារ">
          <DocumentUploader 
            :is-processing="isProcessing" 
            @file-selected="onFileSelected"
            @clear-file="onClearFile"
            @trigger-ocr="handleTriggerOcr"
          />
        </section>

        <!-- 2. User Scan History (Utilizing the Left Column Space) -->
        <section class="panel-section" aria-label="ផ្នែកប្រវត្តិស្កេនឯកសារ">
          <UserHistory 
            :history="historyList"
            @load-item="onLoadHistoryItem"
            @quick-play="onQuickPlayHistoryItem"
            @delete-item="onDeleteHistoryItem"
            @clear-history="onClearHistory"
          />
        </section>
      </div>

      <!-- Right Column: OCR Results & TTS Audio Player Deck -->
      <div class="column-right">
        <!-- 1. OCR Results Panel -->
        <section class="panel-section" aria-label="ផ្នែកលទ្ធផលអត្ថបទស្កេន">
          <OcrPanel 
            v-model:text="extractedText" 
            :is-processing="isProcessing"
            :file-name="selectedFileName"
            :is-cached="isCached"
            @toast="addToast"
            @re-scan="handleReScan"
          />
        </section>

        <!-- 2. Speech Playback (TTS) -->
        <section class="panel-section" aria-label="ផ្នែកអានអត្ថបទជាសំឡេង">
          <TtsPanel 
            ref="ttsPanelRef"
            :text="extractedText" 
          />
        </section>
      </div>
    </div>

    <!-- Accessible Toast Notifications (Undo Snackbars, Cache Hits, Alerts) -->
    <AppToast :toasts="toasts" @dismiss="dismissToast" />
  </div>
</template>

<style scoped src="./HomeScreen.css"></style>
