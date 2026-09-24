<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, inject, watch } from 'vue'
import { 
  Camera, Upload, FileText, Trash2, X, RefreshCw,
  Sparkles, CheckCircle2, AlertCircle, Scan, Eye, ArrowRight, ShieldAlert
} from 'lucide-vue-next'
import { t, currentLang } from '../services/i18n'
import { haptics } from '../services/haptics'

const props = defineProps({
  isProcessing: {
    type: Boolean,
    default: false
  },
  samples: {
    type: Array,
    default: () => []
  },
  // Which nav tab is driving this view: 'camera' | 'upload' (switching is done via the bottom nav now)
  mode: {
    type: String,
    default: 'camera'
  }
})

const emit = defineEmits(['file-selected', 'clear-file', 'trigger-ocr', 'load-sample', 'switch-mode'])

const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})

// Input Modes: 'camera' | 'upload' - mirrors the `mode` prop so the camera lifecycle
// (start/stop) reacts the same way whether the switch came from a prop change or internally.
const activeInputTab = ref(props.mode)
watch(() => props.mode, (newMode) => {
  activeInputTab.value = newMode
  if (newMode !== 'camera') {
    stopCamera()
  }
})

// Camera & Video Elements
const videoRef = ref(null)
const canvasRef = ref(null)
let stream = null
const isCameraActive = ref(false)
const cameraError = ref(null)

// Guided Scanning State Machine
// 'ready' | 'position' | 'detected' | 'scanning'
const guidanceState = ref('ready')
const guidanceMessage = ref(t('cameraReady'))
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
  guidanceMessage.value = t('cameraStarting')
  speakAccessibility(t('cameraStarting'))
  
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
    cameraError.value = t('cameraPermissionDenied')
    speakAccessibility(t('cameraPermissionDenied'))
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

// Simple Camera Framing & Readiness Cue (Honest framing guidance, not simulated AI detection)
const startGuidanceSimulation = () => {
  if (guidanceTimer) clearInterval(guidanceTimer)
  
  guidanceState.value = 'position'
  guidanceMessage.value = t('alignCameraPrompt')
  
  let ticks = 0
  guidanceTimer = setInterval(() => {
    ticks++
    if (props.isProcessing || selectedFile.value) return

    if (ticks === 2) {
      guidanceState.value = 'ready'
      guidanceMessage.value = t('cameraReadyCapture')
      speakAccessibility(t('cameraReadyCapture'))
      triggerHaptic([40, 30])
    }
  }, 1200)
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
      triggerHaptic('success')
    }
  }, 'image/jpeg', 0.95)
}

// File Drag & Drop Handlers
const handleDrop = (e) => {
  isDragActive.value = false
  const files = e.dataTransfer.files
  if (files && files.length > 0) {
    processFile(files[0])
  }
}

const processFile = (file) => {
  if (!file) return

  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf'

  if (!isImage && !isPdf) {
    speakAccessibility(t('formatUnsupported'))
    return
  }

  selectedFile.value = file
  if (isPdf) {
    previewUrl.value = 'pdf'
  } else {
    previewUrl.value = URL.createObjectURL(file)
  }

  triggerHaptic('success')
  speakAccessibility(`${t('fileUploaded')} ${file.name}`)
  emit('file-selected', file)
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
  haptics.pulse('tap')
  speakAccessibility(t('fileCleared'))
  if (activeInputTab.value === 'camera') {
    startCamera()
  }
}

