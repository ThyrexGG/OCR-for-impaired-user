<script setup>
import { ref, watch, computed, inject, nextTick } from 'vue'
import { 
  BookOpen, Edit3, Check, Copy, Download, ZoomIn, ZoomOut, 
  Trash2, Eye, Sparkles, Zap, Layers, Type, AlignLeft, Play, Camera, RefreshCw,
  ArrowLeft, SlidersHorizontal
} from 'lucide-vue-next'

const isOptionsOpen = ref(false)

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
  },
  activeWordIndex: {
    type: Number,
    default: -1
  },
  highlightMode: {
    type: String,
    default: 'word' // 'word' | 'sentence' | 'paragraph'
  },
  isSpeaking: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'update:text', 
  'update:highlightMode', 
  'seek-word', 
  'toast', 
  're-scan', 
  'read-aloud',
  'scan-again'
])

const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})

// Canvas Reading State
const isEditing = ref(false)
const localText = ref(props.text)
const isCopied = ref(false)
const readingFontSize = ref(1.25) // rem
const readingContainerRef = ref(null)

watch(() => props.text, (newVal) => {
  localText.value = newVal
})

// Highlight modes: 'word' | 'sentence' | 'paragraph'
const setHighlightMode = (mode) => {
  emit('update:highlightMode', mode)
  triggerHaptic(30)
  const names = {
    word: 'រំលេចពាក្យម្តងមួយៗ (Word Mode)',
    sentence: 'រំលេចម្តងមួយប្រយោគ (Sentence Mode)',
    paragraph: 'រំលេចម្តងមួយកថាខណ្ឌ (Paragraph Mode)'
  }
  speakAccessibility(`ប្តូររបៀបរំលេចអត្ថបទជា ${names[mode] || mode}`)
}

// Tokenize text into words, sentences, and paragraphs
const parsedParagraphs = computed(() => {
  if (!localText.value) return []
  
  const rawParas = localText.value.split(/\n\s*\n|\n/)
  let globalWordCounter = 0
  let globalSentenceCounter = 0

  return rawParas.map((paraText, pIdx) => {
    if (!paraText.trim()) return null

    // Split sentences by Khmer punctuation (។, ៕, ?) or standard periods
    const rawSentences = paraText.split(/([។៕\.\?!]+)/).filter(Boolean)
    const sentences = []

    for (let i = 0; i < rawSentences.length; i += 2) {
      const sText = (rawSentences[i] + (rawSentences[i + 1] || '')).trim()
      if (!sText) continue

      const sIndex = globalSentenceCounter++
      const words = sText.split(/\s+/).filter(w => w.length > 0).map(w => {
        const wIdx = globalWordCounter++
        return {
          text: w,
          globalIndex: wIdx,
          sentenceIndex: sIndex,
          paragraphIndex: pIdx
        }
      })

      sentences.push({
        text: sText,
        index: sIndex,
        words
      })
    }

    return {
      index: pIdx,
      sentences
    }
  }).filter(Boolean)
})

// Auto-scroll active word/sentence into view smoothly
watch(() => props.activeWordIndex, async (newIdx) => {
  if (newIdx === -1 || !readingContainerRef.value || isEditing.value) return
  await nextTick()
  const activeEl = readingContainerRef.value.querySelector('.token-active')
  if (activeEl) {
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }
})

// Text Editing toggle
const toggleEditing = () => {
  isEditing.value = !isEditing.value
  triggerHaptic(40)
  if (isEditing.value) {
    speakAccessibility('បានបើកផ្ទាំងកែសម្រួលអត្ថបទ')
  } else {
    emit('update:text', localText.value)
    speakAccessibility('បានរក្សាទុកការកែសម្រួល និងត្រឡប់មកផ្ទាំងអាន')
  }
}

// Zoom controls
const adjustZoom = (delta) => {
  let next = Math.round((readingFontSize.value + delta) * 10) / 10
  if (next >= 1.0 && next <= 2.4) {
    readingFontSize.value = next
    triggerHaptic(30)
    speakAccessibility(`ទំហំអក្សរក្នុងផ្ទាំងអាន ${Math.round(next * 100 / 1.25)} ភាគរយ`)
  }
}

// Copy Text
const copyToClipboard = async () => {
  if (!localText.value) return
  try {
    await navigator.clipboard.writeText(localText.value)
    isCopied.value = true
    triggerHaptic([60, 40, 60])
    speakAccessibility('បានចម្លងអត្ថបទទាំងអស់ទៅកាន់ Clipboard ជោគជ័យ')
    emit('toast', { message: 'បានចម្លងអត្ថបទទៅកាន់ Clipboard', type: 'success' })
    setTimeout(() => { isCopied.value = false }, 2000)
  } catch (e) {
    console.error(e)
  }
}

