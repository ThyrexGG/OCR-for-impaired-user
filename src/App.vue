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

<style src="./App.css"></style>
