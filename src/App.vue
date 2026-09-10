<script setup>
import { ref, onMounted, provide } from 'vue'
import { Volume2, VolumeX, Moon, Sun, Contrast, ZoomIn, ZoomOut, RotateCcw } from 'lucide-vue-next'

// Theme Management: 'dark' (Sleek Midnight) | 'contrast' (Ultra High Contrast) | 'light' (Clean Light)
const currentTheme = ref('dark')
const fontScale = ref(1.0)
const isUiVoiceEnabled = ref(false)

const setTheme = (theme) => {
  currentTheme.value = theme
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('songkhem_theme', theme)
  speakAccessibility(`ប្តូរទម្រង់ពណ៌ជា ${theme === 'dark' ? 'ងងឹតរលោង (Sleek Dark)' : theme === 'contrast' ? 'កម្រិតពណ៌ខ្ពស់ពិសេស (Ultra Contrast)' : 'ភ្លឺច្បាស់ (Clean Light)'}`)
}

const cycleTheme = () => {
  if (currentTheme.value === 'dark') setTheme('contrast')
  else if (currentTheme.value === 'contrast') setTheme('light')
  else setTheme('dark')
}

// Font Scaling Management
const changeFontScale = (delta) => {
  let next = Math.round((fontScale.value + delta) * 100) / 100
  if (next < 0.9) next = 0.9
  if (next > 1.5) next = 1.5
  fontScale.value = next
  document.documentElement.style.setProperty('--font-scale', next)
  localStorage.setItem('songkhem_font_scale', next)
  speakAccessibility(`ទំហំអក្សរ ${Math.round(next * 100)} ភាគរយ`)
}

const resetFontScale = () => {
  fontScale.value = 1.0
  document.documentElement.style.setProperty('--font-scale', 1.0)
  localStorage.setItem('songkhem_font_scale', 1.0)
  speakAccessibility('កំណត់ទំហំអក្សរទៅធម្មតា ១០០ ភាគរយ')
}

