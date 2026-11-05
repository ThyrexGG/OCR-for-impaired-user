<script setup>
import { ref, computed, onMounted, onBeforeUnmount, provide, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { 
  Settings, Moon, Sun, Contrast, 
  ZoomIn, ZoomOut, RotateCcw, X, Sliders, Eye, Headphones, 
  Keyboard, Sparkles, Camera, Upload, BookOpen, History, Check, HelpCircle, Languages,
  Mic, MicOff, Code
} from 'lucide-vue-next'
import HelpModal from './components/HelpModal.vue'
import FeatureGuidelines from './components/FeatureGuidelines.vue'
import WelcomeOverlay from './components/WelcomeOverlay.vue'
import { currentLang, toggleLang, t } from './services/i18n'
import { haptics } from './services/haptics'
import { announcer } from './services/announcer'
import { installTalkback, tp } from './services/talkback'
import { TP } from './services/talkPhrases'
import { vFocusTrap } from './services/focusTrap'
import { useA11yPreferences } from './composables/useA11yPreferences'
import { clearOcrCache } from './services/cache'
import { CLOUD_API_AVAILABLE } from './services/cloudApi'
import { voiceCommands } from './services/voiceCommands'


const route = useRoute()
const isLoginScreen = computed(() => !route?.name || route.name === 'login' || route.path === '/')

// Accessibility & UI Preferences Composable (SOLID: SRP)
const {
  currentTheme,
  fontScale,
  lineSpacing,
  isBoldText,
  isUiVoiceEnabled,
  isExploreEnabled,
  voiceRate,
  isAutoReadEnabled,
  isHapticsEnabled,
  osScreenReaderName,
  setTheme,
  changeFontScale,
  resetFontScale,
  toggleBoldText,
  setLineSpacing,
  toggleUiVoice,
  toggleExplore,
  setVoiceRate,
  toggleAutoRead,
  toggleHaptics,
  initPreferences
} = useA11yPreferences()

// Active Assistant Mode: 'scan' | 'upload' | 'reader' | 'recent'
const activeMode = ref('scan')
const isSettingsOpen = ref(false)
const activeSettingsTab = ref('visual') // 'visual' | 'audio' | 'system'

// OCR & Cloud Services Configuration
const ocrEngine = ref('tesseract')
const googleApiKey = ref('')
const googleEndpoint = ref('')
const azureVisionKey = ref('')
const azureVisionEndpoint = ref('')
const azureTtsKey = ref('')
const azureTtsEndpoint = ref('')

// Hidden Developer Mode State (Alt+D or tap Logo 5 times)
const DEV_STORAGE_KEY = 'songkhem_dev_mode'
const isDevMode = ref(typeof window !== 'undefined' ? localStorage.getItem(DEV_STORAGE_KEY) === 'true' : false)

const toggleDevMode = (explicitState) => {
  const next = typeof explicitState === 'boolean' ? explicitState : !isDevMode.value
  isDevMode.value = next
  if (typeof window !== 'undefined') {
    localStorage.setItem(DEV_STORAGE_KEY, String(next))
  }
  triggerHaptic(60)
  const msg = next
    ? (currentLang.value === 'km' ? 'បានបើកម៉ូដ Developer' : 'Developer mode enabled')
    : (currentLang.value === 'km' ? 'បានបិទម៉ូដ Developer' : 'Developer mode locked')
  speakAccessibility(msg)
}

let logoTapCount = 0
let logoTapTimer = null

const handleLogoTap = () => {
  logoTapCount++
  if (logoTapTimer) clearTimeout(logoTapTimer)
  logoTapTimer = setTimeout(() => {
    logoTapCount = 0
  }, 2500)

  if (logoTapCount >= 5) {
    logoTapCount = 0
    toggleDevMode()
  }
}

const saveOcrConfig = () => {
  localStorage.setItem('songkhem_ocr_engine', ocrEngine.value)
  localStorage.setItem('songkhem_google_api_key', googleApiKey.value.trim())
  localStorage.setItem('songkhem_google_endpoint', googleEndpoint.value.trim())
  localStorage.setItem('songkhem_azure_vision_key', azureVisionKey.value.trim())
  localStorage.setItem('songkhem_azure_vision_endpoint', azureVisionEndpoint.value.trim())
  localStorage.setItem('songkhem_azure_tts_key', azureTtsKey.value.trim())
  localStorage.setItem('songkhem_azure_tts_endpoint', azureTtsEndpoint.value.trim())
  triggerHaptic(40)
  speakAccessibility(currentLang.value === 'km' ? 'បានរក្សាទុកការកំណត់ម៉ាស៊ីនស្កេន និងសំឡេង' : 'Saved OCR engine and audio settings')
}

const handleClearCache = () => {
  clearOcrCache()
  triggerHaptic(40)
  speakAccessibility(currentLang.value === 'km' ? 'បានសម្អាត Cache ឯកសារស្កេនរួចរាល់' : 'Cleared scanned documents cache')
}

// Spoken status for screen reader and live status banner
const spokenStatusText = ref(t('spokenStatusReady'))

// Screen reader and audible guidance bridge
const speakAccessibility = (text, interrupt = true) => {
  spokenStatusText.value = Array.isArray(text) ? text.join(' ') : text
  announcer.speak(text, interrupt)
}

const triggerHaptic = (pattern = 'selection') => {
  haptics.pulse(pattern)
}

// --- Mode Switching ---
const setMode = (mode) => {
  activeMode.value = mode
  haptics.pulse('selection')
  const intros = {
    scan: tp('screenCamera'),
    upload: tp('screenUpload'),
    reader: t('navReader'),
    recent: tp('screenRecent')
  }
  speakAccessibility(intros[mode] || mode)
}

// --- Settings Modal ---
const openSettings = () => {
  isSettingsOpen.value = true
  haptics.pulse('selection')
  speakAccessibility(t('settingsTitle'))
}

const closeSettings = () => {
  isSettingsOpen.value = false
  haptics.pulse('tap')
  speakAccessibility(t('closeSettings'))
}

// --- Feature Guidelines Walkthrough ---
const isGuidelinesOpen = ref(false)
const openGuidelines = () => {
  isWelcomeOpen.value = false
  isHelpOpen.value = false
  isSettingsOpen.value = false
  isGuidelinesOpen.value = true
  haptics.pulse('selection')
}
const closeGuidelines = () => {
  isGuidelinesOpen.value = false
}

// --- First-Open Welcome Overlay ---
const isWelcomeOpen = ref(false)
const openWelcome = () => {
  isWelcomeOpen.value = true
  haptics.pulse('selection')
}
const handleStartTutorialFromWelcome = () => {
  isWelcomeOpen.value = false
  openGuidelines()
}
const handleSkipTutorialFromWelcome = () => {
  isWelcomeOpen.value = false
  try {
    localStorage.setItem('songkhem_guidelines_completed', 'true')
  } catch (e) {}
}

// --- Help / How to Use Modal ---
const isHelpOpen = ref(false)
const openHelp = () => {
  isHelpOpen.value = true
  haptics.pulse('tap')
}
const closeHelp = () => {
  isHelpOpen.value = false
  haptics.pulse('tap')
}

// --- Language Toggle Handler (Silently toggles without visual announcement pill) ---
const handleToggleLang = () => {
  toggleLang()
  haptics.pulse('toggle')
}

// --- Hands-Free Voice Commands Controller ---
const isVoiceListening = ref(false)
const lastVoiceCommand = ref(null)

const toggleVoiceListening = () => {
  if (isVoiceListening.value) {
    voiceCommands.stop()
    isVoiceListening.value = false
    haptics.pulse('tap')
    speakAccessibility(currentLang.value === 'km' ? 'បានបិទការបញ្ជាដោយសំឡេង' : 'Voice commands turned off')
  } else {
    voiceCommands.setLanguage(currentLang.value)
    const started = voiceCommands.start(
      (cmd) => {
        lastVoiceCommand.value = cmd
        haptics.pulse([50, 40])
        if (cmd.action === 'help') openHelp()
        else if (cmd.action === 'scan') setMode('scan')
      },
      (err) => {
        console.warn('Voice command recognition warning:', err)
      }
    )
    isVoiceListening.value = started
    if (started) {
      haptics.pulse('selection')
      speakAccessibility(
        currentLang.value === 'km' 
          ? 'បានបើកការបញ្ជាដោយសំឡេង។ អាចនិយាយថា អាន, ឈប់, ឬ ស្កេន' 
          : 'Voice commands listening. You can say Play, Stop, or Scan'
      )
    }
  }
}

// --- Provide Global Context to Child Components ---
provide('speakAccessibility', speakAccessibility)
provide('isUiVoiceEnabled', isUiVoiceEnabled)
provide('isExploreEnabled', isExploreEnabled)
provide('isAutoReadEnabled', isAutoReadEnabled)
provide('isHapticsEnabled', isHapticsEnabled)
provide('triggerHaptic', triggerHaptic)
provide('activeMode', activeMode)
provide('setMode', setMode)
provide('openSettings', openSettings)
provide('openHelp', openHelp)
provide('openGuidelines', openGuidelines)
provide('currentTheme', currentTheme)
provide('currentLang', currentLang)
provide('toggleLang', toggleLang)
provide('t', t)
provide('isVoiceListening', isVoiceListening)
provide('toggleVoiceListening', toggleVoiceListening)
provide('lastVoiceCommand', lastVoiceCommand)

let stopTalkback = null
let stopMuteLink = null
const onOffline = () => speakAccessibility(tp('wentOffline'))
const onOnline = () => speakAccessibility(tp('backOnline'), false)

onBeforeUnmount(() => {
  if (stopTalkback) stopTalkback()
  if (stopMuteLink) stopMuteLink()
  window.removeEventListener('offline', onOffline)
  window.removeEventListener('online', onOnline)
})

onMounted(() => {
  initPreferences()

  // One-time cleanup: earlier builds pre-filled these fields with the site's
  // own (now server-side, rotated) keys and saved them here on blur, where
  // they would override the api/* proxy with a dead key.
  if (!localStorage.getItem('songkhem_keys_migrated_v2')) {
    ['songkhem_google_api_key', 'songkhem_google_endpoint', 'songkhem_azure_vision_key',
      'songkhem_azure_vision_endpoint', 'songkhem_azure_tts_key', 'songkhem_azure_tts_endpoint']
      .forEach(k => localStorage.removeItem(k))
    localStorage.setItem('songkhem_keys_migrated_v2', '1')
  }

  // Load OCR & Cloud credentials (the user's own keys only; none by default)
  ocrEngine.value = localStorage.getItem('songkhem_ocr_engine') ||
    (CLOUD_API_AVAILABLE ? 'google-vision' : 'tesseract')
  googleApiKey.value = localStorage.getItem('songkhem_google_api_key') || ''
  googleEndpoint.value = localStorage.getItem('songkhem_google_endpoint') || ''
  azureVisionKey.value = localStorage.getItem('songkhem_azure_vision_key') || ''
  azureVisionEndpoint.value = localStorage.getItem('songkhem_azure_vision_endpoint') || ''
  azureTtsKey.value = localStorage.getItem('songkhem_azure_tts_key') || ''
  azureTtsEndpoint.value = localStorage.getItem('songkhem_azure_tts_endpoint') || ''

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Alt + A: Toggle Accessibility Settings
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault()
      if (isSettingsOpen.value) closeSettings()
      else openSettings()
    }
    // Alt + D: Toggle Developer Settings Mode
    if (e.altKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault()
      toggleDevMode()
    }
    // Alt + V: Toggle Voice Commands Hands-Free
    if (e.altKey && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault()
      toggleVoiceListening()
    }
    // Alt + 1, 2, 3: Quick Mode Switch
    if (e.altKey && e.key === '1') { e.preventDefault(); setMode('scan') }
    if (e.altKey && e.key === '2') { e.preventDefault(); setMode('upload') }
    if (e.altKey && e.key === '3') { e.preventDefault(); setMode('recent') }
    // Escape closes modal
    if (e.key === 'Escape' && isSettingsOpen.value) {
      closeSettings()
    }
  })

  // Talk-back: touch explore (tap to hear, tap again to open), keyboard focus and mouse click speech
  stopTalkback = installTalkback({
    isVoiceOn: () => isUiVoiceEnabled.value,
    isExploreOn: () => isExploreEnabled.value
  })

  stopMuteLink = announcer.onSpeakingChange((speaking) => voiceCommands.setMuted(speaking))

  // Warm the browser cache with the fixed Khmer phrases so their first playback is instant
  if (isUiVoiceEnabled.value) announcer.prefetch(Object.values(TP).map((p) => p.km))

  window.addEventListener('offline', onOffline)
  window.addEventListener('online', onOnline)

  // Auto-launch welcome screen on first open: in DEV mode always show for testing; in production check localStorage
  const isDev = import.meta.env.DEV
  const checkAndLaunchGuidelines = () => {
    if (!isLoginScreen.value && (isDev || !localStorage.getItem('songkhem_guidelines_completed'))) {
      setTimeout(() => {
        if (!isLoginScreen.value && !isSettingsOpen.value && !isHelpOpen.value && !isGuidelinesOpen.value) {
          isWelcomeOpen.value = true
        }
      }, 500)
    }
  }

  // Watch route transitions into HomeScreen
  watch(isLoginScreen, (isLogin) => {
    if (!isLogin) {
      checkAndLaunchGuidelines()
    }
  }, { immediate: true })
})
</script>

