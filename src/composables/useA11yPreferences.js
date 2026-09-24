/**
 * Accessibility Preferences Composable

 */

import { ref } from 'vue'
import { storage, STORAGE_KEYS } from '../services/storage'
import { haptics } from '../services/haptics'
import { announcer } from '../services/announcer'
import { currentLang, t } from '../services/i18n'

export function useA11yPreferences() {
  const currentTheme = ref('light')
  const fontScale = ref(1.0)
  const lineSpacing = ref(1.85)
  const isBoldText = ref(false)

  const isUiVoiceEnabled = ref(false)
  const isAutoReadEnabled = ref(true)
  const isHapticsEnabled = ref(true)

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
   * Change font size scale
   * @param {number} delta
   */
  const changeFontScale = (delta) => {
    let next = Math.round((fontScale.value + delta) * 100) / 100
    if (next < 0.9) next = 0.9
    if (next > 1.6) next = 1.6
    fontScale.value = next

    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--font-scale', next)
    }
    storage.setItem(STORAGE_KEYS.FONT_SCALE, next)
    haptics.pulse('tap')
    announcer.speak(`${t('fontSize')} ${Math.round(next * 100)}%`)
  }

  const resetFontScale = () => {
    fontScale.value = 1.0
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--font-scale', 1.0)
    }
    storage.setItem(STORAGE_KEYS.FONT_SCALE, 1.0)
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
    isUiVoiceEnabled.value = !isUiVoiceEnabled.value
    storage.setItem(STORAGE_KEYS.VOICE, isUiVoiceEnabled.value)
    announcer.setVoiceEnabled(isUiVoiceEnabled.value)
    haptics.pulse('shutter')
    if (isUiVoiceEnabled.value) {
      announcer.speak(currentLang.value === 'km' ? 'បានបើកសំឡេងជំនួយបញ្ជា' : 'Voice guidance enabled')
    }
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

    const savedScale = parseFloat(storage.getItem(STORAGE_KEYS.FONT_SCALE, '1.0'))
    if (!isNaN(savedScale)) {
      fontScale.value = savedScale
      document.documentElement.style.setProperty('--font-scale', savedScale)
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

    isUiVoiceEnabled.value = storage.getItem(STORAGE_KEYS.VOICE, 'false') === 'true'
    announcer.setVoiceEnabled(isUiVoiceEnabled.value)

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
  }
}
