<script setup>
import { onMounted, onBeforeUnmount, inject } from 'vue'
import { HelpCircle, X, Check, Camera, Scan, Sparkles, Volume2, ShieldCheck } from 'lucide-vue-next'
import { t } from '../services/i18n'
import { vFocusTrap } from '../services/focusTrap'

const emit = defineEmits(['close'])

const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})

const handleClose = () => {
  triggerHaptic(30)
  speakAccessibility(t('closeHelp'))
  emit('close')
}

const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  speakAccessibility(t('helpTitle'))
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div 
    class="help-modal-backdrop" 
    v-focus-trap
    @click.self="handleClose" 
    role="dialog" 
    aria-modal="true" 
    aria-labelledby="help-title"
  >
    <div class="help-modal-card glass-card">
      <!-- Header -->
      <div class="help-header">
        <div class="help-title-group">
          <div class="help-icon-box bg-brand">
            <HelpCircle :size="22" />
          </div>
          <h2 id="help-title" class="help-title khmer-font">{{ t('helpTitle') }}</h2>
        </div>
        <button 
          type="button" 
          class="help-close-btn" 
          @click="handleClose" 
          :aria-label="t('closeHelp')"
        >
          <X :size="22" />
        </button>
      </div>

      <!-- 5-Step Essential Guide -->
      <div class="help-steps-body">
        <ol class="steps-ordered-list">
          <!-- Step 1 -->
          <li class="step-item">
            <span class="step-num-badge">1</span>
            <div class="step-content">
              <h3 class="step-heading khmer-font">{{ t('step1Title') }}</h3>
              <p class="step-desc khmer-font">
                {{ t('step1Desc') }}
              </p>
            </div>
          </li>

          <!-- Step 2 -->
          <li class="step-item">
            <span class="step-num-badge">2</span>
            <div class="step-content">
              <h3 class="step-heading khmer-font">{{ t('step2Title') }}</h3>
              <p class="step-desc khmer-font">
                {{ t('step2Desc') }}
              </p>
            </div>
          </li>

          <!-- Step 3 -->
          <li class="step-item">
            <span class="step-num-badge">3</span>
            <div class="step-content">
              <h3 class="step-heading khmer-font">{{ t('step3Title') }}</h3>
              <p class="step-desc khmer-font">
                {{ t('step3Desc') }}
              </p>
            </div>
          </li>

          <!-- Step 4 -->
          <li class="step-item">
            <span class="step-num-badge">4</span>
            <div class="step-content">
              <h3 class="step-heading khmer-font">{{ t('step4Title') }}</h3>
              <p class="step-desc khmer-font">
                {{ t('step4Desc') }}
              </p>
            </div>
          </li>

          <!-- Step 5 -->
          <li class="step-item">
            <span class="step-num-badge">5</span>
            <div class="step-content">
              <h3 class="step-heading khmer-font">{{ t('step5Title') }}</h3>
              <p class="step-desc khmer-font">
                {{ t('step5Desc') }}
              </p>
            </div>
          </li>
        </ol>

        <!-- Keyboard shortcuts tip -->
        <div class="help-shortcuts-tip khmer-font">
          <span class="tip-title">{{ t('shortcutTipTitle') }}</span>
          <span class="tip-desc">{{ t('shortcutTipDesc') }}</span>
        </div>
      </div>

      <!-- Footer Action -->
      <div class="help-footer">
        <button 
          type="button" 
          class="btn btn-primary btn-got-it khmer-font" 
          @click="handleClose"
        >
          <Check :size="18" />
          <span>{{ t('gotIt') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.help-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.help-modal-card {
  width: 100%;
  max-width: 448px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid #E2E8F0;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.1);
  overflow: hidden;
}

.help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.help-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.help-icon-box {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent-text);
  background: var(--color-accent);
}

.help-title {
  font-size: 1rem;
  line-height: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.help-close-btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.help-close-btn:hover {
  background: var(--color-danger-subtle);
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.help-steps-body {
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.steps-ordered-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  margin: 0;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 12px;
  background: var(--bg-surface);
  border: 1px solid #E2E8F0;
  border-radius: 8px;
}

.step-num-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-weight: 800;
  font-size: 0.75rem;
  line-height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.step-heading {
  font-size: 0.875rem;
  line-height: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.step-desc {
  font-size: 0.75rem;
  line-height: 16px;
  color: var(--text-secondary);
}

.help-shortcuts-tip {
  padding: 8px 12px;
  background: var(--color-accent-subtle);
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  font-size: 0.75rem;
  line-height: 16px;
  color: var(--color-brand-light);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tip-title {
  font-weight: 800;
}

.tip-desc kbd {
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: monospace;
  font-weight: 700;
  color: var(--color-accent);
}

.help-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  justify-content: flex-end;
}

.btn-got-it {
  min-height: 40px;
  padding: 8px 16px;
  font-size: 0.875rem;
  line-height: 20px;
  border-radius: 9999px;
}

@media (max-width: 640px) {
  .help-modal-backdrop {
    padding: 12px;
    align-items: center;
  }

  .help-modal-card {
    max-height: 90vh;
    border-radius: 16px;
  }

  .help-header {
    padding: 12px 16px;
  }

  .help-icon-box {
    width: 32px;
    height: 32px;
  }

  .help-title {
    font-size: 0.875rem;
    line-height: 20px;
  }

  .help-steps-body {
    padding: 12px;
    gap: 8px;
  }

  .step-item {
    padding: 8px 12px;
    gap: 8px;
    border-radius: 8px;
  }

  .step-num-badge {
    width: 24px;
    height: 24px;
    font-size: 0.75rem;
    line-height: 16px;
  }

  .step-heading {
    font-size: 0.875rem;
    line-height: 20px;
  }

  .step-desc {
    font-size: 0.75rem;
    line-height: 16px;
  }

  .help-footer {
    padding: 12px 16px;
  }

  .btn-got-it {
    width: 100%;
    min-height: 40px;
    font-size: 0.875rem;
    line-height: 20px;
  }
}
</style>
