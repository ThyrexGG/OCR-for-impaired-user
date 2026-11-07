<script setup>
import { Volume2, X, Check, Settings } from 'lucide-vue-next'
import { t, currentLang } from '../services/i18n'
import { SPEED_PRESETS } from '../composables/useKhmerTts'

defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  voices: {
    type: Array,
    default: () => []
  },
  selectedVoiceName: {
    type: String,
    default: ''
  },
  assistivePacing: {
    type: Boolean,
    default: false
  },
  rate: {
    type: Number,
    default: 1.0
  }
})

const emit = defineEmits(['close', 'select-voice', 'toggle-pacing', 'set-rate', 'open-settings'])

const handleClose = () => emit('close')
const handleSelectVoice = (name) => emit('select-voice', name)
const handlePacingChange = (e) => emit('toggle-pacing', e.target.checked)
const handleSetRate = (speed) => emit('set-rate', speed)
const handleOpenSettings = () => {
  emit('close')
  emit('open-settings')
}
</script>

<template>
  <div
    v-if="isOpen"
    class="reader-summary-backdrop"
    @click.self="handleClose"
    role="dialog"
    aria-modal="true"
    aria-labelledby="voice-dialog-title"
  >
    <div class="reader-summary-card glass-card khmer-font">
      <div class="summary-card-header">
        <div class="summary-header-left">
          <div class="summary-icon-gem">
            <Volume2 :size="20" />
          </div>
          <h2 id="voice-dialog-title" class="summary-header-title">
            {{ currentLang === 'km' ? 'សំឡេង និងល្បឿនអាន' : 'Voice & Speed' }}
          </h2>
        </div>
        <button
          type="button"
          class="summary-close-btn"
          @click="handleClose"
          :aria-label="currentLang === 'km' ? 'បិទ' : 'Close'"
        >
          <X :size="20" />
        </button>
      </div>

      <div class="summary-card-body">
        <div class="voice-option-list" role="radiogroup" :aria-label="currentLang === 'km' ? 'សំឡេង' : 'Voice'">
          <button
            v-for="voice in voices"
            :key="voice.name"
            type="button"
            class="voice-option-btn"
            :class="{ 'voice-option-active': selectedVoiceName === voice.name }"
            role="radio"
            :aria-checked="selectedVoiceName === voice.name"
            @click="handleSelectVoice(voice.name)"
          >
            <span class="voice-option-label">{{ voice.label }}</span>
            <Check v-if="selectedVoiceName === voice.name" :size="18" />
          </button>
        </div>

        <label class="voice-pacing-row">
          <input
            type="checkbox"
            :checked="assistivePacing"
            @change="handlePacingChange"
          />
          <span>{{ currentLang === 'km' ? 'អានយឺតត្រង់លេខ និងតម្លៃថ្នាំ' : 'Slow down on numbers and dosages' }}</span>
        </label>

        <div class="voice-speed-row" role="group" :aria-label="currentLang === 'km' ? 'ល្បឿន' : 'Speed'">
          <button
            v-for="speed in SPEED_PRESETS"
            :key="speed"
            type="button"
            class="voice-speed-chip"
            :class="{ 'voice-speed-active': rate === speed }"
            @click="handleSetRate(speed)"
          >
            {{ speed }}x
          </button>
        </div>
      </div>

      <div class="summary-card-footer voice-modal-footer">
        <button
          type="button"
          class="btn-summary-action btn-summary-settings-link"
          @click="handleOpenSettings"
          :aria-label="t('settings')"
        >
          <Settings :size="18" />
          <span>{{ currentLang === 'km' ? 'ការកំណត់' : 'Settings' }}</span>
        </button>
        <button
          type="button"
          class="btn-summary-action btn-summary-done"
          @click="handleClose"
        >
          <Check :size="18" />
          <span>{{ currentLang === 'km' ? 'យល់ព្រម' : 'Got it' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

