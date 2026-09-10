<script setup>
import { ref, onBeforeUnmount, nextTick, inject } from 'vue'
import { Upload, Camera, FileText, Trash2, X, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-vue-next'

const props = defineProps({
  isProcessing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['file-selected', 'clear-file', 'trigger-ocr'])
const speakAccessibility = inject('speakAccessibility', () => {})

const isDragActive = ref(false)
const selectedFile = ref(null)
const previewUrl = ref(null)

const isCameraMode = ref(false)
const videoRef = ref(null)
const canvasRef = ref(null)
let stream = null

const startCamera = async () => {
  isCameraMode.value = true
  speakAccessibility('កំពុងបើកកាមេរ៉ា សូមរង់ចាំ...')
  await nextTick()
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      speakAccessibility('កាមេរ៉ាបានបើករួចរាល់។ សូមតម្រង់ឯកសារក្នុងប្រអប់ ហើយចុចប៊ូតុងថតរូបភាព។')
    }
  } catch (error) {
    speakAccessibility('មិនអាចបើកកាមេរ៉ាបានទេ៖ ' + error.message)
    alert('មិនអាចបើកកាមេរ៉ាបានទេ / Unable to access camera: ' + error.message)
    isCameraMode.value = false
  }
}

const stopCamera = () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
  }
  isCameraMode.value = false
}

const captureImage = () => {
  if (!videoRef.value || !canvasRef.value) return
  
  const video = videoRef.value
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  
  canvas.width = video.videoWidth || 1280
  canvas.height = video.videoHeight || 720
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  
  canvas.toBlob((blob) => {
    if (blob) {
      const file = new File([blob], `document_scan_${Date.now()}.jpg`, { type: 'image/jpeg' })
      stopCamera()
      processFile(file)
      speakAccessibility('បានថតរូបភាពឯកសារជោគជ័យ។ រូបភាពបានផ្ទុកចូលប្រព័ន្ធរួចរាល់។')
    }
  }, 'image/jpeg', 0.92)
}

onBeforeUnmount(() => {
  stopCamera()
})

const handleDragEnter = () => {
  isDragActive.value = true
}

const handleDragLeave = () => {
  isDragActive.value = false
}

const handleDrop = (e) => {
  isDragActive.value = false
  const files = e.dataTransfer.files
  if (files && files.length > 0) {
    processFile(files[0])
  }
}

const handleFileSelect = (e) => {
  const files = e.target.files
  if (files && files.length > 0) {
    processFile(files[0])
  }
}

const processFile = (file) => {
  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf'
  
  if (!isImage && !isPdf) {
    alert('សូមជ្រើសរើសប្រភេទរូបភាព (JPG, PNG) ឬឯកសារ PDF')
    speakAccessibility('ទម្រង់ឯកសារមិនត្រឹមត្រូវ សូមជ្រើសរើសរូបភាព ឬ PDF')
    return
  }

  selectedFile.value = file
  emit('file-selected', file)

  if (isImage) {
    const reader = new FileReader()
    reader.onload = (e) => {
      previewUrl.value = e.target.result
    }
    reader.readAsDataURL(file)
  } else if (isPdf) {
    previewUrl.value = 'pdf'
  }
}

const clearFile = () => {
  selectedFile.value = null
  previewUrl.value = null
  isCameraMode.value = false
  emit('clear-file')
}

const triggerOcr = () => {
  if (!selectedFile.value || props.isProcessing) return
  emit('trigger-ocr')
}

const getFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<template>
  <div class="uploader-wrapper glass-card">
    <div class="card-header-bar">
      <div class="header-left">
        <div class="header-icon-box bg-accent">
          <Upload :size="20" />
        </div>
        <h2 class="card-title khmer-font">បញ្ចូល ឬថតឯកសារ</h2>
      </div>
      <div class="header-right">
        <span v-if="selectedFile" class="status-chip chip-ready khmer-font">
          <CheckCircle2 :size="14" />
          <span>បានត្រៀម</span>
        </span>
        <span v-else class="status-chip chip-idle khmer-font">
          <span>រង់ចាំឯកសារ</span>
        </span>
      </div>
    </div>

    <!-- State 1: Selection Modes (Upload File or Camera) -->
    <div v-if="!selectedFile && !isCameraMode" class="selection-body">
      <div class="selection-grid">
        <!-- Upload Card -->
        <div 
          class="action-tile drop-zone" 
          @click="$refs.fileInput.click()" 
          @dragenter.prevent="handleDragEnter" 
          @dragleave.prevent="handleDragLeave" 
          @dragover.prevent 
          @drop.prevent="handleDrop" 
          :class="{ 'drag-active': isDragActive }"
          tabindex="0"
          role="button"
          aria-label="ចុច ឬទម្លាក់ឯកសារនៅទីនេះដើម្បីផ្ទុក (Upload Document)"
          @keydown.enter="$refs.fileInput.click()"
          @keydown.space.prevent="$refs.fileInput.click()"
        >
          <input 
            type="file" 
            ref="fileInput" 
            class="hidden-input" 
            accept="image/*,application/pdf"
            @change="handleFileSelect"
          />
          <div class="tile-icon-circle bg-accent">
            <Upload :size="36" />
          </div>
          <h3 class="tile-title khmer-font">ផ្ទុកឯកសារ (Upload)</h3>
          <p class="tile-desc khmer-font">ចុចទីនេះ ឬអូសទម្លាក់រូបភាព / PDF</p>
          <span class="file-types-badge">PNG, JPG, WEBP, PDF</span>
        </div>

        <!-- Camera Card -->
        <div 
          class="action-tile camera-tile" 
          @click="startCamera"
          tabindex="0"
          role="button"
          aria-label="បើកកាមេរ៉ាដើម្បីថតឯកសារផ្ទាល់ (Open Camera)"
          @keydown.enter="startCamera"
          @keydown.space.prevent="startCamera"
        >
          <div class="tile-icon-circle bg-brand">
            <Camera :size="36" />
          </div>
          <h3 class="tile-title khmer-font">ថតឯកសារ (Camera)</h3>
          <p class="tile-desc khmer-font">ប្រើប្រាស់កាមេរ៉ាស្កេនផ្ទាល់</p>
          <span class="file-types-badge">Live Capture</span>
        </div>
      </div>
    </div>

    <!-- State 2: Camera Active Feed -->
    <div v-else-if="isCameraMode && !selectedFile" class="camera-body">
      <div class="camera-viewfinder">
        <video ref="videoRef" autoplay playsinline class="camera-video"></video>
        <canvas ref="canvasRef" style="display: none;"></canvas>

        <!-- Scanning overlay guide brackets for low-vision positioning -->
        <div class="viewfinder-overlay" aria-hidden="true">
          <div class="guide-corner top-left"></div>
          <div class="guide-corner top-right"></div>
          <div class="guide-corner bottom-left"></div>
          <div class="guide-corner bottom-right"></div>
          <div class="guide-scan-line"></div>
        </div>
      </div>

      <div class="camera-controls">
        <button 
          type="button" 
          class="btn btn-primary btn-capture khmer-font" 
          @click="captureImage"
          aria-label="ថតរូបភាពឯកសារ (Capture Image)"
        >
          <Camera :size="22" />
          <span>ថតរូបភាព (Capture)</span>
        </button>
        <button 
          type="button" 
          class="btn btn-secondary btn-cancel-camera khmer-font" 
          @click="stopCamera"
          aria-label="បិទកាមេរ៉ា (Close Camera)"
        >
          <X :size="20" />
          <span>បិទកាមេរ៉ា</span>
        </button>
      </div>
    </div>

    <!-- State 3: File Selected -> Document Preview & Action -->
    <div v-else class="preview-body">
      <div class="preview-container">
        <!-- PDF Document Preview -->
        <div v-if="previewUrl === 'pdf'" class="pdf-preview-box">
          <FileText :size="64" class="pdf-icon" />
          <span class="pdf-label khmer-font">ឯកសារ PDF (Document Ready)</span>
        </div>

        <!-- Image Document Preview -->
        <div v-else-if="previewUrl" class="image-preview-wrapper">
          <img :src="previewUrl" alt="ការមើលជាមុននៃឯកសារ" class="preview-img" />
        </div>
      </div>

      <!-- File Details Card -->
      <div class="file-details-card">
        <div class="details-left">
          <div class="details-icon bg-accent">
            <FileText :size="22" />
          </div>
          <div class="details-meta">
            <span class="file-name" :title="selectedFile?.name">{{ selectedFile?.name }}</span>
            <span class="file-size">{{ getFileSize(selectedFile?.size || 0) }}</span>
          </div>
        </div>
        <button 
          type="button" 
          class="btn-icon-danger" 
          @click="clearFile" 
          :disabled="isProcessing" 
          aria-label="លុបឯកសារនេះចេញ"
          title="លុបឯកសារ"
        >
          <Trash2 :size="20" />
        </button>
      </div>

      <!-- Start OCR Primary Action CTA -->
      <button 
        type="button" 
        class="btn btn-primary btn-process khmer-font" 
        @click="triggerOcr" 
        :disabled="isProcessing"
        aria-label="ចាប់ផ្តើមបម្លែងជាអត្ថបទ OCR"
      >
        <template v-if="isProcessing">
          <div class="spinner-sm" aria-hidden="true"></div>
          <span>កំពុងវិភាគ និងស្កេនអត្ថបទខ្មែរ...</span>
        </template>
        <template v-else>
          <Sparkles :size="22" />
          <span>បម្លែងជាអត្ថបទ (Start OCR)</span>
        </template>
      </button>
    </div>
  </div>
</template>

<style scoped src="./DocumentUploader.css"></style>