// Download TXT
const downloadTxt = () => {
  if (!localText.value) return
  const element = document.createElement('a')
  const file = new Blob([localText.value], { type: 'text/plain;charset=utf-8' })
  element.href = URL.createObjectURL(file)
  const baseName = props.fileName ? props.fileName.replace(/\.[^/.]+$/, '') : 'document'
  element.download = `${baseName}_songkhem.txt`
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
  triggerHaptic(40)
  speakAccessibility(`បានទាញយកឯកសារ ${baseName}_songkhem.txt រួចរាល់`)
  emit('toast', { message: `បានទាញយក ${baseName}_songkhem.txt`, type: 'info' })
}

// Text Stats
const charCount = computed(() => localText.value ? localText.value.length : 0)
const wordCount = computed(() => {
  if (!localText.value) return 0
  return localText.value.trim().split(/\s+/).filter(w => w.length > 0).length
})

// Trigger Read Aloud
const triggerReadAloud = () => {
  triggerHaptic([60, 40])
  emit('read-aloud')
}

// Trigger Scan Again
const triggerScanAgain = () => {
  triggerHaptic([40, 40])
  emit('scan-again')
}

// Click word to jump audio
const onWordClick = (token) => {
  triggerHaptic(30)
  emit('seek-word', token.globalIndex)
}
</script>

