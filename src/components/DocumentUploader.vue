<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, inject, watch } from 'vue'
import { 
  Camera, Upload, FileText, Trash2, X, RefreshCw, 
  Sparkles, CheckCircle2, AlertCircle, Scan, Eye, ArrowRight, ShieldAlert
} from 'lucide-vue-next'

const props = defineProps({
  isProcessing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['file-selected', 'clear-file', 'trigger-ocr'])

const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})

// Input Modes: 'camera' | 'upload'
const activeInputTab = ref('camera')

// Camera & Video Elements
const videoRef = ref(null)
const canvasRef = ref(null)
let stream = null
const isCameraActive = ref(false)
const cameraError = ref(null)

// Guided Scanning State Machine
// 'ready' | 'position' | 'detected' | 'scanning'
const guidanceState = ref('ready')
const guidanceMessage = ref('កាមេរ៉ាត្រៀមរួចជាស្រេច (Camera ready). សូមតម្រង់ទៅកាន់ឯកសារ។')
let guidanceTimer = null

// Selected File State
const selectedFile = ref(null)
const previewUrl = ref(null)
const isDragActive = ref(false)

// Start Camera Stream
const startCamera = async () => {
  if (stream) stopCamera()
  
  cameraError.value = null
  guidanceState.value = 'ready'
  guidanceMessage.value = 'កាមេរ៉ាត្រៀមរួចជាស្រេច (Camera ready). កំពុងបើក...'
  speakAccessibility('កាមេរ៉ាត្រៀមរួចជាស្រេច សូមតម្រង់ទូរស័ព្ទទៅកាន់ឯកសារ')
  
  await nextTick()
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: { ideal: 'environment' }, 
        width: { ideal: 1920 }, 
        height: { ideal: 1080 } 
      }
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      isCameraActive.value = true
      startGuidanceSimulation()
      triggerHaptic(40)
    }
  } catch (error) {
    console.warn('Camera access error:', error)
    isCameraActive.value = false
    cameraError.value = 'កម្មវិធីមិនអាចបើកកាមេរ៉ាបានទេ (Camera permission denied or camera not found).'
    speakAccessibility('មិនអាចបើកកាមេរ៉ាបានទេ។ សូមពិនិត្យសិទ្ធិអនុញ្ញាត ឬជ្រើសរើសការផ្ទុកឯកសារជំនួសវិញ។')
  }
}

// Stop Camera Stream
const stopCamera = () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
  }
  isCameraActive.value = false
  if (guidanceTimer) {
    clearInterval(guidanceTimer)
    guidanceTimer = null
  }
}

// Smart Guidance State Progression
const startGuidanceSimulation = () => {
  if (guidanceTimer) clearInterval(guidanceTimer)
  
  let ticks = 0
  guidanceTimer = setInterval(() => {
    ticks++
    if (props.isProcessing || selectedFile.value) return

    if (ticks === 1) {
      guidanceState.value = 'position'
      guidanceMessage.value = 'សូមដាក់ឯកសារក្នុងប្រអប់ (Position document in frame)...'
    } else if (ticks === 3) {
      guidanceState.value = 'detected'
      guidanceMessage.value = 'បានរកឃើញឯកសារ! សូមកាន់ឱ្យនឹង (Document detected. Hold steady).'
      speakAccessibility('បានរកឃើញឯកសារ សូមកាន់ទូរស័ព្ទឱ្យនឹង')
      triggerHaptic([50, 40, 50])
    }
  }, 1400)
}

// Capture Snapshot & Initiate Scan
const captureAndScan = () => {
  if (!videoRef.value || !canvasRef.value) return
  
  triggerHaptic([60, 40, 80])
  speakAccessibility('បានថតរូបភាពឯកសារ។ កំពុងចាប់ផ្តើមស្កេន...')
  
  const video = videoRef.value
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  
  canvas.width = video.videoWidth || 1280
  canvas.height = video.videoHeight || 720
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  
  canvas.toBlob((blob) => {
    if (blob) {
      const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' })
      selectedFile.value = file
      previewUrl.value = URL.createObjectURL(blob)
      emit('file-selected', file)
      emit('trigger-ocr')
    }
  }, 'image/jpeg', 0.92)
}

