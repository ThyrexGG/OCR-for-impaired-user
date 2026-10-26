<script setup>
import { ref, computed, nextTick, inject, watch, onMounted, onBeforeUnmount } from 'vue'
import { ArrowLeft, ArrowRight, Check } from 'lucide-vue-next'
import { t, currentLang } from '../services/i18n'
import { vFocusTrap } from '../services/focusTrap'
import { GUIDELINE_STEPS } from '../services/guidelinesConfig'
import { useSpotlight } from '../composables/useSpotlight'
import './FeatureGuidelines.css'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'complete', 'step-change'])

// Injected accessible services (DIP: Dependency Inversion Principle)
const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})

// Step State
const currentStepIndex = ref(0)
const steps = GUIDELINE_STEPS
const totalSteps = steps.length
const currentStep = computed(() => steps[currentStepIndex.value] || steps[0])
const isFirstStep = computed(() => currentStepIndex.value === 0)
const isLastStep = computed(() => currentStepIndex.value === totalSteps - 1)

// DRY: Centralized active language computed properties
const activeTitle = computed(() => currentLang.value === 'km' ? currentStep.value.titleKm : currentStep.value.titleEn)
const activeDesc = computed(() => currentLang.value === 'km' ? currentStep.value.descKm : currentStep.value.descEn)

// SOLID (SRP): Delegate DOM geometry and adaptive docking to useSpotlight composable
const { spotlightRect, dockPosition, updatePosition, scrollTargetIntoView } = useSpotlight(
  () => {
    const step = currentStep.value
    if (!step) return null
    return document.querySelector(step.targetSelector) 
      ? step.targetSelector 
      : step.fallbackSelector
  },
  () => currentStep.value.preferredDock || 'bottom'
)

// Speak step instructions aloud for screen reader / audio guide
const announceStep = () => {
  const spokenText = currentLang.value === 'km'
    ? `ជំហានទី ${currentStepIndex.value + 1} នៃ ${totalSteps}: ${activeTitle.value}។ ${activeDesc.value}`
    : `Step ${currentStepIndex.value + 1} of ${totalSteps}: ${activeTitle.value}. ${activeDesc.value}`
  speakAccessibility(spokenText)
}

// Navigation Actions
const handleNext = () => {
  triggerHaptic('selection')
  if (isLastStep.value) {
    handleComplete()
  } else {
    currentStepIndex.value++
    emit('step-change', currentStepIndex.value)
  }
}

const handlePrev = () => {
  if (isFirstStep.value) return
  triggerHaptic(30)
  currentStepIndex.value--
  emit('step-change', currentStepIndex.value)
}

const handleSkip = () => {
  triggerHaptic(20)
  speakAccessibility(currentLang.value === 'km' ? 'បានរំលងការណែនាំ' : 'Skipped feature guidelines')
  emit('close')
}

const handleComplete = () => {
  triggerHaptic([50, 30, 80])
  speakAccessibility(currentLang.value === 'km' ? 'ការណែនាំបានបញ្ចប់រួចរាល់' : 'Feature guidelines completed')
  
  // In production, save to localStorage so it only shows once. In DEV, keep it testable.
  if (!import.meta.env.DEV) {
    try {
      localStorage.setItem('songkhem_guidelines_completed', 'true')
    } catch (e) {
      // Local storage unavailable
    }
  }
  emit('complete')
  emit('close')
}

// Keyboard shortcuts for the walkthrough
const handleKeydown = (e) => {
  if (!props.isOpen) return

  if (e.key === 'Escape') {
    e.preventDefault()
    handleSkip()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    handleNext()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    handlePrev()
  }
}

watch(() => props.isOpen, (open) => {
  if (open) {
    currentStepIndex.value = 0
    nextTick(() => {
      updatePosition()
      announceStep()
    })
  }
})

