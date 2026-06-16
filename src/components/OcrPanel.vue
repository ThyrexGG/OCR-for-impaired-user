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