<template>
  <div class="reading-canvas glass-card" role="region" aria-label="ផ្ទាំងអានឯកសារខ្មែរ">
    <!-- Reading Header Bar: Clean Back Button, Title, and Options Toggle -->
    <header class="canvas-header">
      <div class="header-left">
        <button 
          type="button" 
          class="btn-back-to-scan khmer-font" 
          @click="triggerScanAgain"
          aria-label="ត្រឡប់ទៅការស្កេនឯកសារថ្មី"
          title="ត្រឡប់ទៅស្កេន"
        >
          <ArrowLeft :size="18" />
          <span>ស្កេនឯកសារថ្មី</span>
        </button>

        <div class="doc-titles">
          <h2 class="doc-name khmer-font" :title="fileName || 'ឯកសារស្កេន'">
            {{ fileName || 'ឯកសារស្កេន (Scanned Document)' }}
          </h2>
          <span v-if="localText" class="doc-metric-badge khmer-font">
            {{ wordCount }} ពាក្យ • {{ charCount }} តួអក្សរ
          </span>
        </div>
      </div>

      <div class="header-right">
        <!-- Collapsible Reading Options Button -->
        <button 
          type="button" 
          class="btn-toggle-options khmer-font"
          :class="{ 'options-active': isOptionsOpen }"
          @click="isOptionsOpen = !isOptionsOpen"
          :aria-expanded="isOptionsOpen"
          aria-label="ជម្រើសអាន និងទំហំអក្សរ"
          title="ជម្រើសអាន"
        >
          <SlidersHorizontal :size="18" />
          <span>ជម្រើស</span>
        </button>
      </div>
    </header>

    <!-- Collapsible Secondary Reading Options Drawer -->
    <div v-if="isOptionsOpen && localText" class="reading-options-drawer" role="region" aria-label="ជម្រើសអានបន្ថែម">
      <!-- In-Panel Zoom Controls for Low-Vision Readers -->
      <div class="drawer-tool-group" role="group" aria-label="ទំហំអក្សរ">
        <span class="drawer-group-label khmer-font">ទំហំអក្សរ៖</span>
        <button 
          type="button" 
          class="btn-drawer-tool khmer-font" 
          @click="adjustZoom(-0.15)" 
          :disabled="readingFontSize <= 1.0"
          aria-label="បន្ថយទំហំអក្សរ A-"
        >
          <ZoomOut :size="16" />
          <span>A-</span>
        </button>
        <button 
          type="button" 
          class="btn-drawer-tool khmer-font" 
          @click="adjustZoom(0.15)" 
          :disabled="readingFontSize >= 2.4"
          aria-label="បង្កើនទំហំអក្សរ A+"
        >
          <ZoomIn :size="16" />
          <span>A+</span>
        </button>
      </div>

      <!-- Utilities: Copy, TXT, Edit -->
      <div class="drawer-tool-group" role="group" aria-label="ឧបករណ៍ឯកសារ">
        <button 
          type="button" 
          class="btn-drawer-tool khmer-font" 
          @click="copyToClipboard" 
          :disabled="!localText"
          aria-label="ចម្លងអត្ថបទ"
        >
          <Check v-if="isCopied" :size="16" class="text-success" />
          <Copy v-else :size="16" />
          <span>{{ isCopied ? 'បានចម្លង' : 'ចម្លង' }}</span>
        </button>

        <button 
          type="button" 
          class="btn-drawer-tool khmer-font" 
          @click="downloadTxt" 
          :disabled="!localText"
          aria-label="ទាញយកជា TXT"
        >
          <Download :size="16" />
          <span>ទាញយក</span>
        </button>

        <button 
          type="button" 
          class="btn-drawer-tool khmer-font" 
          :class="{ 'btn-editing-active': isEditing }"
          @click="toggleEditing"
          :aria-label="isEditing ? 'ត្រឡប់ទៅផ្ទាំងអាន' : 'កែសម្រួលអត្ថបទ'"
        >
          <Check v-if="isEditing" :size="16" />
          <Edit3 v-else :size="16" />
          <span>{{ isEditing ? 'រួចរាល់' : 'កែសម្រួល' }}</span>
        </button>
      </div>

      <!-- Highlight Mode Selector Pills -->
      <div v-if="!isEditing" class="drawer-tool-group" role="group" aria-label="របៀបរំលេចពាក្យពេលអាន">
        <span class="drawer-group-label khmer-font">រំលេច៖</span>
        <button 
          type="button" 
          class="btn-drawer-pill khmer-font" 
          :class="{ 'pill-active': highlightMode === 'word' }"
          @click="setHighlightMode('word')"
          aria-label="រំលេចម្តងមួយពាក្យ"
        >
          ពាក្យ
        </button>
        <button 
          type="button" 
          class="btn-drawer-pill khmer-font" 
          :class="{ 'pill-active': highlightMode === 'sentence' }"
          @click="setHighlightMode('sentence')"
          aria-label="រំលេចម្តងមួយប្រយោគ"
        >
          ប្រយោគ
        </button>
        <button 
          type="button" 
          class="btn-drawer-pill khmer-font" 
          :class="{ 'pill-active': highlightMode === 'paragraph' }"
          @click="setHighlightMode('paragraph')"
          aria-label="រំលេចម្តងមួយកថាខណ្ឌ"
        >
          កថាខណ្ឌ
        </button>
      </div>
    </div>

    <!-- Reading Canvas Content Body -->
    <div class="canvas-body">
      <!-- Loading Shimmer State during scanning -->
      <div v-if="isProcessing" class="reading-skeleton-shimmer" aria-label="កំពុងស្រង់អត្ថបទ...">
        <div class="skeleton-glow-header">
          <span class="skeleton-pulse-pill"></span>
          <span class="khmer-font skeleton-text-status">កំពុងស្កេន និងស្រង់អត្ថបទខ្មែរ...</span>
        </div>
        <div class="shimmer-lines-box">
          <div class="shimmer-bar bar-title"></div>
          <div class="shimmer-bar bar-long"></div>
          <div class="shimmer-bar bar-medium"></div>
          <div class="shimmer-bar bar-long"></div>
          <div class="shimmer-bar bar-short"></div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!localText" class="canvas-empty-state">
        <div class="empty-icon-circle bg-brand">
          <BookOpen :size="40" />
        </div>
        <h3 class="empty-heading khmer-font">មិនទាន់មានអត្ថបទសម្រាប់អាននៅឡើយទេ</h3>
        <p class="empty-subtext khmer-font">
          សូមប្រើប្រាស់កាមេរ៉ាស្កេន ឬជ្រើសរើសឯកសាររូបភាព/PDF ដើម្បីចាប់ផ្តើមអានជាសំឡេង។
        </p>
        <button 
          type="button" 
          class="btn btn-primary khmer-font" 
          @click="triggerScanAgain"
          style="min-height: 52px; padding: 0 24px; margin-top: 8px;"
        >
          <Camera :size="20" />
          <span>ទៅកាន់កាមេរ៉ាស្កេន (Scan Document)</span>
        </button>
      </div>

      <!-- Mode 1: Edit Raw Textarea -->
      <div v-else-if="isEditing" class="editing-view-container">
        <textarea 
          v-model="localText" 
          class="khmer-font editing-textarea"
          :style="{ fontSize: `${readingFontSize}rem` }"
          placeholder="កែសម្រួលអត្ថបទខ្មែរនៅទីនេះ..."
          aria-label="ផ្ទាំងកែសម្រួលអត្ថបទ"
        ></textarea>
      </div>

      <!-- Mode 2: Beautiful High-Contrast Reading & Karaoke Flow -->
      <div 
        v-else 
        class="reading-flow-container" 
        ref="readingContainerRef"
        :style="{ fontSize: `${readingFontSize}rem` }"
        tabindex="0"
        aria-label="ផ្ទាំងអត្ថបទជាមួយការរំលេចពាក្យអាន"
      >
        <div 
          v-for="para in parsedParagraphs" 
          :key="para.index" 
          class="reading-paragraph khmer-font"
          :class="{ 
            'paragraph-active': highlightMode === 'paragraph' && 
              para.sentences.some(s => s.words.some(w => w.globalIndex === activeWordIndex))
          }"
        >
          <span 
            v-for="sentence in para.sentences" 
            :key="sentence.index"
            class="reading-sentence"
            :class="{ 
              'sentence-active': highlightMode === 'sentence' && 
                sentence.words.some(w => w.globalIndex === activeWordIndex)
            }"
          >
            <span 
              v-for="word in sentence.words" 
              :key="word.globalIndex"
              class="token-span"
              :class="{ 
                'token-active': word.globalIndex === activeWordIndex,
                'token-word-mode': highlightMode === 'word' && word.globalIndex === activeWordIndex
              }"
              @click="onWordClick(word)"
              :title="`ចុចដើម្បីស្តាប់ពាក្យ '${word.text}'`"
              tabindex="0"
              role="button"
            >{{ word.text }} </span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./OcrPanel.css"></style>
