<script setup>
import { onMounted, onBeforeUnmount, inject } from 'vue'
import { HelpCircle, X, Check, Camera, Scan, Sparkles, Volume2, ShieldCheck } from 'lucide-vue-next'

const emit = defineEmits(['close'])

const speakAccessibility = inject('speakAccessibility', () => {})
const triggerHaptic = inject('triggerHaptic', () => {})

const handleClose = () => {
  triggerHaptic(30)
  speakAccessibility('បានបិទការណែនាំ')
  emit('close')
}

const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  speakAccessibility('បានបើកការណែនាំពីរបៀបប្រើប្រាស់កម្មវិធី songKHEM')
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div 
    class="help-modal-backdrop" 
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
          <h2 id="help-title" class="help-title khmer-font">របៀបប្រើប្រាស់ (How to Use)</h2>
        </div>
        <button 
          type="button" 
          class="help-close-btn" 
          @click="handleClose" 
          aria-label="បិទផ្ទាំងការណែនាំ (Close Help Esc)"
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
              <h3 class="step-heading khmer-font">តម្រង់កាមេរ៉ាទៅកាន់ឯកសារ</h3>
              <p class="step-desc khmer-font">
                កាន់ទូរស័ព្ទរបស់អ្នកនៅពីលើក្រដាស ឬសៀវភៅដែលចង់អាន (Point your camera at a document).
              </p>
            </div>
          </li>

          <!-- Step 2 -->
          <li class="step-item">
            <span class="step-num-badge">2</span>
            <div class="step-content">
              <h3 class="step-heading khmer-font">កាន់ទូរស័ព្ទឱ្យនឹង</h3>
              <p class="step-desc khmer-font">
                រក្សាទីតាំងឱ្យនឹងនរ និងប្រាកដថាមានពន្លឺគ្រប់គ្រាន់ (Hold the document steady with good light).
              </p>
            </div>
          </li>

          <!-- Step 3 -->
          <li class="step-item">
            <span class="step-num-badge">3</span>
            <div class="step-content">
              <h3 class="step-heading khmer-font">ចុចប៊ូតុងថតរូបភាព</h3>
              <p class="step-desc khmer-font">
                ចុចប៊ូតុងធំ "ថតរូបភាព" ឬ "ស្កេន និងអាន" នៅកណ្តាលអេក្រង់ (Press Capture Document).
              </p>
            </div>
          </li>

          <!-- Step 4 -->
          <li class="step-item">
            <span class="step-num-badge">4</span>
            <div class="step-content">
              <h3 class="step-heading khmer-font">រង់ចាំការស្រង់អត្ថបទ</h3>
              <p class="step-desc khmer-font">
                ប្រព័ន្ធនឹងវិភាគអក្សរខ្មែរដោយស្វ័យប្រវត្តិក្នងរយៈពេលខ្លី (Wait for the text to be extracted).
              </p>
            </div>
          </li>

          <!-- Step 5 -->
          <li class="step-item">
            <span class="step-num-badge">5</span>
            <div class="step-content">
              <h3 class="step-heading khmer-font">ចុចប៊ូតុង អានជាសំឡេង</h3>
              <p class="step-desc khmer-font">
                ចុចប៊ូតុង "អានជាសំឡេង (Read Aloud)" ដើម្បីស្តាប់អត្ថបទ និងតាមដានពាក្យរំលេច (Press Read Aloud).
              </p>
            </div>
          </li>
        </ol>

        <!-- Keyboard shortcuts tip -->
        <div class="help-shortcuts-tip khmer-font">
          <span class="tip-title">ផ្លូវកាត់រហ័ស៖</span>
          <span class="tip-desc">ចុច <kbd>Space</kbd> ដើម្បីចាប់ផ្តើម/ផ្អាកការអាន និង <kbd>Ctrl+Enter</kbd> ដើម្បីស្កេន។</span>
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
          <span>យល់ព្រម (Got it)</span>
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
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.help-modal-card {
  width: 100%;
  max-width: 580px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface-elevated);
  border: 2px solid var(--border-medium);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  border-bottom: 1.5px solid var(--border-subtle);
}

.help-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.help-icon-box {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent-text);
  background: var(--color-accent);
}

.help-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.help-close-btn {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1.5px solid var(--border-subtle);
  border-radius: var(--radius-sm);
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
  padding: 20px 22px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.steps-ordered-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 10px 12px;
  background: var(--bg-surface);
  border: 1.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.step-num-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-weight: 800;
  font-size: 1rem;
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
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.step-desc {
  font-size: 0.88rem;
  color: var(--text-secondary);
  line-height: 1.55;
}

.help-shortcuts-tip {
  padding: 12px 16px;
  background: var(--color-accent-subtle);
  border: 1.5px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
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
  border-radius: var(--radius-xs);
  padding: 2px 6px;
  font-family: monospace;
  font-weight: 700;
  color: var(--color-accent);
}

.help-footer {
  padding: 14px 22px;
  border-top: 1.5px solid var(--border-subtle);
  display: flex;
  justify-content: flex-end;
}

.btn-got-it {
  min-width: 140px;
}
</style>
