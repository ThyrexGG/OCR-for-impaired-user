<script setup>
import { ref, onBeforeUnmount, nextTick } from 'vue'
import { Upload, FileImage, Trash2, FileText, Check, Camera, X } from 'lucide-vue-next'

const props = defineProps({
  isProcessing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['file-selected', 'clear-file', 'trigger-ocr'])

const isDragActive = ref(false)
const selectedFile = ref(null)
const previewUrl = ref(null)

const isCameraMode = ref(false)
const videoRef = ref(null)
const canvasRef = ref(null)
let stream = null

const startCamera = async () => {
  isCameraMode.value = true
  await nextTick()
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
    }
  } catch (error) {
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
  
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  
  canvas.toBlob((blob) => {
    if (blob) {
      const file = new File([blob], `photo_${new Date().getTime()}.jpg`, { type: 'image/jpeg' })
      stopCamera()
      processFile(file)
    }
  }, 'image/jpeg', 0.9)
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
    alert('Invalid format. Please upload an Image or PDF document.')
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
  <div class="uploader-wrapper">
    <!-- State 1: Selection (Upload or Camera) -->
    <div v-if="!selectedFile && !isCameraMode" class="selection-panel">
      <!-- Upload Card -->
      <div class="action-card" @click="$refs.fileInput.click()" @dragenter.prevent="handleDragEnter" @dragleave.prevent="handleDragLeave" @dragover.prevent @drop.prevent="handleDrop" :class="{ 'drag-active': isDragActive }">
        <input 
          type="file" 
          ref="fileInput" 
          class="hidden-input" 
          accept="image/*,application/pdf"
          @change="handleFileSelect"
        />
        <div class="icon-circle">
          <Upload size="48" class="action-icon" />
        </div>
        <h3 class="action-title khmer-font">ផ្ទុកឯកសារ</h3>
        <p class="action-desc">Upload File</p>
      </div>

      <!-- Camera Card -->
      <div class="action-card" @click="startCamera">
        <div class="icon-circle">
          <Camera size="48" class="action-icon" />
        </div>
        <h3 class="action-title khmer-font">ថតឯកសារ</h3>
        <p class="action-desc">Open Camera</p>
      </div>
    </div>

    <!-- State 2: Camera Feed -->
    <div v-else-if="isCameraMode && !selectedFile" class="camera-panel">
      <div class="camera-header">
        <h3 class="preview-title khmer-font">កាមេរ៉ា / Camera</h3>
        <button class="btn-icon" @click="stopCamera" title="Close Camera">
          <X size="24" />
        </button>
      </div>
      
      <div class="video-container">
        <video ref="videoRef" autoplay playsinline class="camera-video"></video>
        <canvas ref="canvasRef" style="display: none;"></canvas>
      </div>
      
      <button class="btn-capture khmer-font" @click="captureImage">
        <Camera size="24" />
        ថតរូបភាព (Capture)
      </button>
    </div>

    <!-- State 3: File selected -> Show preview -->
    <div v-else class="preview-panel">
      <div class="preview-header">
        <h3 class="preview-title">Document Preview</h3>
      </div>
      <div class="preview-container">
        <!-- PDF Preview -->
        <div v-if="previewUrl === 'pdf'" class="pdf-preview-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pdf-icon"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
          <span class="pdf-label">PDF Document</span>
        </div>
        
        <!-- Image Preview -->
        <img v-else-if="previewUrl" :src="previewUrl" alt="Document Preview" class="preview-img" />
      </div>

      <div class="file-details">
        <div class="details-left">
          <div class="file-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-slate"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          </div>
          <div class="file-meta">
            <span class="file-name">{{ selectedFile.name }}</span>
            <span class="file-size">{{ getFileSize(selectedFile.size) }}</span>
          </div>
        </div>
        <button class="btn-delete" @click="clearFile" :disabled="isProcessing" title="Remove file">
          <Trash2 size="18" />
        </button>
      </div>

      <button 
        class="btn-process" 
        @click="triggerOcr" 
        :disabled="isProcessing"
      >
        <template v-if="isProcessing">
          <div class="spinner-sm"></div>
          <span class="khmer-font">កំពុងវិភាគអត្ថបទ...</span>
        </template>
        <template v-else>
          <span class="khmer-font">បម្លែងជាអត្ថបទ (OCR)</span>
        </template>
      </button>
    </div>
  </div>
</template>

<style scoped>
.uploader-wrapper {
  width: 100%;
  height: 100%;
}

/* Selection Panel */
.selection-panel {
  display: flex;
  gap: 24px;
  min-height: 380px;
  height: 100%;
}

.action-card {
  flex: 1;
  background: #000000;
  border: 6px dashed #FFFFFF;
  border-radius: 0;
  padding: 40px 24px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  transition: all 0.2s ease;
}

.action-card:hover, .drag-active {
  background: #FFFF00;
  border-color: #000000;
  color: #000000;
}

.hidden-input { display: none; }

.icon-circle {
  width: 120px;
  height: 120px;
  background: #FFFFFF;
  border: 6px solid #000000;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.action-card:hover .icon-circle, .drag-active .icon-circle {
  background: #000000;
  border-color: #FFFF00;
}

.action-icon { color: #000000; }

.action-card:hover .action-icon, .drag-active .action-icon {
  color: #FFFF00;
}

.action-title {
  font-size: 2rem;
  font-weight: 800;
  color: #FFFFFF;
  margin: 0 0 8px 0;
}

.action-card:hover .action-title, .drag-active .action-title {
  color: #000000;
}

.action-desc {
  font-size: 1.5rem;
  font-weight: 800;
  color: #FFFFFF;
  margin: 0;
}

.action-card:hover .action-desc, .drag-active .action-desc {
  color: #000000;
}

/* Camera Panel */
.camera-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: #000000;
  border: 6px solid #FFFFFF;
  border-radius: 0;
  padding: 24px;
  height: 100%;
}

.camera-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-icon {
  background: #000000;
  border: 4px solid #FFFFFF;
  color: #FFFFFF;
  cursor: pointer;
  padding: 8px;
  display: flex;
}

.btn-icon:hover {
  background: #FFFFFF;
  color: #000000;
}

.video-container {
  flex: 1;
  width: 100%;
  background: #000000;
  border: 4px solid #FFFFFF;
  overflow: hidden;
  position: relative;
  min-height: 280px;
}

.camera-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.btn-capture {
  width: 100%;
  padding: 24px;
  font-size: 2rem;
  font-weight: 800;
  background: #FFFF00;
  color: #000000;
  border: 6px solid #FFFFFF;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.btn-capture:hover {
  background: #000000;
  color: #FFFF00;
  border-color: #FFFF00;
}

/* Preview Panel */
.preview-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: #000000;
  border: 4px solid #FFFFFF;
  border-radius: 0;
  padding: 24px;
  height: 100%;
}