// Voice Guidance & Announcements
const speakAccessibility = (text) => {
  if (!isUiVoiceEnabled.value || typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 1.0
  window.speechSynthesis.speak(u)
}

provide('speakAccessibility', speakAccessibility)
provide('isUiVoiceEnabled', isUiVoiceEnabled)

const toggleUiVoice = () => {
  isUiVoiceEnabled.value = !isUiVoiceEnabled.value
  localStorage.setItem('songkhem_voice', isUiVoiceEnabled.value ? 'true' : 'false')
  if (isUiVoiceEnabled.value && window.speechSynthesis) {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance('បានបើកសំឡេងជំនួយបញ្ជា (UI Voice Guidance Enabled)')
    window.speechSynthesis.speak(u)
  }
}

onMounted(() => {
  // Load saved preferences
  const savedTheme = localStorage.getItem('songkhem_theme') || 'dark'
  setTheme(savedTheme)

  const savedScale = parseFloat(localStorage.getItem('songkhem_font_scale') || '1.0')
  if (!isNaN(savedScale)) {
    fontScale.value = savedScale
    document.documentElement.style.setProperty('--font-scale', savedScale)
  }

  const savedVoice = localStorage.getItem('songkhem_voice') === 'true'
  isUiVoiceEnabled.value = savedVoice

  // Click-to-speak for visually impaired guidance
  document.addEventListener('click', (e) => {
    if (!isUiVoiceEnabled.value) return
    if (e.target.closest('.access-toolbar, .ui-voice-toggle')) return
    
    const clickable = e.target.closest('button, .action-card, select, a, input, textarea')
    if (clickable) {
      let textToSpeak = clickable.getAttribute('aria-label') || 
                        clickable.getAttribute('title') || 
                        clickable.innerText || 
                        clickable.placeholder || 
                        clickable.value || 
                        'ប៊ូតុងបញ្ជា'
      if (textToSpeak.trim()) {
        speakAccessibility(textToSpeak.trim())
      }
    }
  })
})
</script>

<template>
  <div class="web-app-wrapper" :class="`theme-${currentTheme}`">
    <!-- Skip to Content for Screen Readers & Keyboard Navigation -->
    <a href="#main-content" class="skip-to-content khmer-font">រំលងទៅមាតិកាសំខាន់ (Skip to Content)</a>

    <!-- Top Accessible Toolbar (Always Accessible) -->
    <nav class="access-toolbar" aria-label="ការកំណត់លទ្ធភាពប្រើប្រាស់ (Accessibility Controls)">
      <div class="toolbar-inner">
        <!-- Brand identity mark -->
        <div class="toolbar-brand">
          <span class="brand-pill khmer-font">
            <span class="pulse-indicator"></span>
            songKHEM ជំនួយការអាន
          </span>
        </div>

        <div class="toolbar-actions">
          <!-- Font Size Scaler -->
          <div class="tool-group font-scaler" role="group" aria-label="ប្តូរទំហំអក្សរ">
            <button 
              class="tool-btn" 
              @click="changeFontScale(-0.1)" 
              aria-label="បន្ថយទំហំអក្សរ (Decrease Font Size)" 
              title="បន្ថយទំហំអក្សរ"
              :disabled="fontScale <= 0.9"
            >
              <ZoomOut :size="18" />
              <span class="btn-text">A-</span>
            </button>
            <button 
              class="tool-btn scale-indicator" 
              @click="resetFontScale" 
              aria-label="កំណត់ទំហំអក្សរធម្មតា (Reset Font Size)"
              title="កំណត់ទំហំអក្សរឡើងវិញ"
            >
              <RotateCcw :size="14" />
              <span class="scale-val">{{ Math.round(fontScale * 100) }}%</span>
            </button>
            <button 
              class="tool-btn" 
              @click="changeFontScale(0.1)" 
              aria-label="បង្កើនទំហំអក្សរ (Increase Font Size)" 
              title="បង្កើនទំហំអក្សរ"
              :disabled="fontScale >= 1.5"
            >
              <ZoomIn :size="18" />
              <span class="btn-text">A+</span>
            </button>
          </div>

          <!-- Theme Mode Switcher -->
          <div class="tool-group theme-switcher" role="group" aria-label="ប្តូរពណ៌ផ្ទៃក្រោយ">
            <button 
              class="tool-btn theme-cycle-btn" 
              @click="cycleTheme"
              :aria-label="`ប្តូរទម្រង់ពណ៌ បច្ចុប្បន្នគឺ ${currentTheme}`"
              :title="`ប្តូរទម្រង់ពណ៌ (បច្ចុប្បន្ន: ${currentTheme})`"
            >
              <Moon v-if="currentTheme === 'dark'" :size="18" class="icon-theme" />
              <Contrast v-else-if="currentTheme === 'contrast'" :size="18" class="icon-theme text-contrast" />
              <Sun v-else :size="18" class="icon-theme text-sun" />
              <span class="theme-label khmer-font">
                {{ currentTheme === 'dark' ? 'ងងឹតរលោង' : currentTheme === 'contrast' ? 'កម្រិតពណ៌ខ្ពស់' : 'ផ្ទៃភ្លឺ' }}
              </span>
            </button>
          </div>

          <!-- Spoken Audio Guidance Toggle -->
          <button 
            class="tool-btn voice-toggle-btn"
            :class="{ 'voice-active': isUiVoiceEnabled }"
            @click="toggleUiVoice"
            :aria-label="isUiVoiceEnabled ? 'បិទសំឡេងជំនួយ (UI Voice ON)' : 'បើកសំឡេងជំនួយ (UI Voice OFF)'"
            :title="isUiVoiceEnabled ? 'បិទសំឡេងជំនួយ' : 'បើកសំឡេងជំនួយ'"
          >
            <Volume2 v-if="isUiVoiceEnabled" :size="18" />
            <VolumeX v-else :size="18" />
            <span class="voice-text khmer-font">
              {{ isUiVoiceEnabled ? 'សំឡេងជំនួយ: បើក' : 'សំឡេងជំនួយ: បិទ' }}
            </span>
          </button>
        </div>
      </div>
    </nav>

    <!-- Main App Content (Router Views) -->
    <main id="main-content" class="app-main-content">
      <router-view />
    </main>

    <!-- Floating Quick Audio Guide Button (Accessible for Touch & Mobile) -->
    <button 
      class="ui-voice-toggle" 
      :class="{ 'voice-active': isUiVoiceEnabled }"
      @click="toggleUiVoice" 
      :aria-label="isUiVoiceEnabled ? 'បិទសំឡេងបញ្ជា (Disable UI Voice)' : 'បើកសំឡេងបញ្ជា (Enable UI Voice)'" 
      :title="isUiVoiceEnabled ? 'បិទសំឡេងបញ្ជា (Voice ON)' : 'បើកសំឡេងបញ្ជា (Voice OFF)'"
    >
      <Volume2 v-if="isUiVoiceEnabled" size="28" />
      <VolumeX v-else size="28" />
      <span class="voice-ping" v-if="isUiVoiceEnabled"></span>
    </button>
  </div>
</template>

<style src="./App.css"></style>
