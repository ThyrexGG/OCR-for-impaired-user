<script setup>
import { ref } from 'vue'
import { Upload, FileImage, Trash2, FileText, Check } from 'lucide-vue-next'

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
    <!-- State 1: No file selected -> Modern Dropzone -->
    <div v-if="!selectedFile" class="dropzone-card" @click="$refs.fileInput.click()" @dragenter.prevent="handleDragEnter" @dragleave.prevent="handleDragLeave" @dragover.prevent @drop.prevent="handleDrop" :class="{ 'drag-active': isDragActive }">
      <input 
        type="file" 
        ref="fileInput" 
        class="hidden-input" 
        accept="image/*,application/pdf"
        @change="handleFileSelect"
      />
      
      <div class="dropzone-content">
        <div class="icon-circle">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="upload-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
        </div>
        <h3 class="dropzone-title">Upload your document</h3>
        <h4 class="dropzone-subtitle-kh khmer-font">ផ្ទុកឯកសាររបស់អ្នកឡើង</h4>
        <p class="dropzone-desc">Drag and drop or click to browse</p>
        <p class="dropzone-hint">Supports JPG, PNG, and PDF</p>
      </div>
    </div>

    <!-- State 2: File selected -> Show preview -->
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

/* Dropzone Styles */
.dropzone-card {
  background: #f4f7fa;
  border: 2px dashed #2b61a2;
  border-radius: 24px;
  padding: 60px 24px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  transition: all 0.3s ease;
  min-height: 380px;
  height: 100%;
}

.dropzone-card:hover, .drag-active {
  background: #eef2ff;
  border-color: #1e4b85;
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgba(43, 97, 162, 0.2);
}

.hidden-input {
  display: none;
}

.dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.icon-circle {
  width: 80px;
  height: 80px;
  background: rgba(43, 97, 162, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  transition: all 0.3s ease;
}

.dropzone-card:hover .icon-circle, .drag-active .icon-circle {
  background: rgba(43, 97, 162, 0.2);
  transform: scale(1.05);
}

.upload-icon {
  color: #2b61a2;
  transition: color 0.3s ease;
}

.dropzone-title {
  font-size: 1.3rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.dropzone-subtitle-kh {
  font-size: 1.15rem;
  font-weight: 700;
  color: #2b61a2;
  margin: 0;
}

.dropzone-desc {
  font-size: 1rem;
  color: #64748b;
  margin: 8px 0 0 0;
}

.dropzone-hint {
  font-size: 0.85rem;
  color: #94a3b8;
  margin: 0;
}

/* Preview Panel */
.preview-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: linear-gradient(145deg, #2b61a2, #1e4b85);
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(43, 97, 162, 0.4);
  height: 100%;
}

.preview-header {
  display: flex;
  align-items: center;
}

.preview-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: #ffffff;
  margin: 0;
}

.preview-container {
  width: 100%;
  height: 280px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
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
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.pdf-preview-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.pdf-icon {
  color: #fca5a5;
  width: 64px;
  height: 64px;
}

.pdf-label {
  font-size: 1.1rem;
  font-weight: 700;
  color: #ffffff;
}

.file-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  padding: 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}

.details-left {
  display: flex;
  align-items: center;
  gap: 16px;
  overflow: hidden;
}

.file-icon-box {
  background: rgba(255, 255, 255, 0.2);
  padding: 10px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-slate {
  color: #ffffff;
}

.file-meta {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 200px;
}

.file-size {
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.btn-delete {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  cursor: pointer;
  padding: 10px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-delete:hover:not(:disabled) {
  background: #ef4444;
  color: white;
  transform: scale(1.05);
}

.btn-process {
  margin-top: auto;
  width: 100%;
  padding: 18px;
  font-size: 1.2rem;
  font-weight: 700;
  border-radius: 16px;
  background: linear-gradient(145deg, #f97316, #ea580c);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  transition: all 0.3s ease;
  box-shadow: 0 8px 20px rgba(249, 115, 22, 0.4);
}

.btn-process:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 25px rgba(249, 115, 22, 0.5);
}

.btn-process:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.spinner-sm {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
  .dropzone-card {
    padding: 40px 16px;
    min-height: 280px;
    border-radius: 16px;
  }
  
  .icon-circle {
    width: 60px;
    height: 60px;
  }

  .upload-icon {
    width: 28px;
    height: 28px;
  }

  .dropzone-title {
    font-size: 1.15rem;
  }

  .dropzone-subtitle-kh {
    font-size: 1.05rem;
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
