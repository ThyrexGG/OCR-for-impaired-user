<script setup>
import { ref, inject } from 'vue'
import { History, BookOpen, Play, Trash2, Clock, Check, Zap, ArrowRight, Share2, Edit2, Upload, Camera } from 'lucide-vue-next'
import { t, currentLang } from '../services/i18n'

const props = defineProps({
  history: {
    type: Array,
    default: () => []
  },
  isProcessing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['load-item', 'quick-play', 'delete-item', 'clear-history', 'switch-mode', 'file-selected'])

const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})

const fileInputRef = ref(null)

const triggerFileInput = () => {
  triggerHaptic(30)
  fileInputRef.value?.click()
}

const handleFileSelect = (e) => {
  const file = e.target?.files?.[0]
  if (!file) return
  triggerHaptic('success')
  speakAccessibility(`${t('fileUploaded')} ${file.name}`)
  emit('file-selected', file)
  e.target.value = ''
}

const handleOpenInReader = (item) => {
  triggerHaptic(40)
  speakAccessibility(currentLang.value === 'km' ? `បានបើកឯកសារ ${item.name} ក្នុងផ្ទាំងអាន` : `Opened ${item.name} in reader`)
  emit('load-item', item)
}

const handleQuickPlay = (item) => {
  triggerHaptic([60, 40])
  speakAccessibility(currentLang.value === 'km' ? `ចាប់ផ្តើមអានឯកសារ ${item.name} ជាសំឡេង` : `Playing ${item.name}`)
  emit('quick-play', item)
}

const handleDelete = (item) => {
  triggerHaptic([80, 40])
  speakAccessibility(currentLang.value === 'km' ? `បានលុបឯកសារ ${item.name}` : `Deleted ${item.name}`)
  emit('delete-item', item.id)
}

const handleClearAll = () => {
  if (confirm(t('clearHistoryConfirm'))) {
    triggerHaptic([100, 50, 100])
    speakAccessibility(currentLang.value === 'km' ? 'បានសម្អាតប្រវត្តិអានទាំងអស់រួចរាល់' : 'Cleared all reading history')
    emit('clear-history')
  }
}

const handleShare = async (item) => {
  triggerHaptic(30)
  if (navigator.share && item.text) {
    try {
      await navigator.share({ title: item.name, text: item.text })
      speakAccessibility(currentLang.value === 'km' ? `បានចែករំលែកឯកសារ ${item.name}` : `Shared ${item.name}`)
      return
    } catch (e) {}
  }
  if (navigator.clipboard && item.text) {
    await navigator.clipboard.writeText(item.text)
    speakAccessibility(currentLang.value === 'km' ? `បានចម្លងអត្ថបទ ${item.name} ទៅកាន់ Clipboard រួចរាល់` : `Copied ${item.name} text`)
  }
}

const handleRename = (item) => {
  triggerHaptic(30)
  const newName = prompt(t('renamePrompt'), item.name)
  if (newName && newName.trim()) {
    item.name = newName.trim()
    try {
      localStorage.setItem('songkhem_history', JSON.stringify(props.history))
    } catch (e) {}
    speakAccessibility(currentLang.value === 'km' ? `បានប្តូរឈ្មោះឯកសារទៅជា ${item.name}` : `Renamed to ${item.name}`)
  }
}

// Estimate listening duration based on word count (~120 words/min)
const estimateDuration = (wordsCount) => {
  if (!wordsCount) return `~30 ${t('secondsApprox')}`
  const minutes = Math.ceil(wordsCount / 120)
  return `~${minutes} ${t('minutesApprox')}`
}
</script>

