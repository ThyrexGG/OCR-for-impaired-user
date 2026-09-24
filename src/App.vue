<script setup>
import { ref, computed, onMounted, provide } from 'vue'
import { useRoute } from 'vue-router'
import { 
  Settings, Volume2, VolumeX, Moon, Sun, Contrast, 
  ZoomIn, ZoomOut, RotateCcw, X, Sliders, Eye, Headphones, 
  Keyboard, Sparkles, Camera, Upload, BookOpen, History, Check, HelpCircle
} from 'lucide-vue-next'
import HelpModal from './components/HelpModal.vue'
import { clearOcrCache } from './services/cache'

const route = useRoute()
const isLoginScreen = computed(() => !route?.name || route.name === 'login' || route.path === '/')

// --- Accessibility & UI Preferences State ---
const currentTheme = ref('light')
const fontScale = ref(1.0)
const lineSpacing = ref(1.85)
const isBoldText = ref(false)
const isReducedMotion = ref(false)

const isUiVoiceEnabled = ref(false)
const isAutoReadEnabled = ref(true)
const isHapticsEnabled = ref(true)

// Active Assistant Mode: 'scan' | 'upload' | 'reader' | 'recent'
const activeMode = ref('scan')
const isSettingsOpen = ref(false)
const activeSettingsTab = ref('visual') // 'visual' | 'audio' | 'ocr' | 'interaction'

// OCR & Cloud Services Configuration
const ocrEngine = ref('tesseract')
const googleApiKey = ref('')
const googleEndpoint = ref('')
const azureVisionKey = ref('')
const azureVisionEndpoint = ref('')
const azureTtsKey = ref('')
const azureTtsEndpoint = ref('')

const saveOcrConfig = () => {
  localStorage.setItem('songkhem_ocr_engine', ocrEngine.value)
  localStorage.setItem('songkhem_google_api_key', googleApiKey.value.trim())
  localStorage.setItem('songkhem_google_endpoint', googleEndpoint.value.trim())
  localStorage.setItem('songkhem_azure_vision_key', azureVisionKey.value.trim())
  localStorage.setItem('songkhem_azure_vision_endpoint', azureVisionEndpoint.value.trim())
  localStorage.setItem('songkhem_azure_tts_key', azureTtsKey.value.trim())
  localStorage.setItem('songkhem_azure_tts_endpoint', azureTtsEndpoint.value.trim())
  triggerHaptic(40)
  speakAccessibility('បានរក្សាទុកការកំណត់ម៉ាស៊ីនស្កេន និងសំឡេង')
}

const handleClearCache = () => {
  clearOcrCache()
  triggerHaptic(40)
  speakAccessibility('បានសម្អាត Cache ឯកសារស្កេនរួចរាល់')
}

// Spoken status for screen reader and live status banner
const spokenStatusText = ref('ជំនួយការត្រៀមរួចជាស្រេច')

// --- Haptic Feedback Helper ---
const triggerHaptic = (pattern = [40]) => {
  if (!isHapticsEnabled.value || typeof window === 'undefined' || !navigator.vibrate) return
  try {
    navigator.vibrate(pattern)
  } catch (e) {}
}

// --- Spoken UI Guidance Engine ---
const speakAccessibility = (text, interrupt = true) => {
  if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
  spokenStatusText.value = text
  
  if (!isUiVoiceEnabled.value) return
  if (interrupt) {
    window.speechSynthesis.cancel()
  }
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.0
  utterance.lang = 'km-KH'
  window.speechSynthesis.speak(utterance)
}

// --- Theme Management ---
const setTheme = (theme) => {
  currentTheme.value = theme
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('songkhem_theme', theme)
  triggerHaptic(40)
  const themeDescriptions = {
    light: 'ភ្លឺច្បាស់ ពណ៌ខៀវរាជវង្ស (Royal Sapphire Light)',
    dark: 'ងងឹតរលោង (Midnight Sapphire Dark)',
    contrast: 'កម្រិតពណ៌ខ្ពស់ពិសេស (Ultra Contrast)'
  }
  speakAccessibility(`ប្តូរទម្រង់ពណ៌ជា ${themeDescriptions[theme] || theme}`)
}

// --- Font & Typography Scaling ---
const changeFontScale = (delta) => {
  let next = Math.round((fontScale.value + delta) * 100) / 100
  if (next < 0.9) next = 0.9
  if (next > 1.6) next = 1.6
  fontScale.value = next
  document.documentElement.style.setProperty('--font-scale', next)
  localStorage.setItem('songkhem_font_scale', next)
  triggerHaptic(30)
  speakAccessibility(`ទំហំអក្សរ ${Math.round(next * 100)} ភាគរយ`)
}

