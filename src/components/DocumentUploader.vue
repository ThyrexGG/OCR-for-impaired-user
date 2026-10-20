<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, inject, watch } from 'vue'
import { 
  Camera, Upload, FileText, Trash2, X, RefreshCw,
  Sparkles, CheckCircle2, AlertCircle, Scan, Eye, ArrowRight, ShieldAlert
} from 'lucide-vue-next'
import { t, currentLang } from '../services/i18n'
import { haptics } from '../services/haptics'
import { cropImageToRegion } from '../services/khmerOcrCorrector'

const props = defineProps({
  isProcessing: {
    type: Boolean,
    default: false
  },
  recentDocs: {
    type: Array,
    default: () => []
  },
  // Which nav tab is driving this view: 'camera' | 'upload' (switching is done via the bottom nav now)
  mode: {
    type: String,
    default: 'camera'
  }
})

const emit = defineEmits(['file-selected', 'clear-file', 'trigger-ocr', 'open-recent', 'switch-mode'])

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
const hudRef = ref(null)
let stream = null
const isCameraActive = ref(false)
const cameraError = ref(null)

// Camera Scan Border Mode: 'full' | 'skip-logo' | 'receipt'
const cameraFrameMode = ref('full')

// Preview Crop / Logo-Skip Mode for uploaded or captured images: 'full' | 'skip-logo' | 'center'
const previewCropMode = ref('full')
const originalFile = ref(null)

// Guided Scanning State Machine
// 'ready' | 'position' | 'detected' | 'scanning'
const guidanceState = ref('ready')
const guidanceMessage = ref(t('cameraReady'))
let guidanceTimer = null

// Selected File State
const selectedFile = ref(null)
const previewUrl = ref(null)
const isDragActive = ref(false)

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

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

// Real Camera Luminosity & Framing Assistance for Visually Impaired Users
const sampleCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
if (sampleCanvas) {
  sampleCanvas.width = 64
  sampleCanvas.height = 64
}

let lastSpokenGuidance = ''

const startGuidanceSimulation = () => {
  if (guidanceTimer) clearInterval(guidanceTimer)
  
  guidanceState.value = 'position'
  guidanceMessage.value = t('alignCameraPrompt')
  lastSpokenGuidance = ''
  
  let checks = 0
  guidanceTimer = setInterval(() => {
    if (props.isProcessing || selectedFile.value || !videoRef.value || !sampleCanvas) return
    checks++

    try {
      const v = videoRef.value
      if (v.readyState >= 2 && v.videoWidth > 0) {
        const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true })
        sCtx.drawImage(v, 0, 0, 64, 64)
        const frameData = sCtx.getImageData(0, 0, 64, 64).data
        let totalLuminance = 0
        const totalPixels = 64 * 64

        for (let i = 0; i < frameData.length; i += 4) {
          totalLuminance += (0.299 * frameData[i] + 0.587 * frameData[i + 1] + 0.114 * frameData[i + 2])
        }
        const avgLuminance = totalLuminance / totalPixels

        if (avgLuminance < 40) {
          guidanceState.value = 'position'
          const msg = currentLang.value === 'km' 
            ? 'ពន្លឺងងឹតពេក សូមបើកភ្លើង ឬថតនៅកន្លែងមានពន្លឺ' 
            : 'Too dark. Please turn on lights or find brighter area'
          guidanceMessage.value = msg
          if (checks % 3 === 0 && lastSpokenGuidance !== 'dark') {
            lastSpokenGuidance = 'dark'
            speakAccessibility(msg)
          }
        } else if (avgLuminance > 230) {
          guidanceState.value = 'position'
          const msg = currentLang.value === 'km' 
            ? 'ពន្លឺចាំងខ្លាំងពេក សូមផ្លាស់ប្តូរមុំកាមេរ៉ា' 
            : 'Too much glare. Please tilt camera slightly'
          guidanceMessage.value = msg
          if (checks % 3 === 0 && lastSpokenGuidance !== 'glare') {
            lastSpokenGuidance = 'glare'
            speakAccessibility(msg)
          }
        } else {
          guidanceState.value = 'ready'
          guidanceMessage.value = t('cameraReadyCapture')
          if (lastSpokenGuidance !== 'ready') {
            lastSpokenGuidance = 'ready'
            speakAccessibility(t('cameraReadyCapture'))
            triggerHaptic([40, 30])
          }
        }
      }
    } catch (e) {
      if (checks === 2) {
        guidanceState.value = 'ready'
        guidanceMessage.value = t('cameraReadyCapture')
      }
    }
  }, 1400)
}

