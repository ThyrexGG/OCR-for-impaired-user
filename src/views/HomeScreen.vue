<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import DocumentUploader from '../components/DocumentUploader.vue'
import OcrPanel from '../components/OcrPanel.vue'
import TtsPanel from '../components/TtsPanel.vue'
import { detectTextGoogleVision, detectTextAzureVision } from '../services/ocr'

const router = useRouter()

// Global Application State
const isProcessing = ref(false)
const extractedText = ref('')
const selectedFileName = ref('')
const selectedFile = ref(null)

const khmerSampleTexts = [
  `ព្រះរាជាណាចក្រកម្ពុជា\nជាតិ សាសនា ព្រះមហាក្សត្រ\n---\nសេចក្តីជូនដំណឹង...`,
  `បទភុជង្គលីលា (កំណាព្យខ្មែរ)...`
]

const onFileSelected = (file) => {
  selectedFileName.value = file.name
  selectedFile.value = file
  extractedText.value = ''
}

const onClearFile = () => {
  selectedFileName.value = ''
  selectedFile.value = null
  extractedText.value = ''
  isProcessing.value = false
}

const handleTriggerOcr = async () => {
  if (isProcessing.value || !selectedFile.value) return
  
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

  if (envApiKey) {
    isProcessing.value = true
    try {
      let text = ''
      if (ocrProvider === 'google-vision') {
        text = await detectTextGoogleVision(selectedFile.value, envApiKey, envEndpoint)
      } else if (ocrProvider === 'azure-read') {
        text = await detectTextAzureVision(selectedFile.value, envApiKey, envEndpoint)
      }
      extractedText.value = text
    } catch (error) {
      console.error(error)
      alert(`កំហុស OCR API: ${error.message || 'មិនអាចដំណើរការបានទេ'}`)
    } finally {
      isProcessing.value = false
    }
  } else {
    isProcessing.value = true
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * khmerSampleTexts.length)
      extractedText.value = khmerSampleTexts[randomIndex]
      isProcessing.value = false
    }, 2000)
  }
}

const handleReScan = () => {
  extractedText.value = ''
  handleTriggerOcr()
}

const goBack = () => {
  router.push('/')
}
</script>

<template>
  <div class="app-container">
    <header class="app-header-compact">
      <button class="btn-back" @click="goBack">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <img :src="'/logo.png'" alt="SONGKHEM Logo" class="app-logo-small" />
      <div style="width: 24px"></div>
    </header>

    <main class="app-workspace">
      <div class="left-column">
        <!-- 1. Document Uploader -->
        <section class="section-block">
          <DocumentUploader 
            :is-processing="isProcessing" 
            @file-selected="onFileSelected"
            @clear-file="onClearFile"
            @trigger-ocr="handleTriggerOcr"
          />
        </section>
      </div>

      <div class="right-column">
        <!-- 2. OCR Results Display -->
        <section class="section-block">
          <OcrPanel 
            v-model:text="extractedText" 
            :is-processing="isProcessing"
            :file-name="selectedFileName"
            @re-scan="handleReScan"
          />
        </section>

        <!-- 3. Speech Playback (TTS) -->
        <section class="section-block">
          <TtsPanel 
            :text="extractedText"
          />
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 40px 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  background: white;
  padding: 16px 24px;
  border-radius: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.03);
}

.btn-back {
  background: #f1f5f9;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 12px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-back:hover {
  background: #e2e8f0;
  color: #0f172a;
  transform: scale(1.05);
}

.app-logo-small {
  height: 54px;
  width: auto;
  max-width: 220px;
  object-fit: contain;
}

.app-workspace {
  display: flex;
  flex-direction: column;
  gap: 24px;
  flex: 1;
}

.left-column, .right-column {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-block {
  width: 100%;
  height: 100%;
}

@media (max-width: 480px) {
  .app-container {
    padding: 16px 12px;
  }

  .app-header-compact {
    margin-bottom: 20px;
    padding: 12px 16px;
    border-radius: 16px;
  }

  .app-logo-small {
    height: 40px;
  }

  .app-workspace {
    gap: 16px;
  }

  .left-column, .right-column {
    gap: 16px;
  }
}

@media (min-width: 1000px) {
  .app-workspace {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }
}
</style>
