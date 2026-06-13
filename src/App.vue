<script setup>
import { ref, onMounted } from 'vue'
import { Volume2, VolumeX } from 'lucide-vue-next'

const isUiVoiceEnabled = ref(false)

const toggleUiVoice = () => {
  isUiVoiceEnabled.value = !isUiVoiceEnabled.value
  if (isUiVoiceEnabled.value && window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance('បើកសំឡេងបញ្ជា (UI Voice Enabled)')
    window.speechSynthesis.speak(u)
  }
}

onMounted(() => {
  document.addEventListener('click', (e) => {
    if (!isUiVoiceEnabled.value) return
    
    // Ignore clicks on the toggle button itself so it doesn't double-speak
    if (e.target.closest('.ui-voice-toggle')) return
    
    // Find the closest clickable element
    const clickable = e.target.closest('button, .action-card, select')
    if (clickable) {
      let textToSpeak = clickable.getAttribute('aria-label') || clickable.innerText || clickable.value || 'ប៊ូតុង (Button)'
      if (textToSpeak.trim()) {
        const utterance = new SpeechSynthesisUtterance(textToSpeak.trim())
        if (window.speechSynthesis) {
          window.speechSynthesis.speak(utterance)
        }
      }
    }
  })
})
</script>

<template>
  <div class="web-app-wrapper">
    <!-- Floating Accessibility UI Voice Toggle -->
    <button class="ui-voice-toggle" @click="toggleUiVoice" :aria-label="isUiVoiceEnabled ? 'បិទសំឡេងបញ្ជា (Disable UI Voice)' : 'បើកសំឡេងបញ្ជា (Enable UI Voice)'" :title="isUiVoiceEnabled ? 'បិទសំឡេងបញ្ជា' : 'បើកសំឡេងបញ្ជា'">
      <Volume2 v-if="isUiVoiceEnabled" size="32" />
      <VolumeX v-else size="32" />
    </button>
    
    <router-view />
  </div>
</template>

<style>
.web-app-wrapper {
  width: 100%;
  min-height: 100vh;
  background: #000000;
  display: flex;
  flex-direction: column;
  color: #FFFFFF;
  font-family: var(--font-sans);
  position: relative;
}

/* Floating UI Voice Toggle Button */
.ui-voice-toggle {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #FFFF00;
  color: #000000;
  border: 6px solid #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 9999;
  transition: all 0.2s ease;
}

.ui-voice-toggle:hover {
  background: #000000;
  color: #FFFF00;
  border-color: #FFFF00;
}

/* Base scrollbar styling for the whole app */
::-webkit-scrollbar {
  width: 12px;
}
::-webkit-scrollbar-track {
  background: #000000;
}
::-webkit-scrollbar-thumb {
  background: #FFFFFF;
  border-radius: 0;
  border: 2px solid #000000;
}
::-webkit-scrollbar-thumb:hover {
  background: #FFFF00;
}
</style>
