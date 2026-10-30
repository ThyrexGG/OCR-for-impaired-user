/**
 * Accessibility Preferences Composable

 */

import { ref } from 'vue'
import { storage, STORAGE_KEYS } from '../services/storage'
import { haptics } from '../services/haptics'
import { announcer } from '../services/announcer'
import { currentLang, t } from '../services/i18n'
import { tp } from '../services/talkback'

// Singleton state shared across all components and navigation views
const currentTheme = ref('light')
const fontScale = ref(1.0)
const lineSpacing = ref(1.85)
const isBoldText = ref(false)

// In-app talk-back is OFF by default so songKHEM functions as a normal app unless the user
// explicitly turns it on, or uses their device's native TalkBack (Android) / VoiceOver (iOS).
// Same as the app: the in-app talk-back and explore-by-touch are hidden for now and kept off whatever an
// older version saved; the system screen reader (TalkBack / VoiceOver / NVDA) does that job. true brings them back.
const IN_APP_TALKBACK = false

const isUiVoiceEnabled = ref(false)
const isExploreEnabled = ref(false)
const voiceRate = ref(1)
const isAutoReadEnabled = ref(true)
const isHapticsEnabled = ref(true)

/**
 * Detect OS screen reader naming convention: VoiceOver on Apple devices, TalkBack on Android
 */
export function getOsScreenReaderName() {
  if (typeof navigator === 'undefined') return 'TalkBack / VoiceOver'
  const ua = navigator.userAgent || ''
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isMac = /Macintosh|Mac OS X/.test(ua) && !isIOS
  return isIOS || isMac ? 'VoiceOver' : 'TalkBack'
}