const resetFontScale = () => {
  fontScale.value = 1.0
  document.documentElement.style.setProperty('--font-scale', 1.0)
  localStorage.setItem('songkhem_font_scale', 1.0)
  triggerHaptic(50)
  speakAccessibility('កំណត់ទំហំអក្សរទៅធម្មតា ១០០ ភាគរយ')
}

const toggleBoldText = () => {
  isBoldText.value = !isBoldText.value
  if (isBoldText.value) {
    document.body.classList.add('bold-text')
  } else {
    document.body.classList.remove('bold-text')
  }
  localStorage.setItem('songkhem_bold', isBoldText.value ? 'true' : 'false')
  triggerHaptic(30)
  speakAccessibility(isBoldText.value ? 'បានបើកអក្សរដិតច្បាស់' : 'បានបិទអក្សរដិត')
}

const setLineSpacing = (val) => {
  lineSpacing.value = val
  document.documentElement.style.setProperty('--leading-reading', val)
  localStorage.setItem('songkhem_line_spacing', val)
  triggerHaptic(30)
  speakAccessibility(`កម្ពស់ជួរដេកអក្សរ ${val}`)
}

// --- Audio & Guidance Toggles ---
const toggleUiVoice = () => {
  isUiVoiceEnabled.value = !isUiVoiceEnabled.value
  localStorage.setItem('songkhem_voice', isUiVoiceEnabled.value ? 'true' : 'false')
  triggerHaptic([60, 40, 60])
  if (isUiVoiceEnabled.value) {
    speakAccessibility('បានបើកសំឡេងជំនួយបញ្ជា (Spoken Guidance Enabled)')
  }
}

const toggleAutoRead = () => {
  isAutoReadEnabled.value = !isAutoReadEnabled.value
  localStorage.setItem('songkhem_auto_read', isAutoReadEnabled.value ? 'true' : 'false')
  triggerHaptic(30)
  speakAccessibility(isAutoReadEnabled.value ? 'បានបើកការអានដោយស្វ័យប្រវត្តិពេលស្កេនរួច' : 'បានបិទការអានស្វ័យប្រវត្តិ')
}

const toggleHaptics = () => {
  isHapticsEnabled.value = !isHapticsEnabled.value
  localStorage.setItem('songkhem_haptics', isHapticsEnabled.value ? 'true' : 'false')
  triggerHaptic([80, 50])
  speakAccessibility(isHapticsEnabled.value ? 'បានបើកការញ័រផ្តល់ដំណឹង (Haptics ON)' : 'បានបិទការញ័រ')
}

// --- Mode Switching ---
const setMode = (mode) => {
  activeMode.value = mode
  triggerHaptic(50)
  const modeNames = {
    scan: 'ម៉ូដកាមេរ៉ា (Camera Mode)',
    upload: 'ម៉ូដផ្ទុកឯកសារ (Upload Mode)',
    reader: 'ម៉ូដអានឯកសារ (Document Reading Mode)',
    recent: 'ម៉ូដប្រវត្តិអាន (Recent Reads)'
  }
  speakAccessibility(modeNames[mode] || mode)
}

// --- Settings Modal ---
const openSettings = () => {
  isSettingsOpen.value = true
  triggerHaptic(40)
  speakAccessibility('បានបើកផ្ទាំងការកំណត់លទ្ធភាពប្រើប្រាស់ (Accessibility Settings)')
}

const closeSettings = () => {
  isSettingsOpen.value = false
  triggerHaptic(30)
  speakAccessibility('បានបិទផ្ទាំងការកំណត់')
}

// --- Help / How to Use Modal ---
const isHelpOpen = ref(false)
const openHelp = () => {
  isHelpOpen.value = true
  triggerHaptic(30)
}
const closeHelp = () => {
  isHelpOpen.value = false
  triggerHaptic(20)
}

// --- Provide Global Context to Child Components ---
provide('speakAccessibility', speakAccessibility)
provide('isUiVoiceEnabled', isUiVoiceEnabled)
provide('isAutoReadEnabled', isAutoReadEnabled)
provide('isHapticsEnabled', isHapticsEnabled)
provide('triggerHaptic', triggerHaptic)
provide('activeMode', activeMode)
provide('setMode', setMode)
provide('openSettings', openSettings)
provide('openHelp', openHelp)
provide('currentTheme', currentTheme)