// Process File Upload
const processFile = (file) => {
  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf'
  
  if (!isImage && !isPdf) {
    speakAccessibility('ទម្រង់ឯកសារមិនត្រឹមត្រូវ សូមជ្រើសរើសរូបភាព ឬ PDF')
    return
  }

  selectedFile.value = file
  emit('file-selected', file)
  triggerHaptic(40)

  if (isImage) {
    const reader = new FileReader()
    reader.onload = (e) => {
      previewUrl.value = e.target.result
    }
    reader.readAsDataURL(file)
  } else if (isPdf) {
    previewUrl.value = 'pdf'
  }
  speakAccessibility(`បានផ្ទុកឯកសារ ${file.name} រួចរាល់។ ចុចស្កេន និងអាន។`)
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

const clearSelection = () => {
  selectedFile.value = null
  previewUrl.value = null
  emit('clear-file')
  triggerHaptic(30)
  speakAccessibility('បានសម្អាតឯកសារ')
  if (activeInputTab.value === 'camera') {
    startCamera()
  }
}

const triggerManualOcr = () => {
  if (!selectedFile.value || props.isProcessing) return
  triggerHaptic([60, 40, 80])
  speakAccessibility('កំពុងចាប់ផ្តើមស្កេន និងស្រង់អត្ថបទ...')
  emit('trigger-ocr')
}

// Watch input tab changes
watch(activeInputTab, (newTab) => {
  if (newTab === 'camera') {
    startCamera()
  } else {
    stopCamera()
  }
})

onMounted(() => {
  if (activeInputTab.value === 'camera') {
    startCamera()
  }
})

onBeforeUnmount(() => {
  stopCamera()
})
</script>

<template>
  <div class="uploader-deck glass-card" role="region" aria-label="ផ្ទាំងថត និងបញ្ចូលឯកសារ">
    <!-- Top Input Mode Selector Tabs -->
    <div class="input-mode-header">
      <div class="input-tabs-segmented" role="tablist" aria-label="របៀបបញ្ចូលឯកសារ">
        <button 
          type="button" 
          role="tab" 
          class="mode-segment-btn khmer-font"
          :class="{ 'segment-active': activeInputTab === 'camera' }"
          :aria-selected="activeInputTab === 'camera'"
          @click="activeInputTab = 'camera'"
          aria-label="ប្រើកាមេរ៉ាស្កេនផ្ទាល់"
        >
          <Camera :size="18" />
          <span>កាមេរ៉ា (Camera)</span>
        </button>

        <button 
          type="button" 
          role="tab" 
          class="mode-segment-btn khmer-font"
          :class="{ 'segment-active': activeInputTab === 'upload' }"
          :aria-selected="activeInputTab === 'upload'"
          @click="activeInputTab = 'upload'"
          aria-label="ផ្ទុករូបភាព ឬ PDF"
        >
          <Upload :size="18" />
          <span>ផ្ទុកឯកសារ (Upload)</span>
        </button>
      </div>

      <!-- Quick status chip -->
      <div class="status-indicator-badge khmer-font" :class="`state-${guidanceState}`">
        <span class="live-dot" aria-hidden="true"></span>
        <span>{{ props.isProcessing ? 'កំពុងស្កេន...' : selectedFile ? 'ឯកសាររួចរាល់' : isCameraActive ? 'កាមេរ៉ាត្រៀមរួច' : 'រង់ចាំកាមេរ៉ា' }}</span>
      </div>
    </div>

    <!-- VIEW A: LIVE GUIDED CAMERA SCANNER -->
    <div v-if="activeInputTab === 'camera' && !selectedFile" class="camera-assistant-view">
      <!-- Camera Permission Error Recovery Box -->
      <div v-if="cameraError" class="camera-error-box khmer-font" role="alert">
        <div class="error-icon-col">
          <ShieldAlert :size="36" class="text-danger" />
        </div>
        <div class="error-text-col">
          <h3 class="error-heading">មិនអាចបើកកាមេរ៉ាបានទេ (Camera Permission Required)</h3>
          <p class="error-explanation">
            កម្មវិធីត្រូវការសិទ្ធិប្រើប្រាស់កាមេរ៉ាដើម្បីស្កេនឯកសារ។ ប្រសិនបើអ្នកបានចុច "Block" សូមអនុញ្ញាតតាមវិធីខាងក្រោម៖
          </p>
          <ol class="error-instructions-list">
            <li>ចុចលើរូបសោ ឬការកំណត់ (Lock/Settings icon) នៅខាងមុខអាសយដ្ឋានគេហទំព័រ (URL bar)។</li>
            <li>បើកសិទ្ធិ "Camera" ទៅជា "Allow"។</li>
            <li>ចុចប៊ូតុង "ព្យាយាមបើកកាមេរ៉ាម្តងទៀត" ខាងក្រោម។</li>
          </ol>
          <div class="error-recovery-actions">
            <button type="button" class="btn btn-primary btn-retry-cam" @click="startCamera">
              <RefreshCw :size="18" />
              <span>ព្យាយាមបើកកាមេរ៉ាម្តងទៀត (Try Camera Again)</span>
            </button>
            <button type="button" class="btn btn-secondary" @click="activeInputTab = 'upload'">
              <Upload :size="18" />
              <span>ផ្ទុករូបភាព ឬ PDF ជំនួសវិញ (Upload File Instead)</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Active Camera Viewfinder -->
      <div v-else class="viewfinder-wrapper">
        <div class="viewfinder-frame">
          <video ref="videoRef" autoplay playsinline class="live-video-stream"></video>
          <canvas ref="canvasRef" style="display: none;"></canvas>

          <!-- High-Contrast Visual Alignment Brackets -->
          <div class="viewfinder-hud" aria-hidden="true">
            <div class="hud-corner corner-tl" :class="{ 'corner-locked': guidanceState === 'detected' }"></div>
            <div class="hud-corner corner-tr" :class="{ 'corner-locked': guidanceState === 'detected' }"></div>
            <div class="hud-corner corner-bl" :class="{ 'corner-locked': guidanceState === 'detected' }"></div>
            <div class="hud-corner corner-br" :class="{ 'corner-locked': guidanceState === 'detected' }"></div>
            <div class="hud-laser-beam" :class="{ 'laser-active': isCameraActive }"></div>
          </div>

          <!-- Conversational Spoken Guidance Overlay Banner -->
          <div class="guidance-banner khmer-font" role="status" aria-live="assertive">
            <div class="guidance-pulse-icon">
              <Scan :size="20" class="text-accent" />
            </div>
            <span class="guidance-text">{{ guidanceMessage }}</span>
          </div>
        </div>

        <!-- Hero Capture Button -->
        <div class="camera-actions-deck">
          <button 
            type="button" 
            class="btn-hero-scan khmer-font" 
            @click="captureAndScan"
            :disabled="props.isProcessing || !isCameraActive"
            aria-label="ថតរូបភាពឯកសារ (Capture document) ចុច Enter"
            title="ថតរូបភាពឯកសារ (Capture document)"
          >
            <div class="btn-hero-content">
              <Camera :size="28" />
              <span class="hero-label">ថតរូបភាពឯកសារ (Capture Document)</span>
            </div>
            <kbd class="hero-kbd-hint">Enter</kbd>
          </button>
        </div>
      </div>
    </div>

    <!-- VIEW B: FILE UPLOAD DROPZONE -->
    <div v-else-if="activeInputTab === 'upload' && !selectedFile" class="upload-assistant-view">
      <div 
        class="tactile-dropzone" 
        @click="$refs.fileInput.click()" 
        @dragenter.prevent="isDragActive = true" 
        @dragleave.prevent="isDragActive = false" 
        @dragover.prevent 
        @drop.prevent="handleDrop" 
        :class="{ 'dropzone-active': isDragActive }"
        tabindex="0"
        role="button"
        aria-label="ចុច ឬទម្លាក់ឯកសាររូបភាព ឬ PDF នៅទីនេះដើម្បីស្កេន"
        @keydown.enter="$refs.fileInput.click()"
        @keydown.space.prevent="$refs.fileInput.click()"
      >
        <input 
          type="file" 
          ref="fileInput" 
          class="sr-only" 
          accept="image/*,application/pdf"
          @change="handleFileSelect"
        />
        <div class="dropzone-icon-circle bg-accent">
          <Upload :size="40" />
        </div>
        <h3 class="dropzone-title khmer-font">ចុចទីនេះដើម្បីជ្រើសឯកសារ ឬអូសទម្លាក់</h3>
        <p class="dropzone-desc khmer-font">គាំទ្ររូបភាព (JPG, PNG, WEBP) និងឯកសារ PDF</p>
        <span class="dropzone-badge khmer-font">ឯកសារអក្សរខ្មែរគ្រប់ប្រភេទ (Khmer & English Documents)</span>
      </div>
    </div>

    <!-- VIEW C: PREVIEW & ACTION (When a file/photo is captured) -->
    <div v-else class="preview-assistant-view">
      <div class="preview-media-container">
        <!-- PDF Badge Preview -->
        <div v-if="previewUrl === 'pdf'" class="pdf-card-preview">
          <FileText :size="60" class="text-accent" />
          <span class="pdf-name khmer-font">{{ selectedFile?.name }}</span>
        </div>
        <!-- Image Preview -->
        <div v-else class="image-box-preview">
          <img :src="previewUrl" alt="រូបភាពដែលបានថត" class="preview-image" />
        </div>
      </div>

      <!-- Action Bar -->
      <div class="preview-action-row">
        <button 
          type="button" 
          class="btn-retake-action khmer-font" 
          @click="clearSelection" 
          :disabled="props.isProcessing"
          aria-label="ថតឡើងវិញ ឬជ្រើសរើសឯកសារផ្សេង"
        >
          <RefreshCw :size="18" />
          <span>ថតឡើងវិញ (Re-take)</span>
        </button>

        <button 
          type="button" 
          class="btn-hero-scan btn-scan-now khmer-font" 
          @click="triggerManualOcr"
          :disabled="props.isProcessing"
          aria-label="ចាប់ផ្តើមស្កេន និងស្រង់អត្ថបទ"
        >
          <div class="btn-hero-content">
            <Sparkles :size="24" />
            <span>{{ props.isProcessing ? 'កំពុងស្រង់អត្ថបទ...' : 'ស្កេន និងស្រង់អត្ថបទ (Extract Text)' }}</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./DocumentUploader.css"></style>