// Capture Snapshot & Initiate Scan (100% WYSIWYG cropped strictly to the visible HUD border)
const captureAndScan = () => {
  if (!videoRef.value || !canvasRef.value) return
  
  triggerHaptic([60, 40, 80])
  speakAccessibility('បានថតរូបភាពតាមក្របកំណត់។ កំពុងរៀបចំស្កេន...')
  
  const video = videoRef.value
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  
  const vw = video.videoWidth || 1280
  const vh = video.videoHeight || 720
  const vRect = video.getBoundingClientRect()
  const hRect = hudRef.value ? hudRef.value.getBoundingClientRect() : null

  if (hRect && vRect.width > 0 && vRect.height > 0) {
    // Account for CSS `object-fit: cover` scaling and centering offset on the <video>
    const scale = Math.max(vRect.width / vw, vRect.height / vh)
    const renderedW = vw * scale
    const renderedH = vh * scale
    const offsetX = (renderedW - vRect.width) / 2
    const offsetY = (renderedH - vRect.height) / 2

    // Clamp HUD border rectangle inside the video viewport
    const relLeft = Math.max(0, hRect.left - vRect.left)
    const relTop = Math.max(0, hRect.top - vRect.top)
    const relRight = Math.min(vRect.width, hRect.right - vRect.left)
    const relBottom = Math.min(vRect.height, hRect.bottom - vRect.top)
    const relW = Math.max(32, relRight - relLeft)
    const relH = Math.max(32, relBottom - relTop)

    // Map screen coordinates inside the HUD border directly to intrinsic camera sensor pixels
    const sx = Math.max(0, Math.round((relLeft + offsetX) / scale))
    const sy = Math.max(0, Math.round((relTop + offsetY) / scale))
    const sw = Math.max(1, Math.min(vw - sx, Math.round(relW / scale)))
    const sh = Math.max(1, Math.min(vh - sy, Math.round(relH / scale)))

    canvas.width = sw
    canvas.height = sh
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)
  } else {
    canvas.width = vw
    canvas.height = vh
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }
  
  canvas.toBlob((blob) => {
    if (blob) {
      const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' })
      originalFile.value = file
      selectedFile.value = file
      previewCropMode.value = 'full'
      previewUrl.value = URL.createObjectURL(blob)
      emit('file-selected', file)
      triggerHaptic('success')
    }
  }, 'image/jpeg', 0.95)
}

const setCameraFrameMode = (mode) => {
  cameraFrameMode.value = mode
  haptics.pulse('tap')
  if (mode === 'skip-logo') {
    speakAccessibility(currentLang.value === 'km' ? 'បានបើកមុខងាររំលងឡូហ្គោខាងលើ' : 'Skip top logo header enabled')
  } else if (mode === 'receipt') {
    speakAccessibility(currentLang.value === 'km' ? 'ក្របសម្រាប់វិក្កយបត្រ' : 'Receipt narrow frame enabled')
  } else {
    speakAccessibility(currentLang.value === 'km' ? 'ក្របពេញទំព័រ' : 'Full document frame enabled')
  }
}

const CROP_PRESETS = {
  full: { top: 0, bottom: 1, left: 0, right: 1 },
  'skip-logo': { top: 0.22, bottom: 1, left: 0.02, right: 0.98 },
  center: { top: 0.16, bottom: 0.92, left: 0.07, right: 0.93 }
}

