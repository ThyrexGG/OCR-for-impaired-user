<script setup>
import { CheckCircle2, Zap, AlertCircle, Info, RotateCcw, X } from 'lucide-vue-next'

const props = defineProps({
  toasts: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['dismiss', 'action'])

const handleAction = (toast) => {
  if (toast.onAction) {
    toast.onAction()
  }
  emit('action', toast)
  emit('dismiss', toast.id)
}
</script>

<template>
  <div class="toast-container" aria-live="polite" aria-atomic="true">
    <TransitionGroup name="toast-slide">
      <div 
        v-for="t in toasts" 
        :key="t.id" 
        class="toast-pill" 
        :class="`toast-${t.type || 'info'}`"
        role="status"
      >
        <div class="toast-icon">
          <Zap v-if="t.type === 'cache'" :size="18" class="icon-cache" />
          <CheckCircle2 v-else-if="t.type === 'success'" :size="18" class="icon-success" />
          <AlertCircle v-else-if="t.type === 'warning'" :size="18" class="icon-warning" />
          <Info v-else :size="18" class="icon-info" />
        </div>

        <div class="toast-content khmer-font">
          <span class="toast-msg">{{ t.message }}</span>
        </div>

        <button 
          v-if="t.actionLabel" 
          type="button" 
          class="toast-action-btn khmer-font"
          @click="handleAction(t)"
          :aria-label="t.actionLabel"
        >
          <RotateCcw :size="13" />
          <span>{{ t.actionLabel }}</span>
        </button>

        <button 
          type="button" 
          class="toast-close-btn" 
          @click="emit('dismiss', t.id)"
          aria-label="បិទការជូនដំណឹង (Close Toast)"
        >
          <X :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped src="./AppToast.css"></style>