export function useA11yPreferences() {
  /**
   * Set and apply color theme silently without polluting screen text
   * @param {'light'|'dark'|'contrast'} theme
   */
  const setTheme = (theme) => {
    currentTheme.value = theme
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }
    storage.setItem(STORAGE_KEYS.THEME, theme)
    haptics.pulse('selection')
  }

  /**
   * Change font size scale (range: 0.7x to 2.0x, in 0.1 increments)
   * @param {number} delta
   */
  const changeFontScale = (delta) => {
    let current = Number(fontScale.value) || 1.0
    let next = Math.round((current + delta) * 10) / 10
    if (next < 0.7) next = 0.7
    if (next > 2.0) next = 2.0
    fontScale.value = next

    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--font-scale', String(next))
      document.documentElement.style.fontSize = `${Math.round(next * 100)}%`
    }
    storage.setItem(STORAGE_KEYS.FONT_SCALE, String(next))
    haptics.pulse('tap')
    announcer.speak(`${t('fontSize')} ${Math.round(next * 100)}%`)
  }

  const resetFontScale = () => {
    fontScale.value = 1.0
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--font-scale', '1')
      document.documentElement.style.fontSize = '100%'
    }
    storage.setItem(STORAGE_KEYS.FONT_SCALE, '1.0')
    haptics.pulse('selection')
    announcer.speak(t('resetFont'))
  }

  /**
   * Toggle bold text
   */
  const toggleBoldText = () => {
    isBoldText.value = !isBoldText.value
    if (typeof document !== 'undefined') {
      if (isBoldText.value) {
        document.body.classList.add('bold-text')
      } else {
        document.body.classList.remove('bold-text')
      }
    }
    storage.setItem(STORAGE_KEYS.BOLD, isBoldText.value)
    haptics.pulse('tap')
    announcer.speak(isBoldText.value ? 'បានបើកអក្សរដិតច្បាស់' : 'បានបិទអក្សរដិត')
  }

  /**
   * Set reading line spacing
   * @param {number} val
   */
  const setLineSpacing = (val) => {
    lineSpacing.value = val
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--leading-reading', val)
    }
    storage.setItem(STORAGE_KEYS.LINE_SPACING, val)
    haptics.pulse('tap')
    announcer.speak(`${t('lineSpacing')} ${val}`)
  }

  /**
   * Toggle self-contained audible guidance
   */
  const toggleUiVoice = () => {
    const next = !isUiVoiceEnabled.value
    haptics.pulse('shutter')
    if (next) {
      isUiVoiceEnabled.value = true
      announcer.setVoiceEnabled(true)
      announcer.speak(tp('voiceOn'))
    } else {
      // Say it before going quiet, otherwise nobody learns that it worked
      announcer.speak(tp('voiceOff'))
      isUiVoiceEnabled.value = false
      // Let the sentence finish before the engine is switched off
      setTimeout(() => !isUiVoiceEnabled.value && announcer.setVoiceEnabled(false), 1800)
    }
    storage.setItem(STORAGE_KEYS.VOICE, isUiVoiceEnabled.value)
  }

  const toggleExplore = () => {
    isExploreEnabled.value = !isExploreEnabled.value
    storage.setItem(STORAGE_KEYS.EXPLORE, isExploreEnabled.value)
    haptics.pulse('tap')
    announcer.speak(tp(isExploreEnabled.value ? 'exploreOn' : 'exploreOff'))
  }

  const setVoiceRate = (value) => {
    voiceRate.value = value
    announcer.setRate(value)
    storage.setItem(STORAGE_KEYS.VOICE_RATE, String(value))
    haptics.pulse('tap')
    announcer.speak(tp('exploreOn'))
  }

  /**
   * Toggle auto-read after scan
   */
  const toggleAutoRead = () => {
    isAutoReadEnabled.value = !isAutoReadEnabled.value
    storage.setItem(STORAGE_KEYS.AUTO_READ, isAutoReadEnabled.value)
    haptics.pulse('tap')
    announcer.speak(isAutoReadEnabled.value ? 'បានបើកការអានដោយស្វ័យប្រវត្តិពេលស្កេនរួច' : 'បានបិទការអានស្វ័យប្រវត្តិ')
  }

  /**
   * Toggle haptic vibration
   */
  const toggleHaptics = () => {
    isHapticsEnabled.value = !isHapticsEnabled.value
    storage.setItem(STORAGE_KEYS.HAPTICS, isHapticsEnabled.value)
    haptics.setEnabled(isHapticsEnabled.value)
    haptics.pulse('warning')
    announcer.speak(isHapticsEnabled.value ? 'បានបើកការញ័រផ្តល់ដំណឹង' : 'បានបិទការញ័រ')
  }

  /**
   * Load saved preferences from storage
   */
  const initPreferences = () => {
    let savedTheme = storage.getItem(STORAGE_KEYS.THEME, 'light')
    if (!savedTheme || savedTheme === 'dark') savedTheme = 'light'
    setTheme(savedTheme)

    const rawSavedScale = storage.getItem(STORAGE_KEYS.FONT_SCALE, '1.0')
    let savedScale = parseFloat(rawSavedScale)
    if (isNaN(savedScale) || savedScale < 0.7 || savedScale > 2.0) {
      savedScale = 1.0
    }
    fontScale.value = savedScale
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--font-scale', String(savedScale))
      document.documentElement.style.fontSize = `${Math.round(savedScale * 100)}%`
    }

    const savedSpacing = parseFloat(storage.getItem(STORAGE_KEYS.LINE_SPACING, '1.85'))
    if (!isNaN(savedSpacing)) {
      lineSpacing.value = savedSpacing
      document.documentElement.style.setProperty('--leading-reading', savedSpacing)
    }

    const savedBold = storage.getItem(STORAGE_KEYS.BOLD, 'false') === 'true'
    if (savedBold) {
      isBoldText.value = true
      document.body.classList.add('bold-text')
    }

    // One-time migration: default to false so songKHEM runs as a normal app unless user enables in-app talkback
    if (!storage.getItem('songkhem_voice_default_v3')) {
      storage.removeItem(STORAGE_KEYS.VOICE)
      storage.removeItem(STORAGE_KEYS.EXPLORE)
      storage.setItem('songkhem_voice_default_v3', '1')
    }

    isUiVoiceEnabled.value = IN_APP_TALKBACK && storage.getItem(STORAGE_KEYS.VOICE, 'false') === 'true'
    announcer.setVoiceEnabled(isUiVoiceEnabled.value)
    isExploreEnabled.value = IN_APP_TALKBACK && storage.getItem(STORAGE_KEYS.EXPLORE, 'false') === 'true'
    const savedRate = parseFloat(storage.getItem(STORAGE_KEYS.VOICE_RATE, '1'))
    voiceRate.value = savedRate >= 0.75 && savedRate <= 2.5 ? savedRate : 1
    announcer.setRate(voiceRate.value)

    isAutoReadEnabled.value = storage.getItem(STORAGE_KEYS.AUTO_READ, 'true') !== 'false'
    isHapticsEnabled.value = storage.getItem(STORAGE_KEYS.HAPTICS, 'true') !== 'false'
    haptics.setEnabled(isHapticsEnabled.value)
  }

  return {
    currentTheme,
    fontScale,
    lineSpacing,
    isBoldText,
    isUiVoiceEnabled,
    isExploreEnabled,
    voiceRate,
    isAutoReadEnabled,
    isHapticsEnabled,
    osScreenReaderName: getOsScreenReaderName(),
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
  }
}
