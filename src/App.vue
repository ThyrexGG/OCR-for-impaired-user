<script setup>
import { ref, computed, onMounted, onBeforeUnmount, provide, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { 
  Settings, Moon, Sun, Contrast, 
  ZoomIn, ZoomOut, RotateCcw, X, Sliders, Eye, Headphones, 
  Keyboard, Sparkles, Camera, Upload, BookOpen, History, Check, HelpCircle, Languages,
  Mic, MicOff, Vibrate
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
import { isAppVoiceOnly, setAppVoiceOnly } from './services/tts'
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

// --- Testing switch: speak only in songKHEM's voice, never the browser's / phone's ---
const appVoiceOnly = ref(isAppVoiceOnly())
const toggleAppVoiceOnly = () => {
  appVoiceOnly.value = !appVoiceOnly.value
  setAppVoiceOnly(appVoiceOnly.value)
  haptics.pulse('tap')
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

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Alt + A: Toggle Accessibility Settings
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault()
      if (isSettingsOpen.value) closeSettings()
      else openSettings()
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
          <router-link to="/home" class="brand-link" :aria-label="t('appName')">
            <div class="brand-logo-gem">
              <span class="pulse-dot" aria-hidden="true"></span>
              <img src="/logo.png" alt="songKHEM Logo" class="brand-img" />
            </div>
            <div class="brand-titles">
              <span class="brand-name">{{ t('appName') }}</span>
              <span class="brand-caption khmer-font">{{ t('brandSub') }}</span>
            </div>
          </router-link>
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

        <!-- Same as the app: one scrolling page in three sections (no tabs), so a screen reader
             swipes through every setting in order. Engines, keys, cache and talk-back are hidden. -->
        <div class="tab-pane settings-scroll">
          <h3 class="settings-section-header khmer-font">
            <Eye :size="18" />
            <span>{{ currentLang === 'km' ? 'ការមើលឃើញ' : 'Display' }}</span>
          </h3>

          <!-- Text Size Scaling -->
          <div class="setting-item">
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

          <!-- Contrast Themes -->
          <div class="setting-item">
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
                :aria-pressed="currentTheme === 'light'"
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
                :aria-pressed="currentTheme === 'contrast'"
              >
                <Contrast :size="20" class="text-contrast" />
                <span class="theme-name khmer-font">{{ t('themeContrast') }}</span>
              </button>

              <button
                type="button"
                class="theme-card-option"
                :class="{ 'theme-selected': currentTheme === 'dark' }"
                @click="setTheme('dark')"
                :aria-label="t('themeDark')"
                :aria-pressed="currentTheme === 'dark'"
              >
                <Moon :size="20" class="text-accent" />
                <span class="theme-name khmer-font">{{ t('themeDark') }}</span>
              </button>
            </div>
          </div>

          <!-- Bold Typography Toggle -->
          <div class="setting-item">
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
          <div class="setting-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">{{ t('lineSpacing') }}</span>
              <span class="setting-desc khmer-font">{{ t('lineSpacingDesc') }}</span>
            </div>
            <div class="segment-buttons" role="group" :aria-label="t('lineSpacing')">
              <button
                v-for="ls in [1.6, 1.85, 2.1]"
                :key="ls"
                type="button"
                class="segment-btn"
                :class="{ 'segment-active': lineSpacing === ls }"
                :aria-pressed="lineSpacing === ls"
                @click="setLineSpacing(ls)"
              >{{ ls }}x</button>
            </div>
          </div>

          <h3 class="settings-section-header khmer-font">
            <Headphones :size="18" />
            <span>{{ currentLang === 'km' ? 'ការស្តាប់' : 'Listening' }}</span>
          </h3>

          <!-- Auto Read After Scan -->
          <div class="setting-item">
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

          <!-- songKHEM voice only -->
          <div class="setting-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">{{ currentLang === 'km' ? 'ប្រើតែសំឡេង songKHEM' : 'Use only the songKHEM voice' }}</span>
              <span class="setting-desc khmer-font">{{ currentLang === 'km' ? 'បើកពេលសំឡេងរបស់ទូរស័ព្ទ ឬកម្មវិធីរុករកមិនអានភាសាខ្មែរ ឬអានមិនត្រឹមត្រូវ។ គេហទំព័រនឹងនិយាយដោយសំឡេង songKHEM ជានិច្ច' : "Turn on when the phone's or browser's voice can't read Khmer properly. The site then always speaks in the songKHEM voice." }}</span>
            </div>
            <button
              type="button"
              class="accessible-switch"
              :class="{ 'switch-on': appVoiceOnly }"
              @click="toggleAppVoiceOnly"
              :aria-checked="appVoiceOnly"
              role="switch"
              :aria-label="currentLang === 'km' ? 'ប្រើតែសំឡេង songKHEM' : 'Use only the songKHEM voice'"
            >
              <span class="switch-thumb"></span>
            </button>
          </div>

          <!-- Guidance voice speed: only the songKHEM voice follows it -->
          <div v-if="appVoiceOnly" class="setting-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">{{ currentLang === 'km' ? 'ល្បឿនសំឡេងណែនាំ' : 'Guidance voice speed' }}</span>
              <span class="setting-desc khmer-font">{{ currentLang === 'km' ? 'ល្បឿននិយាយរបស់សំឡេងណែនាំ មិនប៉ះពាល់ល្បឿនអានឯកសារទេ' : 'How fast the guidance voice talks. Does not change the document reading speed' }}</span>
            </div>
            <div class="segment-buttons" role="group" :aria-label="currentLang === 'km' ? 'ល្បឿនសំឡេងណែនាំ' : 'Guidance voice speed'">
              <button
                v-for="r in [1, 1.25, 1.5, 2]"
                :key="r"
                type="button"
                class="segment-btn"
                :class="{ 'segment-active': voiceRate === r }"
                :aria-pressed="voiceRate === r"
                @click="setVoiceRate(r)"
              >{{ r }}x</button>
            </div>
          </div>

          <h3 class="settings-section-header khmer-font">
            <Vibrate :size="18" />
            <span>{{ currentLang === 'km' ? 'ការញ័រ' : 'Vibration' }}</span>
          </h3>

          <!-- Haptic Vibrations -->
          <div class="setting-item">
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

          <!-- Keyboard shortcuts: the website's extra for computer users (the app has no keyboard) -->
          <div class="shortcuts-card">
            <h3 class="shortcuts-card-title khmer-font">{{ t('keyboardShortcuts') }}</h3>
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
                <span class="key-combo"><kbd>Alt</kbd> + <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> / <kbd>4</kbd></span>
                <span class="key-desc">{{ t('alt14KeyDesc') }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Modal Footer: Accessible Done Button -->
        <div class="modal-footer">
          <button 
            type="button" 
            class="btn btn-primary btn-save-modal khmer-font" 
            @click="closeSettings"
            :aria-label="currentLang === 'km' ? 'រួចរាល់' : 'Done'"
          >
            <Check :size="18" />
            <span>{{ currentLang === 'km' ? 'រួចរាល់' : 'Done' }}</span>
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
