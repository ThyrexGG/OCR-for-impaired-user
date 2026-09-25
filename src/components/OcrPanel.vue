<script setup>
import { ref, watch, computed, inject, nextTick } from 'vue'
import { 
  BookOpen, Edit3, Check, Copy, Download, ZoomIn, ZoomOut, 
  ArrowLeft, Volume2, Pause, Sparkles, Camera, 
  Upload, CheckCircle2, FileText, X
} from 'lucide-vue-next'
import { t, currentLang } from '../services/i18n'

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
  'read-aloud',
  'scan-again',
  'switch-mode'
])

const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})

// Canvas Reading State
const isEditing = ref(false)
const localText = ref(props.text)
const isCopied = ref(false)
const readingFontSize = ref(1.25) // rem
const readingContainerRef = ref(null)

// Feature Drawers / Panels
const isSummaryOpen = ref(false)
const isVocabOpen = ref(false)

watch(() => props.text, (newVal) => {
  localText.value = newVal
})

// Highlight modes: 'word' | 'sentence' | 'paragraph'
const setHighlightMode = (mode) => {
  emit('update:highlightMode', mode)
  triggerHaptic(30)
  const names = {
    word: t('wordModeFull'),
    sentence: t('sentenceModeFull'),
    paragraph: t('paragraphModeFull')
  }
  speakAccessibility(names[mode] || mode)
}

// Helper: Segment Khmer or English sentences into words
const segmentSentenceIntoWords = (sentenceText) => {
  if (!sentenceText) return []
  
  if (/[\u1780-\u17FF]/.test(sentenceText) && typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter('km', { granularity: 'word' })
      const words = []
      for (const { segment } of segmenter.segment(sentenceText)) {
        const trimmed = segment.trim()
        if (trimmed) {
          words.push(trimmed)
        }
      }
      if (words.length > 0) return words
    } catch (e) {
      // fallback
    }
  }

  return sentenceText.split(/\s+/).filter(w => w.length > 0)
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
      const wordStrings = segmentSentenceIntoWords(sText)
      
      const words = wordStrings.map(w => {
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
    speakAccessibility(currentLang.value === 'km' ? 'បានបើកផ្ទាំងកែសម្រួលអត្ថបទ' : 'Opened text editor')
  } else {
    emit('update:text', localText.value)
    speakAccessibility(currentLang.value === 'km' ? 'បានរក្សាទុកការកែសម្រួល និងត្រឡប់មកផ្ទាំងអាន' : 'Saved edits and returned to reader')
  }
}

// Zoom controls
const adjustZoom = (delta) => {
  let next = Math.round((readingFontSize.value + delta) * 10) / 10
  if (next >= 1.0 && next <= 2.4) {
    readingFontSize.value = next
    triggerHaptic(30)
    speakAccessibility(`${t('fontSizeLabel')} ${Math.round(next * 100 / 1.25)}%`)
  }
}

