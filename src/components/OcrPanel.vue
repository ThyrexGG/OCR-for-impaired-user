<script setup>
import { ref, watch, computed, inject } from 'vue'
import { FileText, Copy, Download, Check, Trash2, ZoomIn, ZoomOut, Sparkles, Zap } from 'lucide-vue-next'

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
  },
  isCached: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:text', 're-scan', 'toast'])
const speakAccessibility = inject('speakAccessibility', () => {})

const localText = ref(props.text)
const isCopied = ref(false)
const localFontSize = ref(1.0) // rem

watch(() => props.text, (newVal) => {
  localText.value = newVal
})

const handleTextChange = () => {
  emit('update:text', localText.value)
}

const copyToClipboard = async () => {
  if (!localText.value) return
  try {
    await navigator.clipboard.writeText(localText.value)
    isCopied.value = true
    speakAccessibility('បានចម្លងអត្ថបទទៅកាន់ Clipboard ជោគជ័យ។')
    emit('toast', { message: 'បានចម្លងអត្ថបទទៅកាន់ Clipboard', type: 'success' })
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch (err) {
    console.error(err)
  }
}

const downloadTxt = () => {
  if (!localText.value) return
  const element = document.createElement('a')
  const file = new Blob([localText.value], { type: 'text/plain;charset=utf-8' })
  element.href = URL.createObjectURL(file)
  
  const baseName = props.fileName ? props.fileName.substring(0, props.fileName.lastIndexOf('.')) || props.fileName : 'khmer_ocr_document'
  element.download = `${baseName}_songkhem.txt`
  
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
  speakAccessibility(`បានទាញយកឯកសារ ${baseName}_songkhem.txt រួចរាល់។`)
  emit('toast', { message: `បានទាញយក ${baseName}_songkhem.txt`, type: 'info' })
}

const clearText = () => {
  if (!localText.value) return
  localText.value = ''
  emit('update:text', '')
  speakAccessibility('បានសម្អាតអត្ថបទចេញពីផ្ទាំង OCR។')
}

const adjustZoom = (delta) => {
  const next = Math.round((localFontSize.value + delta) * 10) / 10
  if (next >= 1.0 && next <= 2.2) {
    localFontSize.value = next
    speakAccessibility(`ទំហំអក្សរក្នុងផ្ទាំង ${Math.round(next * 100 / 1.2)} ភាគរយ`)
  }
}

// Text stats
const charCount = computed(() => localText.value ? localText.value.length : 0)
const wordCount = computed(() => {
  if (!localText.value) return 0
  return localText.value.trim().split(/\s+/).filter(w => w.length > 0).length
})
</script>

<template>
  <div class="ocr-card glass-card">
    <!-- Header Bar -->
    <div class="ocr-header-bar">
      <div class="header-left">
        <div class="header-icon-box bg-brand">
          <FileText :size="20" />
        </div>
        <div class="title-meta">
          <h2 class="card-title khmer-font">លទ្ធផលអត្ថបទ (OCR)</h2>
          <div class="meta-badges-row">
            <span v-if="localText" class="stats-badge khmer-font">
              {{ charCount }} តួអក្សរ • {{ wordCount }} ពាក្យ
            </span>
            <span v-if="isCached && localText" class="badge-cache-hit khmer-font" title="ទិន្នន័យផ្ទុកពី Cache ល្បឿនលឿន">
              <Zap :size="12" />
              <span>ពី Cache</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Action Tools -->
      <div class="header-right">
        <!-- Local Zoom Controls for low-vision readers -->
        <div class="zoom-controls" role="group" aria-label="ពង្រីកបង្រួមអក្សរក្នុងផ្ទាំង">
          <button 
            type="button"
            class="btn-tool" 
            @click="adjustZoom(-0.1)" 
            :disabled="localFontSize <= 1.0"
            aria-label="បង្រួមអក្សរក្នុងផ្ទាំង" 
            title="បង្រួមអក្សរ"
          >
            <ZoomOut :size="16" />
          </button>
          <button 
            type="button"
            class="btn-tool" 
            @click="adjustZoom(0.1)" 
            :disabled="localFontSize >= 2.2"
            aria-label="ពង្រីកអក្សរក្នុងផ្ទាំង" 
            title="ពង្រីកអក្សរ"
          >
            <ZoomIn :size="16" />
          </button>
        </div>

        <!-- Copy Action -->
        <button 
          type="button"
          class="btn-action-pill khmer-font" 
          @click="copyToClipboard" 
          :disabled="!localText || isProcessing"
          aria-label="ចម្លងអត្ថបទទាំងអស់"
          title="ចម្លងអត្ថបទ"
        >
          <template v-if="isCopied">
            <Check :size="16" class="text-success" />
            <span class="text-success">បានចម្លង</span>
          </template>
          <template v-else>
            <Copy :size="16" />
            <span>ចម្លង</span>
          </template>
        </button>

        <!-- Download Action -->
        <button 
          type="button"
          class="btn-action-pill khmer-font" 
          @click="downloadTxt" 
          :disabled="!localText || isProcessing"
          aria-label="ទាញយកជាឯកសារ TXT"
          title="ទាញយកជាឯកសារ TXT"
        >
          <Download :size="16" />
          <span>ទាញយក TXT</span>
        </button>

        <!-- Clear Action -->
        <button 
          type="button"
          class="btn-tool btn-danger-tool" 
          @click="clearText" 
          :disabled="!localText || isProcessing"
          aria-label="លុបអត្ថបទទាំងអស់"
          title="លុបអត្ថបទ"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>

    <!-- Textarea Panel -->
    <div class="textarea-workspace">
      <!-- Loading Shimmer Skeleton during OCR analysis -->
      <div v-if="isProcessing" class="skeleton-container" aria-label="កំពុងវិភាគអត្ថបទ...">
        <div class="skeleton-scanner-beam"></div>
        <div class="skeleton-header">
          <div class="skeleton-pill"></div>
          <span class="khmer-font skeleton-status">កំពុងដំណើរការវិភាគអក្សរខ្មែរ (OCR Processing)...</span>
        </div>
        <div class="skeleton-block">
          <div class="pulse-line line-title"></div>
          <div class="pulse-line line-1"></div>
          <div class="pulse-line line-2"></div>
          <div class="pulse-line line-3"></div>
        </div>
        <div class="skeleton-block">
          <div class="pulse-line line-1"></div>
          <div class="pulse-line line-2"></div>
          <div class="pulse-line line-4"></div>
        </div>
      </div>

      <!-- Editable Khmer Textarea -->
      <textarea 
        v-else
        v-model="localText" 
        @input="handleTextChange" 
        class="khmer-font results-textarea"
        :style="{ fontSize: `${localFontSize}rem` }"
        placeholder="លទ្ធផលអត្ថបទខ្មែរដែលបានស្កេន នឹងបង្ហាញនៅទីនេះ... អ្នកអាចកែសម្រួល ឬចម្លងបានដោយសេរី។"
        aria-label="ផ្ទាំងបង្ហាញអត្ថបទខ្មែរដែលបានស្កេន"
      ></textarea>
    </div>
  </div>
</template>

<style scoped src="./OcrPanel.css"></style>