const triggerManualOcr = () => {
  if (!selectedFile.value || props.isProcessing) return
  haptics.pulse('shutter')
  speakAccessibility(t('scanningDesc'))
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
  <div class="uploader-deck glass-card" :class="{ 'deck-camera-fullscreen': activeInputTab === 'camera' }" role="region" :aria-label="t('navScan')">
    <!-- VIEW A: LIVE GUIDED CAMERA SCANNER -->
    <div v-if="activeInputTab === 'camera' && !selectedFile" class="camera-assistant-view">
      <!-- Camera Permission Error Recovery Box -->
      <div v-if="cameraError" class="camera-error-box khmer-font" role="alert">
        <div class="error-icon-col">
          <ShieldAlert :size="36" class="text-danger" />
        </div>
        <div class="error-text-col">
          <h3 class="error-heading">{{ t('cameraPermissionRequired') }}</h3>
          <p class="error-explanation">
            {{ t('cameraPermNotice') }}
          </p>
          <ol class="error-instructions-list">
            <li>{{ t('cameraInstruction1') }}</li>
            <li>{{ t('cameraInstruction2') }}</li>
            <li>{{ t('cameraInstruction3') }}</li>
          </ol>
          <div class="error-recovery-actions">
            <button type="button" class="btn btn-primary btn-retry-cam" @click="startCamera">
              <RefreshCw :size="18" />
              <span>{{ t('tryCameraAgain') }}</span>
            </button>
            <button type="button" class="btn btn-secondary" @click="activeInputTab = 'upload'; $emit('switch-mode', 'upload'); stopCamera();">
              <Upload :size="18" />
              <span>{{ t('uploadFileInstead') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Active Camera Viewfinder: video fills all available space, controls float on top -->
      <div v-else class="viewfinder-wrapper">
        <div class="viewfinder-frame">
          <video ref="videoRef" autoplay playsinline class="live-video-stream"></video>
          <canvas ref="canvasRef" style="display: none;"></canvas>

          <!-- High-Contrast Visual Alignment Brackets -->
          <div class="viewfinder-hud" aria-hidden="true">
            <div class="hud-corner corner-tl" :class="{ 'corner-locked': guidanceState === 'ready' }"></div>
            <div class="hud-corner corner-tr" :class="{ 'corner-locked': guidanceState === 'ready' }"></div>
            <div class="hud-corner corner-bl" :class="{ 'corner-locked': guidanceState === 'ready' }"></div>
            <div class="hud-corner corner-br" :class="{ 'corner-locked': guidanceState === 'ready' }"></div>
          </div>

          <!-- Conversational Spoken Guidance Overlay Banner (near the top, out of the shutter's way) -->
          <div class="guidance-banner khmer-font" role="status" aria-live="assertive">
            <div class="guidance-pulse-icon">
              <Scan :size="20" class="text-accent" />
            </div>
            <span class="guidance-text">{{ guidanceMessage }}</span>
          </div>

          <!-- Circular Shutter Button -->
          <div class="camera-actions-deck">
            <button 
              type="button" 
              class="btn-shutter" 
              @click="captureAndScan" 
              :disabled="props.isProcessing || !isCameraActive"
              :aria-label="t('capturePhotoAria')"
              :title="t('capturePhotoAria')"
            >
              <div class="shutter-ring"></div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- VIEW B: FILE UPLOAD DROPZONE (SURFACES.md 8: Tinted zone, solid button, no border) -->
    <div v-else-if="activeInputTab === 'upload' && !selectedFile" class="upload-assistant-view">
      <div 
        class="tactile-dropzone" 
        @dragenter.prevent="isDragActive = true" 
        @dragleave.prevent="isDragActive = false" 
        @dragover.prevent 
        @drop.prevent="handleDrop" 
        :class="{ 'dropzone-active': isDragActive }"
        role="region"
        :aria-label="t('dropzoneTitle')"
      >
        <input 
          type="file" 
          ref="fileInput" 
          class="sr-only" 
          accept="image/*,application/pdf"
          @change="handleFileSelect"
        />
        <div class="dropzone-icon-circle">
          <Upload :size="36" />
        </div>
        <h3 class="dropzone-title khmer-font">{{ t('dropzoneTitle') }}</h3>
        <p class="dropzone-desc khmer-font">{{ t('dropzoneSub') }}</p>

        <!-- Solid 56px Primary Button per SURFACES.md 8 -->
        <button 
          type="button"
          class="btn-choose-file khmer-font"
          @click="$refs.fileInput.click()"
          :aria-label="t('chooseFileBtn')"
        >
          <Upload :size="20" />
          <span>{{ t('chooseFileBtn') }}</span>
        </button>

        <!-- Plain helper text per SURFACES.md 6 & 8 (not a button-like pill) -->
        <p class="dropzone-helper-text khmer-font">{{ t('dropzoneBadge') }}</p>
      </div>

      <!-- Quick Use-Case Sample Documents: unboxed list with chevron, underlined title on hover, hairlines (SURFACES.md 8 & 11) -->
      <section v-if="props.samples && props.samples.length > 0" class="sample-documents-section" :aria-label="t('sampleHeading')">
        <div class="sample-sec-header">
          <Sparkles :size="24" class="text-heading" />
          <h2 class="sample-sec-title khmer-font">{{ t('sampleHeading') }}</h2>
        </div>
        <div class="sample-unboxed-list" role="list">
          <div 
            v-for="(sample, idx) in props.samples" 
            :key="sample.id"
            class="sample-row-wrapper"
            role="listitem"
          >
            <div v-if="idx > 0" class="sample-hairline-divider" aria-hidden="true"></div>
            <button
              type="button"
              class="sample-list-item khmer-font"
              @click="$emit('load-sample', sample)"
              :aria-label="`${t('openAction')} ${sample.title}`"
            >
              <div class="sample-item-text">
                <span class="sample-item-category">{{ sample.category }}</span>
                <span class="sample-item-title">{{ sample.title }}</span>
              </div>
              <ArrowRight :size="26" class="sample-item-chevron" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- VIEW C: PREVIEW & ACTION (When a file/photo is captured) -->
    <div v-else-if="selectedFile" class="preview-assistant-view">
      <div class="preview-media-container">
        <!-- PDF Badge Preview -->
        <div v-if="previewUrl === 'pdf'" class="pdf-card-preview">
          <FileText :size="60" class="text-accent" />
          <span class="pdf-name khmer-font">{{ selectedFile?.name }}</span>
        </div>
        <!-- Image Preview -->
        <div v-else class="image-box-preview">
          <img :src="previewUrl" alt="Preview" class="preview-image" />
        </div>
      </div>

      <!-- Action Bar -->
      <div class="preview-action-row">
        <button 
          type="button" 
          class="btn-retake-action khmer-font" 
          @click="clearSelection" 
          :disabled="props.isProcessing"
          :aria-label="t('retake')"
        >
          <RefreshCw :size="18" />
          <span>{{ t('retake') }}</span>
        </button>

        <button 
          type="button" 
          class="btn-hero-scan btn-scan-now khmer-font" 
          @click="triggerManualOcr"
          :disabled="props.isProcessing"
          :aria-label="t('extractText')"
        >
          <div class="btn-hero-content">
            <Sparkles :size="24" />
            <span>{{ props.isProcessing ? t('extractingText') : t('extractText') }}</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./DocumentUploader.css"></style>
