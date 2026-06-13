<script setup>
import { ref, watch } from 'vue'
import { FileText, Copy, Download, Check, RefreshCw } from 'lucide-vue-next'

const props = defineProps({
  text: {
    type: String,
    default: ''
  },
  isProcessing: {
    type: Boolean,
    default: false
  },
  fileName: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:text', 're-scan'])

const localText = ref(props.text)
const isCopied = ref(false)

watch(() => props.text, (newVal) => {
  localText.value = newVal
})

const handleTextChange = () => {
  emit('update:text', localText.value)
}

const copyToClipboard = () => {
  if (!localText.value) return
  navigator.clipboard.writeText(localText.value)
  isCopied.value = true
  setTimeout(() => {
    isCopied.value = false
  }, 1500)
}

const downloadTxt = () => {
  if (!localText.value) return
  const element = document.createElement('a')
  const file = new Blob([localText.value], { type: 'text/plain;charset=utf-8' })
  element.href = URL.createObjectURL(file)
  
  const baseName = props.fileName ? props.fileName.substring(0, props.fileName.lastIndexOf('.')) : 'extracted_khmer'
  element.download = `${baseName}_ocr.txt`
  
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}
</script>

<template>
  <div class="results-card">
    <div class="results-header-row">
      <!-- Left: Title with green document icon -->
      <div class="header-left">
        <div class="icon-box-teal">
          <FileText :size="20" />
        </div>
        <h2 class="results-title khmer-font">លទ្ធផល OCR</h2>
      </div>
      
      <!-- Right: Action buttons -->
      <div class="header-right">
        <button class="btn-action-outline khmer-font" @click="copyToClipboard" :disabled="!localText">
          <template v-if="isCopied">
            <Check class="icon-success" :size="16" />
            <span class="text-success">ចម្លងជោគជ័យ</span>
          </template>
          <template v-else>
            <Copy :size="16" />
            <span>ចម្លង</span>
          </template>
        </button>
        
        <button class="btn-action-outline khmer-font" @click="downloadTxt" :disabled="!localText">
          <Download :size="16" />
          <span>ទាញយក TXT</span>
        </button>
      </div>
    </div>

    <!-- Textarea panel -->
    <div class="textarea-container">
      <!-- Loading skeleton during analysis -->
      <div v-if="isProcessing" class="skeleton-textarea">
        <div class="pulse-line line-1"></div>
        <div class="pulse-line line-2"></div>
        <div class="pulse-line line-3"></div>
      </div>
      
      <!-- Editable Khmer textarea -->
      <textarea 
        v-else
        v-model="localText" 
        @input="handleTextChange" 
        class="khmer-font results-textarea"
        placeholder="លទ្ធផលអត្ថបទនឹងបង្ហាញនៅទីនេះ..."
      ></textarea>
    </div>
  </div>
</template>

<style scoped>
.results-card {
  background: #000000;
  border: 4px solid #FFFFFF;
  border-radius: 0;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  height: 100%;
}

.results-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-box-teal {
  background: #000000;
  border: 4px solid #FFFFFF;
  color: #FFFFFF;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.results-title {
  font-size: 2rem;
  color: #FFFFFF;
  font-weight: 800;
  margin: 0;
}

.header-right {
  display: flex;
  gap: 12px;
}

.btn-action-outline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #FFFFFF;
  font-size: 1.2rem;
  font-weight: 800;
  background: #000000;
  border: 4px solid #FFFFFF;
  cursor: pointer;
  padding: 12px 16px;
  border-radius: 0;
}

.btn-action-outline:hover:not(:disabled) {
  color: #000000;
  background: #FFFF00;
  border-color: #FFFF00;
}

.btn-action-outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: #666666;
  color: #666666;
}

.icon-success {
  color: #000000;
}
.text-success {
  color: #000000;
}

/* Textarea styling */
.textarea-container {
  width: 100%;
  flex: 1;
  display: flex;
}

.results-textarea {
  width: 100%;
  min-height: 300px;
  background: #000000;
  border: 4px solid #FFFFFF;
  border-radius: 0;
  padding: 20px;
  color: #FFFFFF;
  font-size: 1.5rem;
  line-height: 2;
  resize: vertical;
  outline: none;
}

.results-textarea::placeholder {
  color: #FFFFFF;
}

.results-textarea:focus {
  border-color: #FFFF00;
}

/* Skeleton loader */
.skeleton-textarea {
  width: 100%;
  min-height: 300px;
  background: #000000;
  border: 4px solid #FFFFFF;
  border-radius: 0;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.pulse-line {
  height: 24px;
  background: #333333;
  border-radius: 0;
  position: relative;
  overflow: hidden;
}

.pulse-line::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
  animation: loading-shimmer 1.5s infinite;
}

.line-1 { width: 85%; }
.line-2 { width: 95%; }
.line-3 { width: 60%; }

@keyframes loading-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@media (max-width: 480px) {
  .results-card {
    padding: 16px;
    border-radius: 16px;
    gap: 16px;
  }

  .results-title {
    font-size: 1.05rem;
  }

  .icon-box-teal {
    padding: 8px;
    border-radius: 10px;
  }
  .icon-box-teal svg {
    width: 20px;
    height: 20px;
  }

  .btn-action-outline {
    padding: 6px 10px;
    font-size: 0.8rem;
    border-radius: 8px;
  }

  .results-textarea, .skeleton-textarea {
    padding: 16px;
    min-height: 180px;
    font-size: 0.95rem;
  }
}
</style>
