<script setup>
import { inject } from 'vue'
import { History, FileText, Play, Trash2, ArrowUpRight, Sparkles, Clock, Check, Zap } from 'lucide-vue-next'

const props = defineProps({
  history: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['load-item', 'quick-play', 'delete-item', 'clear-history'])
const speakAccessibility = inject('speakAccessibility', () => {})

const handleLoad = (item) => {
  emit('load-item', item)
  speakAccessibility(`បានផ្ទុកឡើងវិញនូវឯកសារ ${item.name} ទៅក្នុងផ្ទាំង OCR។`)
}

const handleQuickPlay = (item) => {
  emit('quick-play', item)
  speakAccessibility(`ចាប់ផ្តើមអានឯកសារ ${item.name} ជាសំឡេង។`)
}

const handleDelete = (item) => {
  emit('delete-item', item.id)
  speakAccessibility(`បានលុបឯកសារ ${item.name} ចេញពីប្រវត្តិ។`)
}

const handleClearAll = () => {
  if (confirm('តើអ្នកពិតជាចង់លុបប្រវត្តិស្កេនទាំងអស់មែនទេ? (Clear all history?)')) {
    emit('clear-history')
    speakAccessibility('បានសម្អាតប្រវត្តិស្កេនទាំងអស់រួចរាល់។')
  }
}
</script>

<template>
  <div class="history-card glass-card" aria-label="ប្រវត្តិស្កេនឯកសាររបស់អ្នក">
    <!-- Header Bar -->
    <div class="history-header-bar">
      <div class="header-left">
        <div class="header-icon-box bg-brand">
          <History :size="18" />
        </div>
        <div class="title-meta">
          <h2 class="card-title khmer-font">ប្រវត្តិស្កេនឯកសារ</h2>
          <span class="history-subtitle khmer-font">Recent Scanned Documents ({{ history.length }})</span>
        </div>
      </div>

      <div class="header-right" v-if="history.length > 0">
        <button 
          type="button" 
          class="btn-clear-history khmer-font"
          @click="handleClearAll"
          aria-label="សម្អាតប្រវត្តិទាំងអស់"
          title="សម្អាតប្រវត្តិទាំងអស់"
        >
          <Trash2 :size="14" />
          <span>សម្អាតទាំងអស់</span>
        </button>
      </div>
    </div>

    <!-- History Items List -->
    <div class="history-content">
      <!-- Empty State -->
      <div v-if="history.length === 0" class="history-empty">
        <Clock :size="32" class="empty-icon" />
        <p class="empty-title khmer-font">មិនទាន់មានប្រវត្តិស្កេននៅឡើយទេ</p>
        <p class="empty-desc khmer-font">រាល់ឯកសារដែលអ្នកបានស្កេន នឹងត្រូវបានរក្សាទុកនៅទីនេះដោយស្វ័យប្រវត្តិ។</p>
      </div>

      <!-- Scrollable List of History Cards with TransitionGroup -->
      <div v-else class="history-list-wrapper">
        <TransitionGroup name="history-item-anim" tag="div" class="history-list">
          <article 
            v-for="item in history" 
            :key="item.id"
            class="history-item"
            :class="{ 'item-pending': item.pending }"
          >
            <div class="item-main">
              <div class="item-icon-box bg-brand">
                <FileText :size="18" />
              </div>

              <div class="item-info">
                <div class="item-top-row">
                  <h3 class="item-title khmer-font" :title="item.name">{{ item.name }}</h3>
                  <span class="item-time">{{ item.date || item.timestamp }}</span>
                </div>

                <!-- Optimistic Shimmer when pending -->
                <div v-if="item.pending" class="optimistic-shimmer-box">
                  <div class="pulse-line line-optimistic-1"></div>
                  <div class="pulse-line line-optimistic-2"></div>
                </div>
                <p v-else class="item-snippet khmer-font">
                  {{ item.text ? item.text.substring(0, 95) + '...' : 'គ្មានអត្ថបទ' }}
                </p>

                <div class="item-meta-chips">
                  <template v-if="item.pending">
                    <span class="meta-chip meta-chip-pending khmer-font">
                      <span class="mini-spin"></span>
                      <span>កំពុងស្កេន...</span>
                    </span>
                  </template>
                  <template v-else>
                    <span class="meta-chip khmer-font">{{ item.wordsCount || 0 }} ពាក្យ</span>
                    <span class="meta-chip meta-chip-ready khmer-font">ស្កេនរួច</span>
                    <span v-if="item.cached" class="meta-chip meta-chip-cached khmer-font" title="ទិន្នន័យពី Cache">
                      <Zap :size="10" />
                      <span>Cache</span>
                    </span>
                  </template>
                </div>
              </div>
            </div>

            <!-- Item Action Buttons -->
            <div class="item-actions">
              <!-- Quick Load into OCR -->
              <button 
                type="button" 
                class="btn-item-action btn-item-load khmer-font"
                @click="handleLoad(item)"
                :disabled="item.pending"
                :aria-label="`ផ្ទុកឯកសារ ${item.name} ទៅក្នុងផ្ទាំង OCR`"
                title="ផ្ទុកឡើងវិញទៅកាន់ OCR"
              >
                <ArrowUpRight :size="14" />
                <span>ផ្ទុក</span>
              </button>

              <!-- Quick Play in TTS -->
              <button 
                type="button" 
                class="btn-item-action btn-item-play khmer-font"
                @click="handleQuickPlay(item)"
                :disabled="item.pending"
                :aria-label="`អានឯកសារ ${item.name} ជាសំឡេងភ្លាមៗ`"
                title="អានជាសំឡេងភ្លាមៗ"
              >
                <Play :size="13" fill="currentColor" />
                <span>អាន</span>
              </button>

              <!-- Delete Item -->
              <button 
                type="button" 
                class="btn-item-delete"
                @click="handleDelete(item)"
                :disabled="item.pending"
                :aria-label="`លុបឯកសារ ${item.name} ចេញពីប្រវត្តិ`"
                title="លុបចោល"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </article>
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<style scoped src="./UserHistory.css"></style>
