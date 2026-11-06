<script setup>
import { onMounted, onBeforeUnmount, inject, computed } from 'vue'
import { Camera, BookOpen, Sliders } from 'lucide-vue-next'
import { currentLang } from '../services/i18n'
import { vFocusTrap } from '../services/focusTrap'
import './WelcomeOverlay.css'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['start-tutorial', 'skip-tutorial', 'close'])

const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})

const welcomeAnnouncement = computed(() => {
  return currentLang.value === 'km'
    ? 'សូមស្វាគមន៍មកកាន់ songKHEM។ ស្កេន និងស្តាប់ការអានឯកសារជាភាសាខ្មែរ។'
    : 'Welcome to songKHEM. Scan printed Khmer documents and listen aloud.'
})

const handleStartTutorial = () => {
  triggerHaptic(40)
  speakAccessibility(currentLang.value === 'km' ? 'ចាប់ផ្តើមការណែនាំ' : 'Starting tour')
  emit('start-tutorial')
}

const handleSkipTutorial = () => {
  triggerHaptic(20)
  speakAccessibility(currentLang.value === 'km' ? 'បានរំលង' : 'Skipped')
  emit('skip-tutorial')
}

const handleKeydown = (e) => {
  if (!props.isOpen) return
  if (e.key === 'Escape') {
    handleSkipTutorial()
  } else if (e.key === 'Enter') {
    handleStartTutorial()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  if (props.isOpen) {
    speakAccessibility(welcomeAnnouncement.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div 
    v-if="isOpen"
    class="g-welcome-scrim"
    v-focus-trap
    role="dialog"
    aria-modal="true"
    aria-labelledby="g-welcome-title"
    aria-describedby="g-welcome-desc"
  >
    <div class="g-welcome-dialog">
    

      <!-- Clean Headline -->
      <h1 id="g-welcome-title" class="g-welcome-title khmer-font">
        {{ currentLang === 'km' ? 'សូមស្វាគមន៍មកកាន់ SongKhem' : 'Welcome to SongKhem' }}
      </h1>

      <!-- One-line human subtitle -->
      <p id="g-welcome-desc" class="g-welcome-subtitle khmer-font">
        {{ currentLang === 'km' 
          ? 'ស្កេន និងស្តាប់ការអានឯកសារជាភាសាខ្មែរ ដោយផ្ទាល់ពីកាមេរ៉ារបស់អ្នក។' 
          : 'Scan printed Khmer documents and listen to them read aloud.' 
        }}
      </p>

      <div class="g-features-list" role="list">
        <div class="g-feature-row" role="listitem">
          <div class="g-feature-icon-circle" aria-hidden="true">
            <Camera :size="20" />
          </div>
          <div class="g-feature-copy khmer-font">
            <span class="g-feature-title">{{ currentLang === 'km' ? 'ស្កេនឯកសារ' : 'Scan documents' }}</span>
            <span class="g-feature-desc">{{ currentLang === 'km' ? 'ប្រើកាមេរ៉ា ឬផ្ទុកឯកសារឡើងដើម្បីបំប្លែងជាសំឡេង' : 'Point camera or upload files to convert to audio' }}</span>
          </div>
        </div>

        <div class="g-feature-row" role="listitem">
          <div class="g-feature-icon-circle" aria-hidden="true">
            <BookOpen :size="20" />
          </div>
          <div class="g-feature-copy khmer-font">
            <span class="g-feature-title">{{ currentLang === 'km' ? 'អានតាមពាក្យ' : 'Follow along' }}</span>
            <span class="g-feature-desc">{{ currentLang === 'km' ? 'បន្លិចពាក្យតាមចង្វាក់សំឡេង និងឧបករណ៍បញ្ជា' : 'Word-by-word highlight and audio scrubber' }}</span>
          </div>
        </div>

        <div class="g-feature-row" role="listitem">
          <div class="g-feature-icon-circle" aria-hidden="true">
            <Sliders :size="20" />
          </div>
          <div class="g-feature-copy khmer-font">
            <span class="g-feature-title">{{ currentLang === 'km' ? 'ជំនួយការប្រើប្រាស់' : 'Built for accessibility' }}</span>
            <span class="g-feature-desc">{{ currentLang === 'km' ? 'កម្រិតពណ៌ខ្ពស់ អក្សរធំ និងបញ្ជាដោយសំឡេង' : 'High-contrast themes, large text, and voice shortcuts' }}</span>
          </div>
        </div>
      </div>

      <!-- Google Material 3 Action Buttons -->
      <div class="g-dialog-actions">
        <button 
          type="button"
          class="g-btn g-btn-primary khmer-font"
          @click="handleStartTutorial"
          :aria-label="currentLang === 'km' ? 'ចាប់ផ្តើមការណែនាំ' : 'Start tour'"
        >
          {{ currentLang === 'km' ? 'ចាប់ផ្តើមការណែនាំ' : 'Start tour' }}
        </button>

        <button 
          type="button"
          class="g-btn g-btn-text khmer-font"
          @click="handleSkipTutorial"
          :aria-label="currentLang === 'km' ? 'រំលង' : 'Not now'"
        >
          {{ currentLang === 'km' ? 'រំលង' : 'Not now' }}
        </button>
      </div>
    </div>
  </div>
</template>