.preview-header {
  display: flex;
  align-items: center;
}

.preview-title {
  font-size: 1.8rem;
  font-weight: 800;
  color: #FFFFFF;
  margin: 0;
}

.preview-container {
  width: 100%;
  height: 280px;
  background: #000000;
  border: 4px solid #FFFFFF;
  border-radius: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border: 2px solid #FFFFFF;
}

.pdf-preview-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.pdf-icon {
  color: #FFFFFF;
  width: 80px;
  height: 80px;
}

.pdf-label {
  font-size: 1.5rem;
  font-weight: 800;
  color: #FFFFFF;
}

.file-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #000000;
  padding: 12px 16px;
  border: 4px solid #FFFFFF;
  border-radius: 0;
}

.details-left {
  display: flex;
  align-items: center;
  gap: 16px;
  overflow: hidden;
}

.file-icon-box {
  background: #FFFFFF;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-slate {
  color: #000000;
}

.file-meta {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-name {
  font-size: 1.2rem;
  font-weight: 800;
  color: #FFFFFF;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 200px;
}

.file-size {
  display: none; /* Hide size to simplify text for low vision */
}

.btn-delete {
  background: #000000;
  border: 4px solid #FFFFFF;
  color: #FFFFFF;
  cursor: pointer;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-delete:hover:not(:disabled) {
  background: #FFFFFF;
  color: #000000;
}

.btn-process {
  margin-top: auto;
  width: 100%;
  padding: 24px;
  font-size: 1.8rem;
  font-weight: 800;
  border-radius: 0;
  background: #FFFF00;
  color: #000000;
  border: 6px solid #FFFFFF;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.btn-process:hover:not(:disabled) {
  background: #000000;
  color: #FFFF00;
  border-color: #FFFF00;
}

.btn-process:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: #666666;
  color: #666666;
  background: #000000;
}

.spinner-sm {
  width: 32px;
  height: 32px;
  border: 6px solid #000000;
  border-top-color: #FFFF00;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.btn-process:hover:not(:disabled) .spinner-sm {
  border-color: #FFFF00;
  border-top-color: #000000;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
  .selection-panel {
    flex-direction: column;
  }
  
  .action-card {
    padding: 24px 16px;
    min-height: 200px;
  }
  
  .icon-circle {
    width: 80px;
    height: 80px;
    margin-bottom: 16px;
  }

  .action-icon {
    width: 32px;
    height: 32px;
  }

  .action-title {
    font-size: 1.5rem;
  }

  .action-desc {
    font-size: 1.2rem;
  }

  .preview-panel {
    padding: 16px;
    border-radius: 16px;
    gap: 16px;
  }

  .preview-title {
    font-size: 1.05rem;
  }

  .preview-container {
    height: 220px;
  }

  .file-details {
    padding: 10px 12px;
    border-radius: 12px;
  }

  .details-left {
    gap: 10px;
  }

  .file-name {
    font-size: 0.85rem;
    max-width: 140px;
  }

  .btn-process {
    padding: 14px;
    font-size: 1.05rem;
    border-radius: 12px;
  }
}
</style>