<template>
  <div 
    class="recent-reads-shelf" 
    :class="{ 'is-empty-state': history.length === 0 }"
    role="region" 
    :aria-label="t('recentReadsTitle')"
  >
    <!-- Shelf Header: ONLY shown when history has items (Clean state per user request) -->
    <div v-if="history.length > 0" class="shelf-header">
      <div class="header-left">
        <div class="shelf-icon-circle bg-brand">
          <History :size="20" />
        </div>
        <div class="shelf-titles">
          <h2 class="shelf-title khmer-font">{{ t('recentReadsTitle') }}</h2>
          <span class="shelf-subtitle khmer-font">{{ history.length }} {{ t('recordedDocsCount') }}</span>
        </div>
      </div>

      <div class="header-right">
        <button 
          type="button" 
          class="btn-clear-shelf khmer-font"
          @click="handleClearAll"
          :aria-label="t('clearAll')"
          :title="t('clearAll')"
        >
          <Trash2 :size="15" />
          <span>{{ t('clearAll') }}</span>
        </button>
      </div>
    </div>

    <!-- Empty State: Centered in the middle with actionable Next Steps (Upload Document button) -->
    <div v-if="history.length === 0" class="shelf-empty-state">
      <div class="empty-state-card tactile-dropzone">
        <div class="empty-icon-circle">
          <Clock :size="36" />
        </div>
        <h3 class="empty-title khmer-font">{{ t('historyEmptyHeading') }}</h3>
        <p class="empty-desc khmer-font">
          {{ t('historyEmptySub') }}
        </p>

        <!-- Hidden native file input for direct in-place uploading -->
        <input 
          type="file" 
          ref="fileInputRef" 
          class="sr-only" 
          accept="image/*,application/pdf"
          @change="handleFileSelect"
        />

        <!-- What to do next: Direct upload button -->
        <div class="empty-actions-row">
          <button 
            type="button" 
            class="btn-choose-file btn-empty-upload khmer-font"
            @click="triggerFileInput"
            :disabled="props.isProcessing"
            :aria-label="t('chooseFileBtn')"
          >
            <Upload :size="20" />
            <span>{{ t('chooseFileBtn') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Shelf Content: Shown when history has items -->
    <div v-else class="shelf-body">
      <!-- Recent Reads Accessible List -->
      <div class="reads-cards-list">
        <ul class="history-accessible-list" role="list">
          <li 
            v-for="item in history" 
            :key="item.id"
            class="history-list-row"
            :class="{ 'card-pending': item.pending }"
          >
            <!-- Left: Document Info (Title & Time) -->
            <div class="row-info-col">
              <h3 class="row-doc-title khmer-font" :title="item.name">
                {{ item.name }}
              </h3>
              <div class="row-doc-meta khmer-font">
                <span class="meta-time">{{ item.date || item.timestamp }}</span>
                <span class="meta-separator">•</span>
                <span class="meta-words">{{ item.wordsCount || 0 }} {{ t('wordsCount') }} ({{ estimateDuration(item.wordsCount) }})</span>
                <span v-if="item.cached" class="meta-cached-tag">Cache</span>
              </div>
            </div>

            <!-- Right: Predictable Actions (Play, Open, Delete) -->
            <div class="row-actions-group">
              <!-- Quick Play -->
              <button 
                type="button" 
                class="btn-row-action btn-row-play khmer-font" 
                @click="handleQuickPlay(item)"
                :disabled="item.pending"
                :aria-label="`${t('playAction')} ${item.name}`"
                :title="t('playAction')"
              >
                <Play :size="16" fill="currentColor" />
                <span>{{ t('playAction') }}</span>
              </button>

              <!-- Open in Reader -->
              <button 
                type="button" 
                class="btn-row-action btn-row-open khmer-font" 
                @click="handleOpenInReader(item)"
                :disabled="item.pending"
                :aria-label="`${t('openAction')} ${item.name}`"
                :title="t('openAction')"
              >
                <BookOpen :size="16" />
                <span>{{ t('openAction') }}</span>
              </button>

              <!-- Share / Copy -->
              <button 
                type="button" 
                class="btn-row-tool" 
                @click="handleShare(item)"
                :disabled="item.pending"
                :aria-label="`${t('shareAction')} ${item.name}`"
                :title="t('shareAction')"
              >
                <Share2 :size="16" />
              </button>

              <!-- Rename -->
              <button 
                type="button" 
                class="btn-row-tool" 
                @click="handleRename(item)"
                :disabled="item.pending"
                :aria-label="`${t('renameAction')} ${item.name}`"
                :title="t('renameAction')"
              >
                <Edit2 :size="16" />
              </button>

              <!-- Delete -->
              <button 
                type="button" 
                class="btn-row-tool btn-row-delete" 
                @click="handleDelete(item)"
                :disabled="item.pending"
                :aria-label="`${t('deleteAction')} ${item.name}`"
                :title="t('deleteAction')"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped src="./UserHistory.css"></style>