onMounted(() => {
  // Load saved preferences
  let savedTheme = localStorage.getItem('songkhem_theme')
  if (!savedTheme || savedTheme === 'dark') {
    savedTheme = 'light'
    localStorage.setItem('songkhem_theme', 'light')
  }
  setTheme(savedTheme)

  const savedScale = parseFloat(localStorage.getItem('songkhem_font_scale') || '1.0')
  if (!isNaN(savedScale)) {
    fontScale.value = savedScale
    document.documentElement.style.setProperty('--font-scale', savedScale)
  }

  const savedSpacing = parseFloat(localStorage.getItem('songkhem_line_spacing') || '1.85')
  if (!isNaN(savedSpacing)) {
    lineSpacing.value = savedSpacing
    document.documentElement.style.setProperty('--leading-reading', savedSpacing)
  }

  if (localStorage.getItem('songkhem_bold') === 'true') {
    isBoldText.value = true
    document.body.classList.add('bold-text')
  }

  isUiVoiceEnabled.value = localStorage.getItem('songkhem_voice') === 'true'
  isAutoReadEnabled.value = localStorage.getItem('songkhem_auto_read') !== 'false'
  isHapticsEnabled.value = localStorage.getItem('songkhem_haptics') !== 'false'

  // Load OCR & Cloud credentials
  ocrEngine.value = localStorage.getItem('songkhem_ocr_engine') || 
    (import.meta.env.VITE_AZURE_VISION_API_KEY ? 'azure-read' : (import.meta.env.VITE_GOOGLE_VISION_API_KEY ? 'google-vision' : 'tesseract'))
  googleApiKey.value = localStorage.getItem('songkhem_google_api_key') || import.meta.env.VITE_GOOGLE_VISION_API_KEY || ''
  googleEndpoint.value = localStorage.getItem('songkhem_google_endpoint') || import.meta.env.VITE_GOOGLE_VISION_ENDPOINT || ''
  azureVisionKey.value = localStorage.getItem('songkhem_azure_vision_key') || import.meta.env.VITE_AZURE_VISION_API_KEY || ''
  azureVisionEndpoint.value = localStorage.getItem('songkhem_azure_vision_endpoint') || import.meta.env.VITE_AZURE_VISION_ENDPOINT || ''
  azureTtsKey.value = localStorage.getItem('songkhem_azure_tts_key') || import.meta.env.VITE_AZURE_TTS_API_KEY || ''
  azureTtsEndpoint.value = localStorage.getItem('songkhem_azure_tts_endpoint') || import.meta.env.VITE_AZURE_TTS_ENDPOINT || ''

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Alt + A: Toggle Accessibility Settings
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault()
      if (isSettingsOpen.value) closeSettings()
      else openSettings()
    }
    // Alt + 1, 2, 3, 4: Quick Mode Switch
    if (e.altKey && e.key === '1') { e.preventDefault(); setMode('scan') }
    if (e.altKey && e.key === '2') { e.preventDefault(); setMode('upload') }
    if (e.altKey && e.key === '3') { e.preventDefault(); setMode('reader') }
    if (e.altKey && e.key === '4') { e.preventDefault(); setMode('recent') }
    // Escape closes modal
    if (e.key === 'Escape' && isSettingsOpen.value) {
      closeSettings()
    }
  })

  // Click-to-speak delegation: self-contained voice-guided model for users WITHOUT an OS screen reader.
  // Strictly gated by isUiVoiceEnabled (default: false) to avoid talking over native screen readers (NVDA, VoiceOver, TalkBack).
  document.addEventListener('click', (e) => {
    if (!isUiVoiceEnabled.value) return
    if (e.target.closest('.access-toolbar, .settings-modal-backdrop, .bottom-nav-bar')) return

    const clickable = e.target.closest('button, .action-card, select, a, input, textarea, .mode-tab')
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
  <div class="web-app-wrapper" :class="[`theme-${currentTheme}`, { 'mode-contrast': currentTheme === 'contrast', 'no-bottom-nav': isLoginScreen }]">
    <!-- Skip to Content for Screen Readers & Keyboard Navigation -->
    <a href="#main-content" class="skip-to-content khmer-font">រំលងទៅមាតិកាសំខាន់ (Skip to Content)</a>

    <!-- Top Accessible Header (Clean, Uncluttered, Spoken Status) -->
    <header v-if="!isLoginScreen" class="assistive-header" role="banner" aria-label="របារក្បាលទំព័រ songKHEM">
      <div class="header-inner">
        <!-- Brand & Vision Companion Identity -->
        <div class="header-brand">
          <router-link to="/home" class="brand-link" aria-label="songKHEM ត្រឡប់ទៅទំព័រដើម">
            <div class="brand-logo-gem">
              <span class="pulse-dot" aria-hidden="true"></span>
              <img src="/logo.png" alt="songKHEM Logo" class="brand-img" />
            </div>
            <div class="brand-titles">
              <span class="brand-name">songKHEM</span>
              <span class="brand-caption khmer-font">ជំនួយការមើលឃើញ</span>
            </div>
          </router-link>
        </div>

        <!-- Live Spoken Status Pill (Audible & Visual) -->
        <div class="status-pill-box" aria-live="polite">
          <span class="status-indicator-dot" aria-hidden="true"></span>
          <span class="status-text khmer-font" :title="spokenStatusText">{{ spokenStatusText }}</span>
        </div>

        <!-- Header Actions -->
        <div class="header-actions">
          <!-- Voice Toggle Quick Button -->
          <button 
            type="button" 
            class="header-btn voice-btn"
            :class="{ 'active-voice': isUiVoiceEnabled }"
            @click="toggleUiVoice"
            :aria-label="isUiVoiceEnabled ? 'បិទសំឡេងជំនួយ UI' : 'បើកសំឡេងជំនួយ UI'"
            :title="isUiVoiceEnabled ? 'បិទសំឡេងជំនួយ' : 'បើកសំឡេងជំនួយ'"
          >
            <Volume2 v-if="isUiVoiceEnabled" :size="20" />
            <VolumeX v-else :size="20" />
            <span class="btn-caption khmer-font">{{ isUiVoiceEnabled ? 'សំឡេង: បើក' : 'សំឡេង: បិទ' }}</span>
          </button>

          <!-- Help / How to Use Trigger -->
          <button 
            type="button" 
            class="header-btn help-trigger-btn"
            @click="openHelp"
            aria-label="របៀបប្រើប្រាស់ (Help / How to Use)"
            title="របៀបប្រើប្រាស់ (Help)"
          >
            <HelpCircle :size="20" />
            <span class="btn-caption khmer-font">ជំនួយ</span>
          </button>

          <!-- Settings Trigger -->
          <button 
            type="button" 
            class="header-btn settings-trigger-btn"
            @click="openSettings"
            aria-label="បើកការកំណត់លទ្ធភាពប្រើប្រាស់ (Alt + A)"
            title="ការកំណត់លទ្ធភាពប្រើប្រាស់ (Alt + A)"
          >
            <Settings :size="22" />
            <span class="btn-caption khmer-font">កំណត់</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Workspace Content -->
    <main id="main-content" class="app-main-content" role="main">
      <router-view />
    </main>

    <!-- Tactile Accessible Bottom Navigation Bar (Mobile-First & One-Handed Friendly) -->
    <nav v-if="!isLoginScreen" class="bottom-nav-bar" aria-label="ការផ្លាស់ប្តូរម៉ូដប្រើប្រាស់">
      <div class="nav-bar-inner">
        <!-- Mode 1: Camera (Primary Hero, full-screen viewfinder) -->
        <button
          type="button"
          class="nav-tab-btn"
          :class="{ 'tab-active': activeMode === 'scan' }"
          @click="setMode('scan')"
          aria-label="ម៉ូដកាមេរ៉ា (Camera) Alt+1"
        >
          <div class="tab-icon-wrap">
            <Camera :size="24" />
          </div>
          <span class="tab-label khmer-font">កាមេរ៉ា</span>
        </button>

        <!-- Mode 2: Upload File / Sample Documents -->
        <button
          type="button"
          class="nav-tab-btn"
          :class="{ 'tab-active': activeMode === 'upload' }"
          @click="setMode('upload')"
          aria-label="ម៉ូដផ្ទុកឯកសារ (Upload) Alt+2"
        >
          <div class="tab-icon-wrap">
            <Upload :size="24" />
          </div>
          <span class="tab-label khmer-font">ផ្ទុកឯកសារ</span>
        </button>

        <!-- Mode 3: Document Reader -->
        <button
          type="button"
          class="nav-tab-btn"
          :class="{ 'tab-active': activeMode === 'reader' }"
          @click="setMode('reader')"
          aria-label="ម៉ូដអានឯកសារ (Document Reader) Alt+3"
        >
          <div class="tab-icon-wrap">
            <BookOpen :size="24" />
          </div>
          <span class="tab-label khmer-font">អានឯកសារ</span>
        </button>

        <!-- Mode 4: Recent Reads -->
        <button
          type="button"
          class="nav-tab-btn"
          :class="{ 'tab-active': activeMode === 'recent' }"
          @click="setMode('recent')"
          aria-label="ម៉ូដប្រវត្តិអាន (Recent Reads) Alt+4"
        >
          <div class="tab-icon-wrap">
            <History :size="24" />
          </div>
          <span class="tab-label khmer-font">ប្រវត្តិអាន</span>
        </button>
      </div>
    </nav>

    <!-- Comprehensive Accessibility Settings Modal / Sheet -->
    <div 
      v-if="isSettingsOpen" 
      class="settings-modal-backdrop" 
      @click.self="closeSettings" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="settings-dialog-title"
    >
      <div class="settings-modal-sheet glass-card">
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="modal-title-row">
            <Sliders :size="22" class="text-accent" />
            <h2 id="settings-dialog-title" class="modal-title khmer-font">ការកំណត់លទ្ធភាពប្រើប្រាស់</h2>
          </div>
          <button 
            type="button" 
            class="modal-close-btn" 
            @click="closeSettings" 
            aria-label="បិទផ្ទាំងការកំណត់ (Esc)"
            title="បិទផ្ទាំងការកំណត់"
          >
            <X :size="22" />
          </button>
        </div>

        <!-- Modal Category Tabs -->
        <div class="modal-nav-tabs" role="tablist" aria-label="ផ្នែកកំណត់">
          <button 
            type="button"
            role="tab" 
            class="tab-pill khmer-font" 
            :class="{ 'pill-active': activeSettingsTab === 'visual' }"
            :aria-selected="activeSettingsTab === 'visual'"
            @click="activeSettingsTab = 'visual'"
          >
            <Eye :size="16" />
            <span>ការមើលឃើញ</span>
          </button>
          <button 
            type="button"
            role="tab" 
            class="tab-pill khmer-font" 
            :class="{ 'pill-active': activeSettingsTab === 'audio' }"
            :aria-selected="activeSettingsTab === 'audio'"
            @click="activeSettingsTab = 'audio'"
          >
            <Headphones :size="16" />
            <span>ការស្តាប់ & សំឡេង</span>
          </button>
          <button 
            type="button"
            role="tab" 
            class="tab-pill khmer-font" 
            :class="{ 'pill-active': activeSettingsTab === 'ocr' }"
            :aria-selected="activeSettingsTab === 'ocr'"
            @click="activeSettingsTab = 'ocr'"
          >
            <Sparkles :size="16" />
            <span>ម៉ាស៊ីន OCR</span>
          </button>
          <button 
            type="button"
            role="tab" 
            class="tab-pill khmer-font" 
            :class="{ 'pill-active': activeSettingsTab === 'interaction' }"
            :aria-selected="activeSettingsTab === 'interaction'"
            @click="activeSettingsTab = 'interaction'"
          >
            <Keyboard :size="16" />
            <span>ការបញ្ជា & ផ្លូវកាត់</span>
          </button>
        </div>

        <!-- Tab 1: Visual Settings -->
        <div v-if="activeSettingsTab === 'visual'" class="tab-pane visual-pane">
          <!-- Text Size Scaling -->
          <div class="setting-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">ទំហំអក្សរទូទៅ (Text Scaling)</span>
              <span class="setting-desc khmer-font">ពង្រីក ឬបង្រួមអក្សរទាំងអស់ក្នុងកម្មវិធី</span>
            </div>
            <div class="scaler-controls" role="group" aria-label="ប្តូរទំហំអក្សរ">
              <button 
                type="button"
                class="scale-btn" 
                @click="changeFontScale(-0.1)" 
                :disabled="fontScale <= 0.9"
                aria-label="បន្ថយទំហំអក្សរ"
              >
                <ZoomOut :size="18" />
                <span class="btn-lbl">A-</span>
              </button>
              <button 
                type="button"
                class="scale-indicator-btn" 
                @click="resetFontScale" 
                title="កំណត់ឡើងវិញ ១០០%"
                aria-label="កំណត់ទំហំអក្សរឡើងវិញ ១០០%"
              >
                <RotateCcw :size="14" />
                <span>{{ Math.round(fontScale * 100) }}%</span>
              </button>
              <button 
                type="button"
                class="scale-btn" 
                @click="changeFontScale(0.1)" 
                :disabled="fontScale >= 1.6"
                aria-label="បង្កើនទំហំអក្សរ"
              >
                <ZoomIn :size="18" />
                <span class="btn-lbl">A+</span>
              </button>
            </div>
          </div>

          <!-- Contrast Themes -->
          <div class="setting-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">ទម្រង់ពណ៌កម្រិតខ្ពស់ (Contrast Themes)</span>
              <span class="setting-desc khmer-font">ជ្រើសរើសកម្រិតពណ៌ដែលស័ក្តិសមនឹងភ្នែករបស់អ្នក</span>
            </div>
            <div class="theme-options-grid">
              <button 
                type="button"
                class="theme-card-option" 
                :class="{ 'theme-selected': currentTheme === 'light' }"
                @click="setTheme('light')"
                aria-label="ផ្ទៃភ្លឺច្បាស់ (Clean Royal Sapphire Light)"
              >
                <Sun :size="20" class="text-sun" />
                <span class="theme-name khmer-font">ផ្ទៃភ្លឺច្បាស់</span>
                <span class="theme-sub">Royal Light</span>
              </button>

              <button 
                type="button" 
                class="theme-card-option theme-contrast-card" 
                :class="{ 'theme-selected': currentTheme === 'contrast' }"
                @click="setTheme('contrast')"
                aria-label="កម្រិតពណ៌ខ្ពស់ពិសេស (Ultra High Contrast Yellow on Black)"
              >
                <Contrast :size="20" class="text-contrast" />
                <span class="theme-name khmer-font">កម្រិតពណ៌ខ្ពស់</span>
                <span class="theme-sub">Ultra Contrast</span>
              </button>

              <button 
                type="button"
                class="theme-card-option" 
                :class="{ 'theme-selected': currentTheme === 'dark' }"
                @click="setTheme('dark')"
                aria-label="ងងឹតរលោង (Midnight Sapphire Dark)"
              >
                <Moon :size="20" class="text-accent" />
                <span class="theme-name khmer-font">ងងឹតរលោង</span>
                <span class="theme-sub">Midnight Dark</span>
              </button>
            </div>
          </div>

          <!-- Bold Typography Toggle -->
          <div class="setting-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">អក្សរដិតច្បាស់ (Bold Typography)</span>
              <span class="setting-desc khmer-font">បង្កើនកម្រាស់អក្សរខ្មែរឱ្យងាយអានជាងមុន</span>
            </div>
            <button 
              type="button"
              class="accessible-switch" 
              :class="{ 'switch-on': isBoldText }"
              @click="toggleBoldText"
              :aria-checked="isBoldText"
              role="switch"
              aria-label="បើកបិទអក្សរដិត"
            >
              <span class="switch-thumb"></span>
            </button>
          </div>

          <!-- Line Height / Spacing -->
          <div class="setting-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">គម្លាតជួរដេក (Line Spacing)</span>
              <span class="setting-desc khmer-font">ផ្តល់គម្លាតធំទូលាយសម្រាប់ជើងអក្សរ និងស្រៈខ្មែរ</span>
            </div>
            <div class="segment-buttons" role="group" aria-label="គម្លាតជួរដេក">
              <button 
                type="button"
                class="segment-btn" 
                :class="{ 'segment-active': lineSpacing === 1.6 }"
                @click="setLineSpacing(1.6)"
              >1.6x</button>
              <button 
                type="button"
                class="segment-btn" 
                :class="{ 'segment-active': lineSpacing === 1.85 }"
                @click="setLineSpacing(1.85)"
              >1.85x</button>
              <button 
                type="button"
                class="segment-btn" 
                :class="{ 'segment-active': lineSpacing === 2.1 }"
                @click="setLineSpacing(2.1)"
              >2.1x</button>
            </div>
          </div>
        </div>

        <!-- Tab 2: Audio & Guidance Settings -->
        <div v-if="activeSettingsTab === 'audio'" class="tab-pane audio-pane">
          <!-- UI Spoken Guidance Toggle -->
          <div class="setting-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">សំឡេងជំនួយបញ្ជា (Spoken UI Guidance)</span>
              <span class="setting-desc khmer-font">ប្រព័ន្ធនឹងអានឈ្មោះប៊ូតុងនៅពេលចុច (សម្រាប់អ្នកមិនប្រើ Screen Reader របស់ប្រព័ន្ធ)</span>
            </div>
            <button 
              type="button"
              class="accessible-switch" 
              :class="{ 'switch-on': isUiVoiceEnabled }"
              @click="toggleUiVoice"
              :aria-checked="isUiVoiceEnabled"
              role="switch"
              aria-label="បើកបិទសំឡេងជំនួយបញ្ជា UI"
            >
              <span class="switch-thumb"></span>
            </button>
          </div>

          <!-- Auto Read After Scan -->
          <div class="setting-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">អានស្វ័យប្រវត្តិ (Auto-Read After Scan)</span>
              <span class="setting-desc khmer-font">ចាប់ផ្តើមអានជាសំឡេងភ្លាមៗបន្ទាប់ពីស្កេនឯកសាររួច</span>
            </div>
            <button 
              type="button"
              class="accessible-switch" 
              :class="{ 'switch-on': isAutoReadEnabled }"
              @click="toggleAutoRead"
              :aria-checked="isAutoReadEnabled"
              role="switch"
              aria-label="បើកបិទការអានស្វ័យប្រវត្តិ"
            >
              <span class="switch-thumb"></span>
            </button>
          </div>

          <!-- Optional Azure Neural Voice API Key -->
          <div class="setting-item cloud-api-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">សំឡេងខ្មែរ Neural កម្រិតខ្ពស់ (Azure Speech - ស្រេចចិត្ត)</span>
              <span class="setting-desc khmer-font">បញ្ចូល API Key ដើម្បីទទួលបានសំឡេង Piseth & Sreymom កម្រិតធម្មជាតិបំផុត</span>
            </div>
            <div class="api-fields-group">
              <input 
                type="password" 
                v-model="azureTtsKey" 
                @blur="saveOcrConfig"
                placeholder="Azure TTS Subscription Key" 
                class="settings-api-input khmer-font" 
                aria-label="Azure TTS Subscription Key"
              />
              <input 
                type="text" 
                v-model="azureTtsEndpoint" 
                @blur="saveOcrConfig"
                placeholder="Azure TTS Endpoint (ស្រេចចិត្ត)" 
                class="settings-api-input khmer-font" 
                aria-label="Azure TTS Endpoint URL"
              />
            </div>
          </div>
        </div>

        <!-- Tab 3: OCR Engine Settings -->
        <div v-if="activeSettingsTab === 'ocr'" class="tab-pane ocr-pane">
          <!-- OCR Engine Selector -->
          <div class="setting-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">ម៉ាស៊ីនស្រង់អត្ថបទ (OCR Engine)</span>
              <span class="setting-desc khmer-font">ជ្រើសរើសបច្ចេកវិទ្យាសម្រាប់ស្កេនស្រង់អក្សរខ្មែរ និងអង់គ្លេស</span>
            </div>
            <div class="ocr-engine-options">
              <label class="engine-radio-card" :class="{ 'engine-selected': ocrEngine === 'tesseract' }">
                <input type="radio" v-model="ocrEngine" value="tesseract" @change="saveOcrConfig" class="sr-only" />
                <div class="engine-info">
                  <span class="engine-badge badge-free khmer-font">ឥតគិតថ្លៃ (Default)</span>
                  <strong class="engine-name khmer-font">Tesseract.js (ស្កេនក្នុងម៉ាស៊ីន)</strong>
                  <span class="engine-desc khmer-font">ដំណើរការផ្ទាល់ក្នុង Browser មិនត្រូវការ API Key និងមិនបាត់បង់ឯកជនភាព</span>
                </div>
              </label>

              <label class="engine-radio-card" :class="{ 'engine-selected': ocrEngine === 'google-vision' }">
                <input type="radio" v-model="ocrEngine" value="google-vision" @change="saveOcrConfig" class="sr-only" />
                <div class="engine-info">
                  <span class="engine-badge badge-cloud">Cloud API</span>
                  <strong class="engine-name khmer-font">Google Cloud Vision API</strong>
                  <span class="engine-desc khmer-font">កម្រិតភាពជាក់លាក់ខ្ពស់បំផុតសម្រាប់អក្សរពុម្ពខ្មែរស្មុគស្មាញ (ត្រូវការ API Key)</span>
                </div>
              </label>

              <label class="engine-radio-card" :class="{ 'engine-selected': ocrEngine === 'azure-read' }">
                <input type="radio" v-model="ocrEngine" value="azure-read" @change="saveOcrConfig" class="sr-only" />
                <div class="engine-info">
                  <span class="engine-badge badge-cloud">Cloud API</span>
                  <strong class="engine-name khmer-font">Microsoft Azure AI Vision</strong>
                  <span class="engine-desc khmer-font">សមត្ថភាពអានឯកសារក្រដាស និងវិក័យប័ត្រ (ត្រូវការ Subscription Key)</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Google Cloud Vision Credentials -->
          <div v-if="ocrEngine === 'google-vision'" class="setting-item cloud-api-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">Google Vision API Credentials</span>
              <span class="setting-desc khmer-font">បញ្ចូល API Key ពី Google Cloud Console</span>
            </div>
            <div class="api-fields-group">
              <input 
                type="password" 
                v-model="googleApiKey" 
                @blur="saveOcrConfig"
                placeholder="Google Vision API Key (AIza...)" 
                class="settings-api-input khmer-font" 
                aria-label="Google Vision API Key"
              />
            </div>
          </div>

          <!-- Azure AI Vision Credentials -->
          <div v-if="ocrEngine === 'azure-read'" class="setting-item cloud-api-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">Azure Computer Vision Credentials</span>
              <span class="setting-desc khmer-font">បញ្ចូល Subscription Key និង Endpoint ពី Azure Portal</span>
            </div>
            <div class="api-fields-group">
              <input 
                type="password" 
                v-model="azureVisionKey" 
                @blur="saveOcrConfig"
                placeholder="Azure Computer Vision Key" 
                class="settings-api-input khmer-font" 
                aria-label="Azure Computer Vision Key"
              />
              <input 
                type="text" 
                v-model="azureVisionEndpoint" 
                @blur="saveOcrConfig"
                placeholder="Endpoint URL (ឧ. https://eastus.api.cognitive.microsoft.com/)" 
                class="settings-api-input khmer-font" 
                aria-label="Azure Vision Endpoint URL"
              />
            </div>
          </div>

          <!-- Clear OCR Cache -->
          <div class="setting-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">សម្អាត Cache ឯកសារ (Clear Scanned Cache)</span>
              <span class="setting-desc khmer-font">លុបចោលលទ្ធផលស្កេនដែលបានរក្សាទុកក្នុង Browser ដើម្បីស្កេនឡើងវិញថ្មីស្រឡាង</span>
            </div>
            <button 
              type="button" 
              class="btn btn-secondary khmer-font" 
              @click="handleClearCache"
              style="min-height: 42px; padding: 0 16px; border-radius: var(--radius-sm);"
              aria-label="សម្អាត Cache ឯកសារស្កេនទាំងអស់"
            >
              <RotateCcw :size="16" />
              <span>សម្អាត Cache</span>
            </button>
          </div>
        </div>

        <!-- Tab 4: Interaction & Shortcuts -->
        <div v-if="activeSettingsTab === 'interaction'" class="tab-pane shortcuts-pane">
          <!-- Haptic Vibrations -->
          <div class="setting-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">ការញ័រផ្តល់ដំណឹង (Haptic Feedback)</span>
              <span class="setting-desc khmer-font">ញ័រទូរស័ព្ទពេលចាប់បានឯកសារ និងពេលចុចប៊ូតុង</span>
            </div>
            <button 
              type="button"
              class="accessible-switch" 
              :class="{ 'switch-on': isHapticsEnabled }"
              @click="toggleHaptics"
              :aria-checked="isHapticsEnabled"
              role="switch"
              aria-label="បើកបិទការញ័រផ្តល់ដំណឹង"
            >
              <span class="switch-thumb"></span>
            </button>
          </div>

          <!-- Keyboard Shortcuts Table -->
          <div class="shortcuts-card">
            <h3 class="shortcuts-card-title khmer-font">ផ្លូវកាត់ក្តារចុច (Keyboard Shortcuts)</h3>
            <ul class="shortcuts-list khmer-font">
              <li>
                <span class="key-combo"><kbd>Space</kbd></span>
                <span class="key-desc">ចាប់ផ្តើម / ផ្អាកការអាន (Play / Pause)</span>
              </li>
              <li>
                <span class="key-combo"><kbd>Ctrl</kbd> + <kbd>Enter</kbd></span>
                <span class="key-desc">ស្កេន និងអានឯកសារ (Scan & Read)</span>
              </li>
              <li>
                <span class="key-combo"><kbd>Esc</kbd></span>
                <span class="key-desc">បញ្ឈប់ការអាន / បិទផ្ទាំង (Stop / Close)</span>
              </li>
              <li>
                <span class="key-combo"><kbd>Alt</kbd> + <kbd>A</kbd></span>
                <span class="key-desc">បើកការកំណត់លទ្ធភាពប្រើប្រាស់ (Settings)</span>
              </li>
              <li>
                <span class="key-combo"><kbd>Alt</kbd> + <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> / <kbd>4</kbd></span>
                <span class="key-desc">ប្តូរម៉ូដ: កាមេរ៉ា / ផ្ទុកឯកសារ / អាន / ប្រវត្តិ</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <button 
            type="button" 
            class="btn btn-primary btn-save-modal khmer-font" 
            @click="closeSettings"
          >
            <Check :size="18" />
            <span>រួចរាល់ (Done)</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Help / How to Use Modal -->
    <HelpModal v-if="isHelpOpen" @close="closeHelp" />
  </div>
</template>

<style src="./App.css"></style>
