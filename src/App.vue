<script setup>
import { ref, computed, onMounted, onBeforeUnmount, provide, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { 
  Settings, Volume2, VolumeX, Moon, Sun, Contrast, 
  ZoomIn, ZoomOut, RotateCcw, X, Sliders, Eye, Headphones, 
  Keyboard, Sparkles, Camera, Upload, BookOpen, History, Check, HelpCircle, Languages
} from 'lucide-vue-next'
import HelpModal from './components/HelpModal.vue'
import { currentLang, toggleLang, t } from './services/i18n'
import { haptics } from './services/haptics'
import { announcer } from './services/announcer'
import { useA11yPreferences } from './composables/useA11yPreferences'

const route = useRoute()
const isLoginScreen = computed(() => !route?.name || route.name === 'login' || route.path === '/')

// Accessibility & UI Preferences Composable (SOLID: SRP)
const {
  currentTheme,
  fontScale,
  lineSpacing,
  isBoldText,
  isUiVoiceEnabled,
  isAutoReadEnabled,
  isHapticsEnabled,
  setTheme,
  changeFontScale,
  resetFontScale,
  toggleBoldText,
  setLineSpacing,
  toggleUiVoice,
  toggleAutoRead,
  toggleHaptics,
  initPreferences
} = useA11yPreferences()

// Active Assistant Mode: 'scan' | 'upload' | 'reader' | 'recent'
const activeMode = ref('scan')
const isSettingsOpen = ref(false)
const activeSettingsTab = ref('visual') // 'visual' | 'audio' | 'interaction'

// Spoken status for screen reader and live status banner
const spokenStatusText = ref(t('spokenStatusReady'))

// Screen reader and audible guidance bridge
const speakAccessibility = (text, interrupt = true) => {
  spokenStatusText.value = text
  announcer.speak(text, interrupt)
}

const triggerHaptic = (pattern = 'selection') => {
  haptics.pulse(pattern)
}

// --- Mode Switching ---
const setMode = (mode) => {
  activeMode.value = mode
  haptics.pulse('selection')
  const modeNames = {
    scan: t('navScan'),
    upload: t('navUpload'),
    reader: t('navReader'),
    recent: t('navHistory')
  }
  speakAccessibility(modeNames[mode] || mode)
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
provide('currentLang', currentLang)
provide('toggleLang', toggleLang)
provide('t', t)

onMounted(() => {
  initPreferences()

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
    <a href="#main-content" class="skip-to-content khmer-font">{{ t('skipToContent') }}</a>

    <!-- Top Accessible Header (Clean, Permanent, Tactile Accessible Navigation) -->
    <header 
      v-if="!isLoginScreen" 
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

          <!-- Voice Toggle Quick Button (Desktop / Tablet only) -->
          <button 
            type="button" 
            class="header-btn voice-btn desktop-only"
            :class="{ 'active-voice': isUiVoiceEnabled }"
            @click="toggleUiVoice"
            :aria-label="isUiVoiceEnabled ? t('voiceGuidance') + ': ON' : t('voiceGuidance') + ': OFF'"
            :title="t('voiceGuidance')"
          >
            <Volume2 v-if="isUiVoiceEnabled" :size="20" />
            <VolumeX v-else :size="20" />
            <span class="btn-caption khmer-font">{{ isUiVoiceEnabled ? t('voiceGuidance') + ': ON' : t('voiceGuidance') + ': OFF' }}</span>
          </button>

          <!-- Help / How to Use Trigger (Desktop / Tablet only) -->
          <button 
            type="button" 
            class="header-btn help-trigger-btn desktop-only"
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
      <router-view />
    </main>

    <!-- Tactile Accessible Bottom Navigation Bar (SURFACES.md: Tonal fill + bold + 3px indicator + aria-current) -->
    <nav v-if="!isLoginScreen" class="bottom-nav-bar" :aria-label="t('navScan')">
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
          <span v-if="activeMode === 'scan'" class="nav-indicator-bar" aria-hidden="true"></span>
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
          <span v-if="activeMode === 'upload'" class="nav-indicator-bar" aria-hidden="true"></span>
          <div class="tab-icon-wrap">
            <Upload :size="24" />
          </div>
          <span class="tab-label khmer-font">{{ t('navUpload') }}</span>
        </button>

        <!-- Mode 3: Document Reader -->
        <button
          type="button"
          class="nav-tab-btn"
          :class="{ 'tab-active': activeMode === 'reader' }"
          @click="setMode('reader')"
          :aria-label="t('navReaderAria')"
          :aria-current="activeMode === 'reader' ? 'page' : undefined"
        >
          <span v-if="activeMode === 'reader'" class="nav-indicator-bar" aria-hidden="true"></span>
          <div class="tab-icon-wrap">
            <BookOpen :size="24" />
          </div>
          <span class="tab-label khmer-font">{{ t('navReader') }}</span>
        </button>

        <!-- Mode 4: Recent Reads -->
        <button
          type="button"
          class="nav-tab-btn"
          :class="{ 'tab-active': activeMode === 'recent' }"
          @click="setMode('recent')"
          :aria-label="t('navHistoryAria')"
          :aria-current="activeMode === 'recent' ? 'page' : undefined"
        >
          <span v-if="activeMode === 'recent'" class="nav-indicator-bar" aria-hidden="true"></span>
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

        <!-- Modal Category Tabs -->
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
            :class="{ 'pill-active': activeSettingsTab === 'interaction' }"
            :aria-selected="activeSettingsTab === 'interaction'"
            @click="activeSettingsTab = 'interaction'"
          >
            <Keyboard :size="16" />
            <span>{{ t('tabInteraction') }}</span>
          </button>
        </div>

        <!-- Tab 1: Visual Settings -->
        <div v-if="activeSettingsTab === 'visual'" class="tab-pane visual-pane">
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
                :disabled="fontScale <= 0.9"
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
                :disabled="fontScale >= 1.6"
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

              <button 
                type="button" 
                class="theme-card-option" 
                :class="{ 'theme-selected': currentTheme === 'dark' }"
                @click="setTheme('dark')"
                :aria-label="t('themeDark')"
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
              <span class="setting-title khmer-font">{{ t('voiceGuidance') }}</span>
              <span class="setting-desc khmer-font">{{ t('voiceGuidanceDesc') }}</span>
            </div>
            <button 
              type="button" 
              class="accessible-switch" 
              :class="{ 'switch-on': isUiVoiceEnabled }"
              @click="toggleUiVoice"
              :aria-checked="isUiVoiceEnabled"
              role="switch"
              :aria-label="t('voiceGuidance')"
            >
              <span class="switch-thumb"></span>
            </button>
          </div>

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
        </div>

        <!-- Tab 3: Interaction & Shortcuts -->
        <div v-if="activeSettingsTab === 'interaction'" class="tab-pane shortcuts-pane">
          <!-- Haptic Vibrations -->
          <div class="setting-item">
            <div class="setting-label-col">
              <span class="setting-title khmer-font">{{ t('haptics') }}</span>
              <span class="setting-desc khmer-font">{{ t('hapticsDesc') }}</span>
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

          <!-- Keyboard Shortcuts Table -->
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

        <!-- Modal Footer -->
        <div class="modal-footer">
          <button 
            type="button" 
            class="btn btn-primary btn-save-modal khmer-font" 
            @click="closeSettings"
            :aria-label="t('closeSettings')"
          >
            <Check :size="18" />
            <span>{{ t('closeSettings') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Help / How to Use Modal -->
    <HelpModal v-if="isHelpOpen" @close="closeHelp" />
  </div>
</template>

<style src="./App.css"></style>