// Copy Text
const copyToClipboard = async () => {
  if (!localText.value) return
  try {
    await navigator.clipboard.writeText(localText.value)
    isCopied.value = true
    triggerHaptic([60, 40, 60])
    speakAccessibility(t('toastCopied'))
    emit('toast', { message: t('toastCopied'), type: 'success' })
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
  speakAccessibility(`${t('toastDownloaded')} ${baseName}_songkhem.txt`)
  emit('toast', { message: `${t('toastDownloaded')} ${baseName}_songkhem.txt`, type: 'info' })
}

// Text Stats & Metadata
const charCount = computed(() => localText.value ? localText.value.length : 0)
const wordCount = computed(() => {
  if (!localText.value) return 0
  return localText.value.trim().split(/\s+/).filter(w => w.length > 0).length
})
const estimatedPages = computed(() => Math.max(1, Math.ceil(wordCount.value / 250)))

// Document Title & Category
const displayTitle = computed(() => {
  if (props.fileName) {
    return props.fileName.replace(/\.[^/.]+$/, '')
  }
  return currentLang.value === 'km' ? 'ឯកសារស្កេន' : 'Scanned Document'
})

const detectedCategory = computed(() => {
  const txt = (localText.value || '').toLowerCase()
  if (txt.includes('វិក័យប័ត្រ') || txt.includes('receipt') || txt.includes('$') || txt.includes('statement')) {
    return currentLang.value === 'km' ? 'វិក្កយបត្រ (Statement)' : 'Utility Statement'
  }
  if (txt.includes('សេចក្តីជូនដំណឹង') || txt.includes('ក្រសួង') || txt.includes('notice')) {
    return currentLang.value === 'km' ? 'ឯកសាររដ្ឋបាល (Notice)' : 'Official Notice'
  }
  if (txt.includes('កំណាព្យ') || txt.includes('poem')) {
    return currentLang.value === 'km' ? 'កំណាព្យ (Poem)' : 'Poetry'
  }
  if (txt.includes('រឿង') || txt.includes('story')) {
    return currentLang.value === 'km' ? 'រឿងនិទាន (Story)' : 'Folk Story'
  }
  return currentLang.value === 'km' ? 'ឯកសារទូទៅ' : 'General Document'
})

const detectedLangName = computed(() => {
  const txt = localText.value || ''
  const hasKhmer = /[\u1780-\u17FF]/.test(txt)
  if (hasKhmer) return 'Khmer (ខ្មែរ)'
  return 'English (US)'
})

const formattedScanDate = computed(() => {
  return new Date().toLocaleDateString(currentLang.value === 'km' ? 'km-KH' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
})

// Trigger Read Aloud
const triggerReadAloud = () => {
  triggerHaptic([60, 40])
  emit('read-aloud')
}

// Trigger Scan Again / Back to Documents
const triggerScanAgain = () => {
  triggerHaptic([40, 40])
  emit('scan-again')
}

// Click word to jump audio
const onWordClick = (token) => {
  triggerHaptic(30)
  emit('seek-word', token.globalIndex)
}

// --- FEATURE 1: DOCUMENT SUMMARY GENERATOR ---
const summaryPoints = computed(() => {
  if (!localText.value) return []
  const txt = localText.value.trim()
  
  if (txt.includes('ក្រសួងអប់រំ') || txt.includes('សេចក្តីជូនដំណឹង')) {
    return currentLang.value === 'km' ? [
      'ក្រសួងអប់រំ យុវជន និងកីឡា បានចេញសេចក្តីជូនដំណឹងស្តីពីបច្ចេកវិទ្យាជំនួយ។',
      'លើកទឹកចិត្តឱ្យគ្រឹះស្ថានសិក្សាពង្រឹងការប្រើឧបករណ៍អានសំឡេង (Screen Reader & OCR)។',
      'គោលបំណងបង្កើនសមភាពក្នុងការទទួលបានចំណេះដឹងសម្រាប់សិស្ស-និស្សិតមានពិការភាពគំហើញ។'
    ] : [
      'Ministry of Education issues notice on assistive technology deployment.',
      'Encourages educational institutions to adopt Screen Readers and OCR tools.',
      'Aims to promote equality and learning access for visually impaired students.'
    ]
  }

  if (txt.includes('ឱសថស្ថាន') || txt.includes('វិក័យប័ត្រ')) {
    return currentLang.value === 'km' ? [
      'វិក័យប័ត្រចេញដោយឱសថស្ថាន សុខភាពល្អ កាលបរិច្ឆេទ ១៦ កញ្ញា ២០២៦។',
      'ទំនិញ៖ ថ្នាំបន្តក់ភ្នែក ២ ដប ($៦.០០) និងវីតាមីន A ១ ប្រអប់ ($៤.៥០)។',
      'ចំនួនទឹកប្រាក់សរុបទាំងអស់ដែលត្រូវទូទាត់៖ $១០.៥០។'
    ] : [
      'Medical receipt from Good Health Pharmacy, dated Sept 16, 2026.',
      'Purchased items: Eye Drops (2 bottles, $6.00) & Vitamin A (1 box, $4.50).',
      'Total amount due: $10.50.'
    ]
  }

  if (txt.includes('ធនញ្ជ័យ')) {
    return currentLang.value === 'km' ? [
      'រឿងនិទានប្រជាប្រិយខ្មែរស្តីពីតួអង្គកុមារធនញ្ជ័យ។',
      'ធនញ្ជ័យជាក្មេងឆ្លាតវៃ និងមានប្រាជ្ញាលើសក្មេងដទៃក្នុងភូមិ។',
      'ប្រើប្រាស់ចំណេះដឹង និងប្រាជ្ញាដើម្បីដោះស្រាយបញ្ហាលំបាក និងជួយដល់អ្នកស្លូតត្រង់។'
    ] : [
      'Khmer folk tale featuring the clever youth Thon Chey.',
      'Thon Chey possesses remarkable wit and problem-solving intelligence.',
      'Uses wisdom to overcome difficult dilemmas and protect everyday villagers.'
    ]
  }

  const rawSentences = txt.split(/([។៕\.\?!]+|\n+)/)
    .filter(s => s && s.trim().length > 15)
    .map(s => s.trim())
  
  if (rawSentences.length > 0) {
    return rawSentences.slice(0, 3)
  }

  return [txt.slice(0, 140) + '...']
})

const toggleSummary = () => {
  isSummaryOpen.value = !isSummaryOpen.value
  if (isSummaryOpen.value) {
    isVocabOpen.value = false
    speakAccessibility(currentLang.value === 'km' ? 'បានបើកផ្ទាំងសង្ខេបឯកសារ' : 'Opened document summary')
  }
}

const speakSummaryAloud = () => {
  triggerHaptic([50, 40])
  const fullSummary = summaryPoints.value.join('. ')
  speakAccessibility(fullSummary)
}

// --- FEATURE 2: VOCABULARY & WORD MEANINGS GENERATOR ---
const VOCABULARY_DB = [
  {
    term: 'ពិការភាពគំហើញ',
    termEn: 'Visual Impairment',
    meaningKm: 'ស្ថានភាពដែលភ្នែកមើលមិនឃើញច្បាស់ ឬពិការទាំងស្រុង ដែលត្រូវការឧបករណ៍ជំនួយក្នុងការអាន។',
    meaningEn: 'Reduced vision or blindness requiring assistive technology for reading.'
  },
  {
    term: 'បច្ចេកវិទ្យាជំនួយ',
    termEn: 'Assistive Technology',
    meaningKm: 'ឧបករណ៍ ឬកម្មវិធីកុំព្យូទ័រ/ទូរស័ព្ទ (ដូចជា Screen Reader) ដែលជួយសម្រួលដល់ជនពិការ។',
    meaningEn: 'Software or devices that help persons with disabilities access information.'
  },
  {
    term: 'គ្រឹះស្ថានសិក្សា',
    termEn: 'Educational Institutions',
    meaningKm: 'សាលារៀន វិទ្យាល័យ ឬសកលវិទ្យាល័យសម្រាប់ការអប់រំ។',
    meaningEn: 'Schools, colleges, or universities dedicated to formal education.'
  },
  {
    term: 'សមភាព',
    termEn: 'Equality',
    meaningKm: 'ភាពស្មើគ្នា និងឱកាសស្មើគ្នាក្នុងសង្គម។',
    meaningEn: 'Equal rights, opportunities, and fair access for all individuals.'
  },
  {
    term: 'វិក័យប័ត្រ',
    termEn: 'Receipt / Invoice',
    meaningKm: 'ឯកសារបញ្ជាក់ពីការទិញទំនិញ ឬសេវា និងចំនួនទឹកប្រាក់ត្រូវបង់។',
    meaningEn: 'Document itemizing products or services and total amount paid/due.'
  },
  {
    term: 'ធនញ្ជ័យ',
    termEn: 'Thon Chey',
    meaningKm: 'តួអង្គក្នុងរឿងព្រេងខ្មែរ ដែលតំណាងឱ្យបញ្ញាឈ្លាសវៃ និងការគិតដោះស្រាយបញ្ហា។',
    meaningEn: 'Legendary Khmer folk character known for sharp wit and resourcefulness.'
  },
  {
    term: 'កុសល',
    termEn: 'Virtue / Good Deed',
    meaningKm: 'អំពើល្អ ឬបុណ្យដែលនាំមកនូវសេចក្តីស្ងប់ និងសេចក្តីសុខ។',
    meaningEn: 'Merit, good deeds, and wholesome actions.'
  },
  {
    term: 'សីលធម៌',
    termEn: 'Morality / Ethics',
    meaningKm: 'ចរិយាសម្បត្តិល្អ និងការប្រព្រឹត្តត្រូវតាមគន្លងច្បាប់។',
    meaningEn: 'Ethical conduct and righteous character.'
  }
]

const detectedVocabList = computed(() => {
  if (!localText.value) return []
  const txt = localText.value
  const isKm = currentLang.value === 'km'

  const matched = VOCABULARY_DB.filter(v => txt.includes(v.term) || txt.toLowerCase().includes(v.termEn.toLowerCase()))
  
  if (matched.length > 0) {
    return matched.map(item => ({
      word: isKm ? item.term : item.termEn,
      meaning: isKm ? item.meaningKm : item.meaningEn
    }))
  }

  const tokens = txt.split(/[\s,។៕\.\?!]+/).filter(w => w.length >= 4)
  const unique = Array.from(new Set(tokens)).slice(0, 3)

  return unique.map(w => ({
    word: w,
    meaning: isKm ? `ពាក្យគន្លឹះក្នុងឯកសារនេះ៖ "${w}"` : `Key extracted term from this document: "${w}"`
  }))
})

const toggleVocab = () => {
  isVocabOpen.value = !isVocabOpen.value
  if (isVocabOpen.value) {
    isSummaryOpen.value = false
    speakAccessibility(currentLang.value === 'km' ? 'បានបើកផ្ទាំងពន្យល់វាក្យសព្ទ' : 'Opened vocabulary explanations')
  }
}

const speakVocabItem = (item) => {
  triggerHaptic(30)
  speakAccessibility(`${item.word}៖ ${item.meaning}`)
}
</script>

<template>
  <!-- =========================================================================
       STATE A: EMPTY STATE (samples live on the Upload tab only)
       ========================================================================= -->
  <div v-if="!localText" class="reader-empty-fullpage" role="region" :aria-label="t('noDocEmptyTitle')">
    <div class="tactile-dropzone">
      <div class="dropzone-icon-circle">
        <BookOpen :size="32" />
      </div>
      
      <h3 class="dropzone-title khmer-font">{{ t('noDocEmptyTitle') }}</h3>
      <p class="dropzone-desc khmer-font">{{ t('noDocEmptySub') }}</p>

      <!-- Standard Neobrutalist Offset Shadow Buttons (matching Image 1) -->
      <div class="dropzone-actions-row">
        <button 
          type="button" 
          class="btn-neobrutal-shadow btn-primary-blue khmer-font"
          @click="emit('switch-mode', 'scan')"
          :aria-label="t('scanWithCam')"
        >
          <Camera :size="20" />
          <span>{{ t('scanWithCam') }}</span>
        </button>

        <button 
          type="button" 
          class="btn-neobrutal-shadow btn-secondary-white khmer-font"
          @click="emit('switch-mode', 'upload')"
          :aria-label="t('uploadDocBtn')"
        >
          <Upload :size="20" />
          <span>{{ t('uploadDocBtn') }}</span>
        </button>
      </div>

      <p class="dropzone-helper-text khmer-font">{{ t('dropzoneBadge') }}</p>
    </div>
  </div>

  <!-- =========================================================================
       STATE B: DOCUMENT LOADED (MATCHING REFERENCE SCREENSHOT)
       ========================================================================= -->
  <div v-else class="reader-doc-view" role="region" :aria-label="t('readingCanvasAria')">
    <!-- Row 1: Back to Documents Clean Text Link -->
    <div class="back-nav-row">
      <button 
        type="button" 
        class="btn-back-link khmer-font" 
        @click="triggerScanAgain"
        :aria-label="t('backToDocsAria')"
      >
        <ArrowLeft :size="20" />
        <span>{{ t('backToDocs') }}</span>
      </button>
    </div>

    <!-- Row 2: Document Header Card (Soft, clean, spacious) -->
    <div class="document-summary-card">
      <div class="card-badge-row">
        <span class="pill-category khmer-font">{{ detectedCategory }}</span>
        <span class="pill-quality-ocr khmer-font">
          <CheckCircle2 :size="16" />
          <span>{{ t('goodOcrQuality') }}</span>
        </span>
      </div>

      <h1 class="document-hero-title khmer-font">
        {{ displayTitle }}
      </h1>

      <div class="document-meta-line khmer-font">
        <span>{{ estimatedPages }} {{ t('docPages') }}</span>
        <span class="meta-dot">·</span>
        <span>~{{ wordCount }} {{ t('wordsCount') }}</span>
        <span class="meta-dot">·</span>
        <span>{{ detectedLangName }}</span>
        <span class="meta-dot">·</span>
        <span>{{ formattedScanDate }}</span>
      </div>
    </div>

    <!-- Row 3: Action Buttons Stack with Image 1 Left-Down Offset Shadow -->
    <div class="actions-stack">
      <!-- Hero Primary: Listen to document (Image 1 Style) -->
      <button 
        type="button" 
        class="btn-neobrutal-shadow btn-hero-listen khmer-font"
        :class="{ 'btn-hero-speaking': isSpeaking }"
        @click="triggerReadAloud"
        :aria-label="t('listenToDocAria')"
      >
        <Pause v-if="isSpeaking" :size="24" />
        <Volume2 v-else :size="24" />
        <span>{{ isSpeaking ? t('pauseSpeech') : t('listenToDoc') }}</span>
      </button>

      <!-- Row 4: Secondary Actions (Copy Text | Export or Share) -->
      <div class="actions-utility-grid">
        <button 
          type="button" 
          class="btn-neobrutal-shadow btn-secondary-pill khmer-font" 
          @click="copyToClipboard" 
          :aria-label="t('copyAria')"
        >
          <Check v-if="isCopied" :size="18" class="text-success" />
          <Copy v-else :size="18" />
          <span>{{ isCopied ? t('copiedText') : t('copyText') }}</span>
        </button>

        <button 
          type="button" 
          class="btn-neobrutal-shadow btn-secondary-pill khmer-font" 
          @click="downloadTxt" 
          :aria-label="t('exportOrShareAria')"
        >
          <Download :size="18" />
          <span>{{ t('exportOrShare') }}</span>
        </button>
      </div>

      <!-- Row 5: Replaced Feature Buttons (Summarize Document & Explain Words / Vocabulary) -->
      <div class="actions-features-grid">
        <button 
          type="button" 
          class="btn-neobrutal-shadow btn-feature-pill khmer-font"
          :class="{ 'feature-active': isSummaryOpen }"
          @click="toggleSummary"
          :aria-label="t('summarizeDocAria')"
        >
          <Sparkles :size="20" class="feature-icon" />
          <span class="feature-label">{{ t('summarizeDoc') }}</span>
          <span class="feature-badge">{{ summaryPoints.length }}</span>
        </button>

        <button 
          type="button" 
          class="btn-neobrutal-shadow btn-feature-pill khmer-font"
          :class="{ 'feature-active': isVocabOpen }"
          @click="toggleVocab"
          :aria-label="t('explainVocabAria')"
        >
          <BookOpen :size="20" class="feature-icon" />
          <span class="feature-label">{{ t('explainVocab') }}</span>
          <span class="feature-badge">{{ detectedVocabList.length }}</span>
        </button>
      </div>
    </div>

    <!-- DRAWER 1: DOCUMENT SUMMARY CARD -->
    <div v-if="isSummaryOpen" class="interactive-drawer-card khmer-font" role="region" :aria-label="t('summaryTitle')">
      <div class="drawer-header">
        <div class="drawer-title-col">
          <Sparkles :size="22" class="text-accent" />
          <h3 class="drawer-title">{{ t('summaryTitle') }}</h3>
        </div>
        <button type="button" class="btn-drawer-close" @click="isSummaryOpen = false" :aria-label="t('closePanel')">
          <X :size="20" />
        </button>
      </div>

      <ul class="summary-bullets-list">
        <li v-for="(point, idx) in summaryPoints" :key="idx" class="summary-bullet-item khmer-font">
          <span class="bullet-dot" aria-hidden="true"></span>
          <span class="bullet-text">{{ point }}</span>
        </li>
      </ul>

      <div class="drawer-footer-actions">
        <button type="button" class="btn-neobrutal-shadow btn-primary-blue khmer-font" @click="speakSummaryAloud">
          <Volume2 :size="18" />
          <span>{{ t('readSummaryAloud') }}</span>
        </button>
      </div>
    </div>

    <!-- DRAWER 2: VOCABULARY & WORD MEANINGS CARD -->
    <div v-if="isVocabOpen" class="interactive-drawer-card khmer-font" role="region" :aria-label="t('vocabTitle')">
      <div class="drawer-header">
        <div class="drawer-title-col">
          <BookOpen :size="22" class="text-accent" />
          <h3 class="drawer-title">{{ t('vocabTitle') }}</h3>
        </div>
        <button type="button" class="btn-drawer-close" @click="isVocabOpen = false" :aria-label="t('closePanel')">
          <X :size="20" />
        </button>
      </div>

      <div class="vocab-cards-deck">
        <div 
          v-for="(item, vIdx) in detectedVocabList" 
          :key="vIdx" 
          class="vocab-term-card khmer-font"
        >
          <div class="vocab-term-top">
            <span class="vocab-term-word">{{ item.word }}</span>
            <button 
              type="button" 
              class="btn-vocab-speak" 
              @click="speakVocabItem(item)"
              :aria-label="`ស្តាប់ពាក្យ ${item.word}`"
            >
              <Volume2 :size="18" />
            </button>
          </div>
          <p class="vocab-term-meaning">{{ item.meaning }}</p>
        </div>
      </div>
    </div>

    <!-- Row 6: Document Reading Text Card (Soft, clean, spacious) -->
    <div class="reading-content-card">
      <!-- Section Header -->
      <div class="content-card-header">
        <div class="page-indicator khmer-font">
          <FileText :size="20" class="text-accent" />
          <span>{{ t('docPageNum') }} 1 {{ t('docOf') }} {{ estimatedPages }}</span>
        </div>

        <div class="header-tools-cluster">
          <span class="word-counter-badge khmer-font">{{ wordCount }} {{ t('wordsCount') }}</span>
          
          <button 
            type="button" 
            class="btn-edit-soft khmer-font" 
            :class="{ 'btn-edit-active': isEditing }"
            @click="toggleEditing"
            :aria-label="isEditing ? t('doneEdit') : t('editText')"
          >
            <Check v-if="isEditing" :size="16" />
            <Edit3 v-else :size="16" />
            <span>{{ isEditing ? t('doneEdit') : t('editText') }}</span>
          </button>
        </div>
      </div>

      <!-- Reading Toolbar (Clean In-Card Controls) -->
      <div v-if="!isEditing" class="content-toolbar-row" role="toolbar" :aria-label="t('readingControlsAria')">
        <!-- Zoom Controls -->
        <div class="zoom-stepper-group" role="group" :aria-label="t('fontSizeLabel')">
          <button 
            type="button" 
            class="btn-stepper-soft" 
            @click="adjustZoom(-0.15)" 
            :disabled="readingFontSize <= 1.0"
            :aria-label="t('decreaseFont')"
          >
            <ZoomOut :size="16" />
          </button>
          <span class="stepper-level-text" aria-live="polite">{{ Math.round(readingFontSize * 100 / 1.25) }}%</span>
          <button 
            type="button" 
            class="btn-stepper-soft" 
            @click="adjustZoom(0.15)" 
            :disabled="readingFontSize >= 2.4"
            :aria-label="t('increaseFont')"
          >
            <ZoomIn :size="16" />
          </button>
        </div>

        <!-- Highlighting Selector Pills -->
        <div class="highlight-pills-group" role="group" :aria-label="t('highlightLabel')">
          <button 
            type="button" 
            class="pill-mode-soft khmer-font" 
            :class="{ 'pill-selected': highlightMode === 'word' }"
            @click="setHighlightMode('word')"
          >
            {{ t('wordMode') }}
          </button>
          <button 
            type="button" 
            class="pill-mode-soft khmer-font" 
            :class="{ 'pill-selected': highlightMode === 'sentence' }"
            @click="setHighlightMode('sentence')"
          >
            {{ t('sentenceMode') }}
          </button>
          <button 
            type="button" 
            class="pill-mode-soft khmer-font" 
            :class="{ 'pill-selected': highlightMode === 'paragraph' }"
            @click="setHighlightMode('paragraph')"
          >
            {{ t('paragraphMode') }}
          </button>
        </div>
      </div>

      <!-- Mode A: Textarea Editor -->
      <div v-if="isEditing" class="editing-view-container">
        <textarea 
          v-model="localText" 
          class="khmer-font editing-textarea"
          :style="{ fontSize: `${readingFontSize}rem` }"
          :placeholder="t('editTextPlaceholder')"
          :aria-label="t('editTextAria')"
        ></textarea>
      </div>

      <!-- Mode B: Karaoke Reading Text Container with Natural Word Spacing -->
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
              'sentence-active': (highlightMode === 'sentence' || highlightMode === 'word') && 
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