<template>
  <div class="web-app-wrapper notranslate" translate="no" :class="[`theme-${currentTheme}`, { 'mode-contrast': currentTheme === 'contrast', 'no-bottom-nav': isLoginScreen, 'is-reader-mode': activeMode === 'reader' }]">
    <!-- Skip to Content for Screen Readers & Keyboard Navigation -->
    <a href="#main-content" class="skip-to-content khmer-font">{{ t('skipToContent') }}</a>

    <!-- Top Accessible Header (Hidden in dedicated Reader screen) -->
    <header 
      v-if="!isLoginScreen && activeMode !== 'reader'" 
      class="assistive-header" 
      role="banner" 
      :aria-label="t('appName')"
    >
      <div class="header-inner">
        <!-- Brand & Logo (Top Left) -->
        <div class="header-brand-cluster">
          <div class="brand-link">
            <div 
              class="brand-logo-gem" 
              @click.stop="handleLogoTap"
              role="button"
              tabindex="0"
              @keydown.enter="handleLogoTap"
              :aria-label="t('appName')"
              title="songKHEM"
              style="cursor: pointer;"
            >
              <span class="pulse-dot" aria-hidden="true"></span>
              <img src="/logo.png" alt="songKHEM Logo" class="brand-img" />
            </div>
            <router-link to="/home" class="brand-titles" :aria-label="t('appName')">
              <span class="brand-name">{{ t('appName') }}</span>
              <span class="brand-caption khmer-font">{{ t('brandSub') }}</span>
            </router-link>
          </div>
        </div>

        <!-- Header Actions: On small screen, keep only Language and Settings -->
        <div class="header-actions">
          <!-- Language Switcher Button (Clean Single-Language Toggle) -->
          <button 
            type="button" 
            class="header-btn lang-toggle-btn"
            @click="handleToggleLang"
            :aria-label="t('langToggleAria')"
            :title="t('langToggleAria')"
          >
            <Languages :size="18" />
            <span class="btn-caption font-bold">{{ t('langToggle') }}</span>
          </button>

          <!-- Help / How to Use Trigger -->
          <button 
            type="button" 
            class="header-btn help-trigger-btn"
            @click="openHelp"
            :aria-label="t('help')"
            :title="t('help')"
          >
            <HelpCircle :size="20" />
            <span class="btn-caption khmer-font">{{ t('help') }}</span>
          </button>

          <!-- Settings Trigger (Available on all screens) -->
          <button 
            type="button" 
            class="header-btn settings-trigger-btn"
            @click="openSettings"
            :aria-label="t('settings')"
            :title="t('settings')"
          >
            <Settings :size="20" />
            <span class="btn-caption khmer-font">{{ t('settings') }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Workspace Content -->
    <main id="main-content" class="app-main-content" role="main">
      <h1 class="sr-only">{{ t('appName') }}</h1>
      <h2 class="sr-only">{{ activeMode === 'upload' ? t('navUpload') : activeMode === 'recent' ? t('navHistory') : activeMode === 'reader' ? t('navReader') : t('navScan') }}</h2>
      <router-view />
    </main>

    <!-- Tactile Accessible Bottom Navigation Bar (Hidden in dedicated Reader screen) -->
    <nav v-if="!isLoginScreen && activeMode !== 'reader'" class="bottom-nav-bar" :aria-label="t('navScan')">
      <div class="nav-bar-inner">
        <!-- Mode 1: Camera -->
        <button
          type="button"
          class="nav-tab-btn"
          :class="{ 'tab-active': activeMode === 'scan' }"
          @click="setMode('scan')"
          :aria-label="t('navScanAria')"
          :aria-current="activeMode === 'scan' ? 'page' : undefined"
        >
          <div class="tab-icon-wrap">
            <Camera :size="24" />
          </div>
          <span class="tab-label khmer-font">{{ t('navScan') }}</span>
        </button>

        <!-- Mode 2: Upload File / Sample Documents -->
        <button
          type="button"
          class="nav-tab-btn"
          :class="{ 'tab-active': activeMode === 'upload' }"
          @click="setMode('upload')"
          :aria-label="t('navUploadAria')"
          :aria-current="activeMode === 'upload' ? 'page' : undefined"
        >
          <div class="tab-icon-wrap">
            <Upload :size="24" />
          </div>
          <span class="tab-label khmer-font">{{ t('navUpload') }}</span>
        </button>

        <!-- Mode 3: Recent Reads / History -->
        <button
          type="button"
          class="nav-tab-btn"
          :class="{ 'tab-active': activeMode === 'recent' }"
          @click="setMode('recent')"
          :aria-label="t('navHistoryAria')"
          :aria-current="activeMode === 'recent' ? 'page' : undefined"
        >
          <div class="tab-icon-wrap">
            <History :size="24" />
          </div>
          <span class="tab-label khmer-font">{{ t('navHistory') }}</span>
        </button>
      </div>
    </nav>

    <!-- Comprehensive Accessibility Settings Modal / Sheet -->
    <div 
      v-if="isSettingsOpen" 
      class="settings-modal-backdrop" 
      v-focus-trap
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
            <h2 id="settings-dialog-title" class="modal-title khmer-font">{{ t('settingsTitle') }}</h2>
          </div>
          <button 
            type="button" 
            class="modal-close-btn" 
            @click="closeSettings" 
            :aria-label="t('closeSettings')"
            :title="t('closeSettings')"
          >
            <X :size="22" />
          </button>
        </div>

        <!-- Modal Category Tabs (3 Balanced Pillars) -->
        <div class="modal-nav-tabs" role="tablist" :aria-label="t('settingsTitle')">
          <button 
            type="button"
            role="tab" 
            class="tab-pill khmer-font" 
            :class="{ 'pill-active': activeSettingsTab === 'visual' }"
            :aria-selected="activeSettingsTab === 'visual'"
            @click="activeSettingsTab = 'visual'"
          >
            <Eye :size="16" />
            <span>{{ t('tabVisual') }}</span>
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
            <span>{{ t('tabAudio') }}</span>
          </button>
          <button 
            type="button"
            role="tab" 
            class="tab-pill khmer-font" 
            :class="{ 'pill-active': activeSettingsTab === 'system' }"
            :aria-selected="activeSettingsTab === 'system'"
            @click="activeSettingsTab = 'system'"
          >
            <Sliders :size="16" />
            <span>{{ t('tabSystem') }}</span>
          </button>
        </div>

        <!-- Tab 1: Visual Settings -->
        <div v-if="activeSettingsTab === 'visual'" class="tab-pane visual-pane">
          <!-- Group 1: Themes & Contrast -->
          <div class="settings-group">
            <h3 class="settings-group-header khmer-font">{{ t('groupThemes') }}</h3>
            <div class="settings-group-card">
              <div class="setting-row setting-row-stacked">
                <div class="setting-label-col">
                  <span class="setting-title khmer-font">{{ t('theme') }}</span>
                  <span class="setting-desc khmer-font">{{ t('themeDesc') }}</span>
                </div>
                <div class="theme-options-grid">
                  <button 
                    type="button" 
                    class="theme-card-option" 
                    :class="{ 'theme-selected': currentTheme === 'light' }"
                    @click="setTheme('light')"
                    :aria-label="t('themeLight')"
                  >
                    <Sun :size="20" class="text-sun" />
                    <span class="theme-name khmer-font">{{ t('themeLight') }}</span>
                  </button>

                  <button 
                    type="button" 
                    class="theme-card-option theme-contrast-card" 
                    :class="{ 'theme-selected': currentTheme === 'contrast' }"
                    @click="setTheme('contrast')"
                    :aria-label="t('themeContrast')"
                  >
                    <Contrast :size="20" class="text-contrast" />
                    <span class="theme-name khmer-font">{{ t('themeContrast') }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Group 2: Typography & Readability -->
          <div class="settings-group">
            <h3 class="settings-group-header khmer-font">{{ t('groupTypography') }}</h3>
            <div class="settings-group-card">
              <!-- Text Size Scaling -->
              <div class="setting-row">
                <div class="setting-label-col">
                  <span class="setting-title khmer-font">{{ t('fontSize') }}</span>
                  <span class="setting-desc khmer-font">{{ t('fontSizeDesc') }}</span>
                </div>
                <div class="scaler-controls" role="group" :aria-label="t('fontSize')">
                  <button 
                    type="button"
                    class="scale-btn" 
                    @click="changeFontScale(-0.1)" 
                    :disabled="fontScale <= 0.7"
                    :aria-label="t('decreaseFont')"
                  >
                    <ZoomOut :size="18" />
                    <span class="btn-lbl">A-</span>
                  </button>
                  <button 
                    type="button"
                    class="scale-indicator-btn" 
                    @click="resetFontScale" 
                    :title="t('resetFont')"
                    :aria-label="t('resetFont')"
                  >
                    <RotateCcw :size="14" />
                    <span>{{ Math.round(fontScale * 100) }}%</span>
                  </button>
                  <button 
                    type="button"
                    class="scale-btn" 
                    @click="changeFontScale(0.1)" 
                    :disabled="fontScale >= 2.0"
                    :aria-label="t('increaseFont')"
                  >
                    <ZoomIn :size="18" />
                    <span class="btn-lbl">A+</span>
                  </button>
                </div>
              </div>

              <!-- Bold Typography Toggle -->
              <div class="setting-row">
                <div class="setting-label-col">
                  <span class="setting-title khmer-font">{{ t('boldText') }}</span>
                  <span class="setting-desc khmer-font">{{ t('boldTextDesc') }}</span>
                </div>
                <button 
                  type="button"
                  class="accessible-switch" 
                  :class="{ 'switch-on': isBoldText }"
                  @click="toggleBoldText"
                  :aria-checked="isBoldText"
                  role="switch"
                  :aria-label="t('boldText')"
                >
                  <span class="switch-thumb"></span>
                </button>
              </div>

              <!-- Line Height / Spacing -->
              <div class="setting-row">
                <div class="setting-label-col">
                  <span class="setting-title khmer-font">{{ t('lineSpacing') }}</span>
                  <span class="setting-desc khmer-font">{{ t('lineSpacingDesc') }}</span>
                </div>
                <div class="segment-buttons" role="group" :aria-label="t('lineSpacing')">
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
          </div>
        </div>

        <!-- Tab 2: Audio & Guidance Settings -->
        <div v-if="activeSettingsTab === 'audio'" class="tab-pane audio-pane">
          <!-- Group 1: Screen Reader & Guidance -->
          <div class="settings-group">
            <h3 class="settings-group-header khmer-font">{{ t('groupScreenReader') }}</h3>
            <div class="settings-group-card">
              <!-- UI Spoken Guidance Toggle -->
              <div class="setting-row">
                <div class="setting-label-col">
                  <span class="setting-title khmer-font">{{ t('voiceGuidance') }} ({{ osScreenReaderName }})</span>
                  <span class="setting-desc khmer-font">
                    {{ currentLang === 'km' 
                      ? `អានឈ្មោះប៊ូតុង និងស្ថានភាព (សម្រាប់អ្នកដែលមិនបានបើក ${osScreenReaderName} លើទូរស័ព្ទ)`
                      : `Read control titles and status aloud (for users without OS ${osScreenReaderName}).` 
                    }}
                  </span>
                </div>
                <button 
                  type="button" 
                  class="accessible-switch" 
                  :class="{ 'switch-on': isUiVoiceEnabled }"
                  @click="toggleUiVoice"
                  :aria-checked="isUiVoiceEnabled"
                  role="switch"
                  :aria-label="`${t('voiceGuidance')} In-App ${osScreenReaderName}`"
                >
                  <span class="switch-thumb"></span>
                </button>
              </div>

              <!-- Explore by touch -->
              <div class="setting-row" :class="{ 'row-dimmed': !isUiVoiceEnabled }">
                <div class="setting-label-col">
                  <span class="setting-title khmer-font">{{ t('exploreByTouchTitle') }} ({{ osScreenReaderName }})</span>
                  <span class="setting-desc khmer-font">{{ t('exploreByTouchDesc') }}</span>
                </div>
                <button
                  type="button"
                  class="accessible-switch"
                  :class="{ 'switch-on': isExploreEnabled }"
                  @click="toggleExplore"
                  :aria-checked="isExploreEnabled"
                  :disabled="!isUiVoiceEnabled"
                  role="switch"
                  :aria-label="t('exploreByTouchTitle')"
                >
                  <span class="switch-thumb"></span>
                </button>
              </div>

              <!-- Guidance voice speed -->
              <div class="setting-row">
                <div class="setting-label-col">
                  <span class="setting-title khmer-font">{{ t('guidanceSpeedTitle') }}</span>
                  <span class="setting-desc khmer-font">{{ t('guidanceSpeedDesc') }}</span>
                </div>
                <div class="segment-buttons" role="group" :aria-label="t('guidanceSpeedTitle')">
                  <button
                    v-for="r in [1, 1.25, 1.5, 2]"
                    :key="r"
                    type="button"
                    class="segment-btn"
                    :class="{ 'segment-active': voiceRate === r }"
                    @click="setVoiceRate(r)"
                  >{{ r }}x</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Group 2: Document Reading & Automation -->
          <div class="settings-group">
            <h3 class="settings-group-header khmer-font">{{ t('groupAutomation') }}</h3>
            <div class="settings-group-card">
              <!-- Auto Read After Scan -->
              <div class="setting-row">
                <div class="setting-label-col">
                  <span class="setting-title khmer-font">{{ t('autoRead') }}</span>
                  <span class="setting-desc khmer-font">{{ t('autoReadDesc') }}</span>
                </div>
                <button 
                  type="button" 
                  class="accessible-switch" 
                  :class="{ 'switch-on': isAutoReadEnabled }"
                  @click="toggleAutoRead"
                  :aria-checked="isAutoReadEnabled"
                  role="switch"
                  :aria-label="t('autoRead')"
                >
                  <span class="switch-thumb"></span>
                </button>
              </div>

              <!-- Hands-Free Voice Commands -->
              <div class="setting-row">
                <div class="setting-label-col">
                  <span class="setting-title khmer-font">{{ t('voiceCommandsTitle') }}</span>
                  <span class="setting-desc khmer-font">{{ t('voiceCommandsDesc') }}</span>
                </div>
                <button 
                  type="button" 
                  class="accessible-switch" 
                  :class="{ 'switch-on': isVoiceListening }"
                  @click="toggleVoiceListening"
                  :aria-checked="isVoiceListening"
                  role="switch"
                  :aria-label="t('toggleVoiceCommands')"
                >
                  <span class="switch-thumb"></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: System, Tools & OCR Settings -->
        <div v-if="activeSettingsTab === 'system'" class="tab-pane system-pane">
          <!-- Group 1: Tactile & Guidance Tour -->
          <div class="settings-group">
            <h3 class="settings-group-header khmer-font">{{ t('groupTactile') }}</h3>
            <div class="settings-group-card">
              <!-- Haptic Vibrations -->
              <div class="setting-row">
                <div class="setting-label-col">
                  <span class="setting-title khmer-font">{{ t('haptics') }}</span>
                  <span class="setting-desc khmer-font">{{ haptics.isSupported() ? t('hapticsDesc') : t('hapticsUnsupported') }}</span>
                </div>
                <button 
                  type="button" 
                  class="accessible-switch" 
                  :class="{ 'switch-on': isHapticsEnabled }"
                  @click="toggleHaptics"
                  :aria-checked="isHapticsEnabled"
                  role="switch"
                  :aria-label="t('haptics')"
                >
                  <span class="switch-thumb"></span>
                </button>
              </div>

              <!-- Replay Guided Tour Button -->
              <div class="setting-row">
                <div class="setting-label-col">
                  <span class="setting-title khmer-font">{{ t('interactiveTourTitle') }}</span>
                  <span class="setting-desc khmer-font">{{ t('interactiveTourDesc') }}</span>
                </div>
                <button 
                  type="button"
                  class="btn btn-secondary khmer-font" 
                  @click="isSettingsOpen = false; openGuidelines()"
                  style="min-height: 38px; padding: 0 14px; border-radius: var(--radius-sm); gap: 6px; display: inline-flex; align-items: center;"
                  :aria-label="t('interactiveTourTitle')"
                >
                  <HelpCircle :size="16" />
                  <span>{{ t('replayTourBtn') }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Group 2: Document Storage & Cache Management -->
          <div class="settings-group">
            <h3 class="settings-group-header khmer-font">{{ t('groupStorage') }}</h3>
            <div class="settings-group-card">
              <div class="setting-row">
                <div class="setting-label-col">
                  <span class="setting-title khmer-font">{{ t('clearCacheTitle') }}</span>
                  <span class="setting-desc khmer-font">{{ t('clearCacheDesc') }}</span>
                </div>
                <button 
                  type="button" 
                  class="btn btn-secondary khmer-font" 
                  @click="handleClearCache"
                  style="min-height: 38px; padding: 0 14px; border-radius: var(--radius-sm);"
                  :aria-label="t('clearCacheAria')"
                >
                  <RotateCcw :size="16" />
                  <span>{{ t('clearCacheBtn') }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Group 3: Keyboard Shortcuts Table -->
          <div class="settings-group">
            <h3 class="settings-group-header khmer-font">{{ t('groupShortcuts') }}</h3>
            <div class="shortcuts-card">
              <ul class="shortcuts-list khmer-font">
                <li>
                  <span class="key-combo"><kbd>Space</kbd></span>
                  <span class="key-desc">{{ t('spaceKeyDesc') }}</span>
                </li>
                <li>
                  <span class="key-combo"><kbd>Ctrl</kbd> + <kbd>Enter</kbd></span>
                  <span class="key-desc">{{ t('ctrlEnterKeyDesc') }}</span>
                </li>
                <li>
                  <span class="key-combo"><kbd>Esc</kbd></span>
                  <span class="key-desc">{{ t('escKeyDesc') }}</span>
                </li>
                <li>
                  <span class="key-combo"><kbd>Alt</kbd> + <kbd>A</kbd></span>
                  <span class="key-desc">{{ t('altAKeyDesc') }}</span>
                </li>
                <li>
                  <span class="key-combo"><kbd>Alt</kbd> + <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd></span>
                  <span class="key-desc">{{ t('alt14KeyDesc') }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Group 4: DEVELOPER ONLY (Visible only when unlocked via Alt+D or 5 taps on Logo) -->
          <div v-if="isDevMode" class="settings-group dev-mode-group">
            <div class="dev-header-badge-row">
              <h3 class="settings-group-header khmer-font dev-header-title">
                <Code :size="14" />
                <span>{{ t('devOptionsHeader') }}</span>
              </h3>
              <button 
                type="button" 
                class="btn-exit-dev khmer-font"
                @click="toggleDevMode(false)"
                :title="t('exitDevBtn')"
              >
                {{ t('exitDevBtn') }}
              </button>
            </div>

            <!-- Dev Item 1: OCR Recognition Engine -->
            <div class="settings-group-card dev-card">
              <div class="setting-row setting-row-stacked">
                <div class="setting-label-col">
                  <span class="setting-title khmer-font">{{ t('ocrEngineTitle') }}</span>
                  <span class="setting-desc khmer-font">{{ t('ocrEngineDesc') }}</span>
                </div>
                <div class="ocr-engine-options">
                  <label class="engine-radio-card" :class="{ 'engine-selected': ocrEngine === 'tesseract' }">
                    <input type="radio" v-model="ocrEngine" value="tesseract" @change="saveOcrConfig" class="sr-only" />
                    <div class="engine-info">
                      <span class="engine-badge badge-free khmer-font">{{ t('engineBadgeDefault') }}</span>
                      <strong class="engine-name khmer-font">{{ t('engineTesseractTitle') }}</strong>
                      <span class="engine-desc khmer-font">{{ t('engineTesseractDesc') }}</span>
                    </div>
                  </label>

                  <label class="engine-radio-card" :class="{ 'engine-selected': ocrEngine === 'google-vision' }">
                    <input type="radio" v-model="ocrEngine" value="google-vision" @change="saveOcrConfig" class="sr-only" />
                    <div class="engine-info">
                      <span class="engine-badge badge-cloud">{{ t('engineBadgeCloud') }}</span>
                      <strong class="engine-name khmer-font">{{ t('engineGoogleVisionTitle') }}</strong>
                      <span class="engine-desc khmer-font">{{ t('engineGoogleVisionDesc') }}</span>
                    </div>
                  </label>

                  <label class="engine-radio-card" :class="{ 'engine-selected': ocrEngine === 'azure-read' }">
                    <input type="radio" v-model="ocrEngine" value="azure-read" @change="saveOcrConfig" class="sr-only" />
                    <div class="engine-info">
                      <span class="engine-badge badge-cloud">{{ t('engineBadgeCloud') }}</span>
                      <strong class="engine-name khmer-font">{{ t('engineAzureTitle') }}</strong>
                      <span class="engine-desc khmer-font">{{ t('engineAzureDesc') }}</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <!-- Dev Item 2: Cloud API Credentials -->
            <div class="settings-group-card dev-card">
              <div class="setting-row setting-row-stacked">
                <div class="setting-label-col">
                  <span class="setting-title khmer-font">{{ t('customApiTitle') }}</span>
                  <span class="setting-desc khmer-font">{{ t('customApiDesc') }}</span>
                </div>
                <div class="api-fields-group">
                  <input 
                    v-if="ocrEngine === 'google-vision'"
                    type="password" 
                    v-model="googleApiKey" 
                    @blur="saveOcrConfig"
                    placeholder="Google Vision API Key (AIza...)" 
                    class="settings-api-input khmer-font" 
                    aria-label="Google Vision API Key"
                  />
                  <input 
                    v-if="ocrEngine === 'azure-read'"
                    type="password" 
                    v-model="azureVisionKey" 
                    @blur="saveOcrConfig"
                    placeholder="Azure Computer Vision Key" 
                    class="settings-api-input khmer-font" 
                    aria-label="Azure Computer Vision Key"
                  />
                  <input 
                    v-if="ocrEngine === 'azure-read'"
                    type="text" 
                    v-model="azureVisionEndpoint" 
                    @blur="saveOcrConfig"
                    placeholder="Azure Vision Endpoint URL" 
                    class="settings-api-input khmer-font" 
                    aria-label="Azure Vision Endpoint URL"
                  />
                  <input 
                    type="password" 
                    v-model="azureTtsKey" 
                    @blur="saveOcrConfig"
                    :placeholder="t('azureTtsKeyPlaceholder')" 
                    class="settings-api-input khmer-font" 
                    aria-label="Azure TTS Subscription Key"
                  />
                  <input 
                    type="text" 
                    v-model="azureTtsEndpoint" 
                    @blur="saveOcrConfig"
                    :placeholder="t('azureTtsEndpointPlaceholder')" 
                    class="settings-api-input khmer-font" 
                    aria-label="Azure TTS Endpoint URL"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer: Accessible Done Button -->
        <div class="modal-footer">
          <button 
            type="button" 
            class="btn btn-primary btn-save-modal khmer-font" 
            @click="closeSettings"
            :aria-label="t('doneBtn')"
          >
            <Check :size="18" />
            <span>{{ t('doneBtn') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Help / How to Use Modal -->
    <HelpModal v-if="isHelpOpen" @close="closeHelp" @start-tour="openGuidelines" />

    <!-- Feature Guidelines Walkthrough -->
    <FeatureGuidelines :is-open="isGuidelinesOpen" @close="closeGuidelines" />

    <!-- First-Open Welcome & Mission Overlay -->
    <WelcomeOverlay 
      :is-open="isWelcomeOpen" 
      @start-tutorial="handleStartTutorialFromWelcome" 
      @skip-tutorial="handleSkipTutorialFromWelcome" 
      @close="isWelcomeOpen = false"
    />
  </div>
</template>

<style src="./App.css"></style>