const applyPreviewCropMode = async (mode) => {
  previewCropMode.value = mode
  haptics.pulse('tap')
  if (!originalFile.value || previewUrl.value === 'pdf') return

  const preset = CROP_PRESETS[mode] || CROP_PRESETS.full
  const croppedFile = await cropImageToRegion(originalFile.value, preset)
  selectedFile.value = croppedFile
  emit('file-selected', croppedFile)

  if (mode === 'skip-logo') {
    speakAccessibility(currentLang.value === 'km' ? 'បានកាត់រំលងឡូហ្គោផ្នែកខាងលើ ២២ ភាគរយ' : 'Skipped top 22% logo header')
  } else if (mode === 'center') {
    speakAccessibility(currentLang.value === 'km' ? 'ផ្តោតតែលើតួអត្ថបទកណ្តាល' : 'Focused on center body text')
  } else {
    speakAccessibility(currentLang.value === 'km' ? 'ស្កេនពេញរូបភាព' : 'Scanning full image')
  }
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

  originalFile.value = file
  selectedFile.value = file
  previewCropMode.value = 'full'
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
  originalFile.value = null
  selectedFile.value = null
  previewUrl.value = null
  previewCropMode.value = 'full'
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
    <div v-if="activeInputTab === 'camera'" class="camera-assistant-view">
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

          <!-- Shaded Top Logo Exclusion Indicator when 'skip-logo' is active -->
          <div v-if="cameraFrameMode === 'skip-logo'" class="hud-logo-skip-zone khmer-font" aria-hidden="true">
            <span>🚫 {{ currentLang === 'km' ? 'តំបន់រំលងឡូហ្គោ/ត្រាខាងលើ (មិនស្កេន)' : 'Top Logo / Seal Excluded' }}</span>
          </div>

          <!-- High-Contrast Visual Alignment Border (100% WYSIWYG Exact Crop Box) -->
          <div
            ref="hudRef"
            class="viewfinder-hud"
            :class="[
              `hud-mode-${cameraFrameMode}`,
              { 'hud-ready-border': guidanceState === 'ready' }
            ]"
            aria-hidden="true"
          >
            <div class="hud-zone-badge khmer-font">
              {{
                cameraFrameMode === 'skip-logo'
                  ? (currentLang === 'km' ? 'ស្កេនតែតួអត្ថបទ (រំលងឡូហ្គោ)' : 'Body Text Only (Skip Logo)')
                  : cameraFrameMode === 'receipt'
                    ? (currentLang === 'km' ? 'ក្របវិក្កយបត្រ (Receipt Box)' : 'Receipt Scan Box')
                    : (currentLang === 'km' ? 'តំបន់ស្កេនពិតប្រាកដ (Exact Scan Border)' : 'Exact Scan Border')
              }}
            </div>
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

          <!-- Frame Mode Selector + Circular Shutter Button -->
          <div class="camera-actions-deck">
            <div class="camera-frame-presets khmer-font" role="group" :aria-label="currentLang === 'km' ? 'ជ្រើសរើសទំហំក្របស្កេន' : 'Scan border mode'">
              <button
                type="button"
                class="btn-frame-preset"
                :class="{ active: cameraFrameMode === 'full' }"
                @click="setCameraFrameMode('full')"
              >
                {{ currentLang === 'km' ? 'ពេញក្រប' : 'Full Box' }}
              </button>
              <button
                type="button"
                class="btn-frame-preset"
                :class="{ active: cameraFrameMode === 'skip-logo' }"
                @click="setCameraFrameMode('skip-logo')"
              >
                {{ currentLang === 'km' ? 'រំលងឡូហ្គោលើ' : 'Skip Top Logo' }}
              </button>
              <button
                type="button"
                class="btn-frame-preset"
                :class="{ active: cameraFrameMode === 'receipt' }"
                @click="setCameraFrameMode('receipt')"
              >
                {{ currentLang === 'km' ? 'វិក្កយបត្រ' : 'Receipt' }}
              </button>
            </div>

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
    <div 
      v-else-if="activeInputTab === 'upload'" 
      class="upload-assistant-view"
      :class="{ 'is-empty-state': !props.recentDocs || props.recentDocs.length === 0 }"
    >
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
          :aria-label="t('chooseFileBtn')"
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

      <!-- Real Uploaded Documents: Only real user-uploaded documents (No dummy data) -->
      <section v-if="props.recentDocs && props.recentDocs.length > 0" class="sample-documents-section" :aria-label="t('recentReadsTitle')">
        <div class="sample-sec-header">
          <FileText :size="20" class="text-heading" />
          <h2 class="sample-sec-title khmer-font">
            {{ currentLang === 'km' ? 'ឯកសារដែលបានផ្ទុកឡើងថ្មីៗ' : 'Recent Uploads' }}
          </h2>
        </div>
        <div class="sample-unboxed-list" role="list">
          <div 
            v-for="(doc, idx) in props.recentDocs.slice(0, 4)" 
            :key="doc.id"
            class="sample-row-wrapper"
            role="listitem"
          >
            <div v-if="idx > 0" class="sample-hairline-divider" aria-hidden="true"></div>
            <button
              type="button"
              class="sample-list-item khmer-font"
              @click="$emit('open-recent', doc)"
              :aria-label="`${t('openAction')} ${doc.name}`"
            >
              <div class="sample-item-text">
                <span class="sample-item-category">{{ doc.date || doc.timestamp }}</span>
                <span class="sample-item-title">{{ doc.name }}</span>
              </div>
              <ArrowRight :size="24" class="sample-item-chevron" aria-hidden="true" />
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
        <!-- Image Preview with Active Scan Border Overlay -->
        <div v-else class="image-box-preview">
          <img :src="previewUrl" alt="Preview" class="preview-image" />
          <div
            class="preview-crop-overlay"
            :class="`preview-crop-${previewCropMode}`"
            aria-hidden="true"
          >
            <span class="preview-crop-badge khmer-font">
              {{
                previewCropMode === 'skip-logo'
                  ? (currentLang === 'km' ? 'រំលងឡូហ្គោខាងលើ ២២%' : 'Top 22% Logo Excluded')
                  : previewCropMode === 'center'
                    ? (currentLang === 'km' ? 'ផ្តោតតួអត្ថបទកណ្តាល' : 'Center Body Text Only')
                    : (currentLang === 'km' ? 'តំបន់ស្កេនពេញរូបភាព' : 'Full Image Scan Border')
              }}
            </span>
          </div>
        </div>
      </div>

      <!-- Region / Logo-Skip Bar for Images -->
      <div v-if="previewUrl !== 'pdf'" class="preview-crop-toolbar khmer-font" role="group" :aria-label="currentLang === 'km' ? 'កំណត់តំបន់ស្កេនដើម្បីរំលងឡូហ្គោ' : 'Scan region filter'">
        <button
          type="button"
          class="btn-crop-chip"
          :class="{ active: previewCropMode === 'full' }"
          :disabled="props.isProcessing"
          @click="applyPreviewCropMode('full')"
        >
          {{ currentLang === 'km' ? 'ពេញរូបភាព' : 'Full Image' }}
        </button>
        <button
          type="button"
          class="btn-crop-chip"
          :class="{ active: previewCropMode === 'skip-logo' }"
          :disabled="props.isProcessing"
          @click="applyPreviewCropMode('skip-logo')"
        >
          🚫 {{ currentLang === 'km' ? 'រំលងឡូហ្គោលើ (-22%)' : 'Skip Top Logo (-22%)' }}
        </button>
        <button
          type="button"
          class="btn-crop-chip"
          :class="{ active: previewCropMode === 'center' }"
          :disabled="props.isProcessing"
          @click="applyPreviewCropMode('center')"
        >
          🎯 {{ currentLang === 'km' ? 'ផ្តោតតួអត្ថបទ' : 'Focus Body Text' }}
        </button>
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