watch(currentStepIndex, () => {
  nextTick(() => {
    updatePosition()
    announceStep()
    scrollTargetIntoView()
  })
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  if (props.isOpen) {
    nextTick(() => {
      updatePosition()
      announceStep()
    })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div 
    v-if="isOpen" 
    class="guidelines-viewport-overlay" 
    v-focus-trap
    role="dialog"
    aria-modal="true"
    aria-labelledby="guideline-step-title"
    aria-describedby="guideline-step-desc"
  >
    <!-- 1. SVG Cutout Backdrop with Option B click interceptor -->
    <svg class="guidelines-svg-canvas" aria-hidden="true" @click.stop.prevent>
      <defs>
        <mask id="guidelines-spotlight-mask">
          <!-- White fills whole screen (opaque) -->
          <rect x="0" y="0" width="100%" height="100%" fill="#FFFFFF" />
          <!-- Black cutout reveals the active target element -->
          <rect 
            v-if="spotlightRect"
            :x="spotlightRect.left" 
            :y="spotlightRect.top" 
            :width="spotlightRect.width" 
            :height="spotlightRect.height" 
            rx="12"
            fill="#000000"
          />
        </mask>
      </defs>
      <!-- Dimmed backdrop with cutout mask -->
      <rect 
        x="0" 
        y="0" 
        width="100%" 
        height="100%" 
        fill="rgba(11, 18, 32, 0.65)" 
        mask="url(#guidelines-spotlight-mask)"
      />
    </svg>

    <!-- 2. High-Visibility Pulsating Spotlight Focus Ring around target -->
    <div 
      v-if="spotlightRect" 
      class="guidelines-active-halo"
      :style="{
        top: `${spotlightRect.top}px`,
        left: `${spotlightRect.left}px`,
        width: `${spotlightRect.width}px`,
        height: `${spotlightRect.height}px`
      }"
      aria-hidden="true"
    >
      <span class="halo-pulse-ring"></span>
    </div>

    <!-- 3. Accessible Guideline Instruction Card (Auto Docked Top or Bottom) -->
    <aside 
      ref="cardRef"
      class="guidelines-sheet-dock"
      :class="[`dock-${dockPosition}`]"
      role="region"
      :aria-label="t('helpTitle')"
    >
      <div class="guidelines-card glass-card">
        <!-- Top Row: Step Badge and Title -->
        <header class="guidelines-card-header">
          <div class="header-step-cluster">
            <span class="step-pill-badge font-bold">
              {{ currentStepIndex + 1 }} / {{ totalSteps }}
            </span>
            <div class="step-icon-wrap" aria-hidden="true">
              <component :is="currentStep.icon" :size="20" />
            </div>
            <h2 id="guideline-step-title" class="guidelines-step-title khmer-font">
              {{ activeTitle }}
            </h2>
          </div>
        </header>

        <!-- Body: Displays single active language (switches dynamically) -->
        <div class="guidelines-card-body">
          <p id="guideline-step-desc" class="guidelines-desc" :class="{ 'khmer-font': currentLang === 'km' }">
            {{ activeDesc }}
          </p>
        </div>

        <!-- Footer Actions (Option B: 3 Persistent Buttons: Prev, Next, Skip) -->
        <footer class="guidelines-card-footer">
          <div class="footer-left-group">
            <button 
              type="button"
              class="btn-guide-skip khmer-font"
              @click="handleSkip"
              :aria-label="currentLang === 'km' ? 'រំលងការណែនាំ' : 'Skip tour'"
            >
              {{ currentLang === 'km' ? 'រំលង' : 'Skip' }}
            </button>
          </div>

          <div class="footer-nav-group">
            <!-- Previous Button (Disabled on step 1) -->
            <button 
              type="button" 
              class="btn-guide-action btn-guide-prev khmer-font"
              @click="handlePrev"
              :disabled="isFirstStep"
              :aria-label="currentLang === 'km' ? 'ថយក្រោយ (ជំហានមុន)' : 'Previous step'"
            >
              <ArrowLeft :size="18" />
              <span>{{ currentLang === 'km' ? 'ថយក្រោយ' : 'Prev' }}</span>
            </button>

            <!-- Continue / Done Button (High-Contrast Primary) -->
            <button 
              type="button" 
              class="btn-guide-action btn-guide-continue khmer-font"
              @click="handleNext"
              :aria-label="isLastStep 
                ? (currentLang === 'km' ? 'បញ្ចប់ការណែនាំ' : 'Finish tour') 
                : (currentLang === 'km' ? 'បន្តទៅមុខ' : 'Continue to next step')"
            >
              <span>{{ isLastStep ? (currentLang === 'km' ? 'បញ្ចប់' : 'Done') : (currentLang === 'km' ? 'បន្ត' : 'Continue') }}</span>
              <Check v-if="isLastStep" :size="18" />
              <ArrowRight v-else :size="18" />
            </button>
          </div>
        </footer>
      </div>
    </aside>
  </div>
</template>
