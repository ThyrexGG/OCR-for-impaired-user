<script setup>
import { inject } from 'vue'
import { History, BookOpen, Play, Trash2, Clock, Check, Zap, ArrowRight, Share2, Edit2 } from 'lucide-vue-next'

const props = defineProps({
  history: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['load-item', 'quick-play', 'delete-item', 'clear-history'])

const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})

const handleOpenInReader = (item) => {
  triggerHaptic(40)
  speakAccessibility(`បានបើកឯកសារ ${item.name} ក្នុងផ្ទាំងអាន`)
  emit('load-item', item)
}

const handleQuickPlay = (item) => {
  triggerHaptic([60, 40])
  speakAccessibility(`ចាប់ផ្តើមអានឯកសារ ${item.name} ជាសំឡេង`)
  emit('quick-play', item)
}

const handleDelete = (item) => {
  triggerHaptic([80, 40])
  speakAccessibility(`បានលុបឯកសារ ${item.name}`)
  emit('delete-item', item.id)
}

const handleClearAll = () => {
  if (confirm('តើអ្នកពិតជាចង់សម្អាតប្រវត្តិអានទាំងអស់មែនទេ? (Clear all history?)')) {
    triggerHaptic([100, 50, 100])
    speakAccessibility('បានសម្អាតប្រវត្តិអានទាំងអស់រួចរាល់')
    emit('clear-history')
  }
}

const handleShare = async (item) => {
  triggerHaptic(30)
  if (navigator.share && item.text) {
    try {
      await navigator.share({ title: item.name, text: item.text })
      speakAccessibility(`បានចែករំលែកឯកសារ ${item.name}`)
      return
    } catch (e) {}
  }
  if (navigator.clipboard && item.text) {
    await navigator.clipboard.writeText(item.text)
    speakAccessibility(`បានចម្លងអត្ថបទ ${item.name} ទៅកាន់ Clipboard រួចរាល់`)
  }
}

const handleRename = (item) => {
  triggerHaptic(30)
  const newName = prompt('ប្តូរឈ្មោះឯកសារ (Rename document):', item.name)
  if (newName && newName.trim()) {
    item.name = newName.trim()
    try {
      localStorage.setItem('songkhem_history', JSON.stringify(props.history))
    } catch (e) {}
    speakAccessibility(`បានប្តូរឈ្មោះឯកសារទៅជា ${item.name}`)
  }
}

// Estimate listening duration in Khmer based on word count (~130 words/min)
const estimateDuration = (wordsCount) => {
  if (!wordsCount) return '~30 វិនាទី'
  const minutes = Math.ceil(wordsCount / 120)
  return `~${minutes} នាទី`
}
</script>

<template>
  <div class="recent-reads-shelf glass-card" role="region" aria-label="ប្រវត្តិអានឯកសារថ្មីៗ">
    <!-- Shelf Header -->
    <div class="shelf-header">
      <div class="header-left">
        <div class="shelf-icon-circle bg-brand">
          <History :size="20" />
        </div>
        <div class="shelf-titles">
          <h2 class="shelf-title khmer-font">ឯកសារអានថ្មីៗ (Recent Reads)</h2>
          <span class="shelf-subtitle khmer-font">{{ history.length }} ឯកសារបានកត់ត្រាទុក</span>
        </div>
      </div>

      <div class="header-right" v-if="history.length > 0">
        <button 
          type="button" 
          class="btn-clear-shelf khmer-font"
          @click="handleClearAll"
          aria-label="សម្អាតប្រវត្តិអានទាំងអស់"
          title="សម្អាតប្រវត្តិអានទាំងអស់"
        >
          <Trash2 :size="15" />
          <span>សម្អាតទាំងអស់</span>
        </button>
      </div>
    </div>

    <!-- Shelf Content -->
    <div class="shelf-body">
      <!-- Empty State -->
      <div v-if="history.length === 0" class="shelf-empty">
        <Clock :size="44" class="text-accent" />
        <h3 class="empty-title khmer-font">មិនទាន់មានប្រវត្តិអាននៅឡើយទេ</h3>
        <p class="empty-desc khmer-font">
          រាល់ឯកសារដែលអ្នកស្កេន ឬជ្រើសរើស នឹងត្រូវបានកត់ត្រាទុកនៅទីនេះដោយស្វ័យប្រវត្តិ ដើម្បីងាយស្រួលស្តាប់ឡើងវិញគ្រប់ពេលវេលា។
        </p>
      </div>

      <!-- Recent Reads Accessible List (Section 24) -->
      <div v-else class="reads-cards-list">
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
                <span class="meta-words">{{ item.wordsCount || 0 }} ពាក្យ ({{ estimateDuration(item.wordsCount) }})</span>
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
                :aria-label="`អានឯកសារ ${item.name} ឡើងវិញ`"
                title="អានឡើងវិញ"
              >
                <Play :size="16" fill="currentColor" />
                <span>អាន (Play)</span>
              </button>

              <!-- Open in Reader -->
              <button 
                type="button" 
                class="btn-row-action btn-row-open khmer-font" 
                @click="handleOpenInReader(item)"
                :disabled="item.pending"
                :aria-label="`បើកឯកសារ ${item.name} ក្នុងផ្ទាំងអាន`"
                title="បើកមើល"
              >
                <BookOpen :size="16" />
                <span>បើក (Open)</span>
              </button>

              <!-- Share / Copy -->
              <button 
                type="button" 
                class="btn-row-tool" 
                @click="handleShare(item)"
                :disabled="item.pending"
                :aria-label="`ចែករំលែក ឬចម្លង ${item.name}`"
                title="ចែករំលែក ឬចម្លង"
              >
                <Share2 :size="16" />
              </button>

              <!-- Rename -->
              <button 
                type="button" 
                class="btn-row-tool" 
                @click="handleRename(item)"
                :disabled="item.pending"
                :aria-label="`ប្តូរឈ្មោះ ${item.name}`"
                title="ប្តូរឈ្មោះ"
              >
                <Edit2 :size="16" />
              </button>

              <!-- Delete -->
              <button 
                type="button" 
                class="btn-row-tool btn-row-delete" 
                @click="handleDelete(item)"
                :disabled="item.pending"
                :aria-label="`លុបឯកសារ ${item.name}`"
                title="លុបចោល"
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
