<script setup>
import { ref, computed, inject } from 'vue'
import { BookOpen, Trash2, Upload } from 'lucide-vue-next'
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

const emit = defineEmits(['load-item', 'delete-item', 'clear-history', 'switch-mode', 'file-selected'])

const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})

const fileInputRef = ref(null)

const validHistory = computed(() => {
  return (props.history || []).filter(item => item && item.name && item.name.trim())
})

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

// How long the reading takes, from the letters: Khmer barely uses spaces, so a word count was far too low.
// The voice says about 11 characters a second.
const estimateDuration = (text) => {
  const secs = Math.round((text || '').replace(/s+/g, '').length / 11)
  if (secs < 60) return `~${Math.max(5, Math.round(secs / 5) * 5)} ${t('secondsApprox')}`
  return `~${Math.round(secs / 60)} ${t('minutesApprox')}`
}
</script>

<template>
  <div 
    class="recent-reads-shelf" 
    :class="{ 'is-empty-state': validHistory.length === 0 }"
    role="region" 
    :aria-label="t('recentReadsTitle')"
  >
    <!-- Empty State: Seamlessly centered on page background without enclosing card -->
    <div v-if="validHistory.length === 0" class="shelf-empty-state">
      <div class="empty-state-card">
        <h3 class="empty-title khmer-font">{{ t('historyEmptyHeading') }}</h3>
        <p class="empty-desc khmer-font">
          {{ t('historyEmptySub') }}
        </p>

        <!-- Hidden native file input for direct in-place uploading -->
        <input 
          type="file" 
          ref="fileInputRef" 
          class="sr-only" 
          :aria-label="t('chooseFileBtn')"
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
            v-for="item in validHistory" 
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
                <span class="meta-words">{{ item.pending ? item.timestamp : estimateDuration(item.text) }}</span>
              </div>
            </div>

            <!-- Actions (Open and Delete only) -->
            <div class="row-actions-group">
              <!-- Open in Reader (Primary) -->
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

              <!-- Delete (Alongside Open) -->
              <button 
                type="button" 
                class="btn-row-action btn-row-delete-action khmer-font" 
                @click="handleDelete(item)"
                :disabled="item.pending"
                :aria-label="`${t('deleteAction')} ${item.name}`"
                :title="t('deleteAction')"
              >
                <Trash2 :size="16" />
                <span>{{ t('deleteAction') }}</span>
              </button>
            </div>
          </li>
        </ul>
      </div>

      <!-- Shelf Footer: Clear All button at the bottom (large, full container width, text only) -->
      <div class="shelf-footer">
        <button 
          type="button" 
          class="btn-clear-all-bottom khmer-font"
          @click="handleClearAll"
          :aria-label="t('clearAll')"
        >
          {{ t('clearAll') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./UserHistory.css"></style>
