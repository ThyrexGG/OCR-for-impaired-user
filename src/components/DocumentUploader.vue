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

<style scoped src="./DocumentUploader.css"></style>
