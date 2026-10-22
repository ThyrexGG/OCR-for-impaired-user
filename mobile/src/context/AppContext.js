import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import * as Speech from 'expo-speech'
import { AccessibilityInfo, Platform, Vibration } from 'react-native'

const STORAGE_KEYS = {
  voice: 'songkhem_voice',
  autoRead: 'songkhem_auto_read',
  haptics: 'songkhem_haptics',
  ocrProvider: 'songkhem_ocr_engine',
  googleApiKey: 'songkhem_google_api_key',
  googleEndpoint: 'songkhem_google_endpoint',
  azureVisionKey: 'songkhem_azure_vision_key',
  azureVisionEndpoint: 'songkhem_azure_vision_endpoint',
  azureTtsKey: 'songkhem_azure_tts_key',
  azureTtsEndpoint: 'songkhem_azure_tts_endpoint',
}

const EMPTY_OCR_CONFIG = {
  provider: '',
  googleApiKey: '',
  googleEndpoint: '',
  azureVisionKey: '',
  azureVisionEndpoint: '',
  azureTtsKey: '',
  azureTtsEndpoint: '',
}

// expo-haptics has no raw vibration-pattern API (navigator.vibrate([ms,...]) on
// the web). Call sites pass one of these intensity keys instead of a pattern.
const HAPTIC_MAP = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  selection: () => Haptics.selectionAsync(),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
}

// Android: drive the vibrator directly (VIBRATE permission is declared by expo-haptics).
// Many Android devices silently ignore the predefined-effect API expo-haptics uses for
// impacts, whereas a plain millisecond vibration always fires. Same patterns as the web
// app's haptics service (src/services/haptics.js). iOS keeps expo-haptics: RN's
// Vibration is a fixed ~400ms buzz there.
const ANDROID_PATTERNS = {
  light: [0, 20],
  medium: [0, 35],
  heavy: [0, 60],
  selection: [0, 15],
  success: [0, 80, 40, 100],
  warning: [0, 100, 50, 100],
  error: [0, 100, 60, 100],
}

let toastIdCounter = 0

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [isUiVoiceEnabled, setIsUiVoiceEnabled] = useState(false)
  const [isAutoReadEnabled, setIsAutoReadEnabled] = useState(true)
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true)
  const [spokenStatusText, setSpokenStatusText] = useState('ជំនួយការត្រៀមរួចជាស្រេច')
  const [toasts, setToasts] = useState([])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  // User-entered OCR/TTS API credentials (Settings > OCR tab), stored in
  // AsyncStorage since Expo can't edit its baked-in EXPO_PUBLIC_* env vars
  // post-build. Empty fields mean "use songKHEM's api/* proxy" (see
  // services/cloudApi.js); no provider key is ever baked into the build.
  const [ocrConfig, setOcrConfig] = useState(EMPTY_OCR_CONFIG)

  // Refs mirror state for use inside stable callbacks without re-creating them.
  const isHapticsEnabledRef = useRef(isHapticsEnabled)
  const isUiVoiceEnabledRef = useRef(isUiVoiceEnabled)
  useEffect(() => { isHapticsEnabledRef.current = isHapticsEnabled }, [isHapticsEnabled])
  useEffect(() => { isUiVoiceEnabledRef.current = isUiVoiceEnabled }, [isUiVoiceEnabled])

  useEffect(() => {
    ;(async () => {
      const [voice, autoRead, haptics, provider, googleApiKey, googleEndpoint, azureVisionKey, azureVisionEndpoint, azureTtsKey, azureTtsEndpoint] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.voice),
          AsyncStorage.getItem(STORAGE_KEYS.autoRead),
          AsyncStorage.getItem(STORAGE_KEYS.haptics),
          AsyncStorage.getItem(STORAGE_KEYS.ocrProvider),
          AsyncStorage.getItem(STORAGE_KEYS.googleApiKey),
          AsyncStorage.getItem(STORAGE_KEYS.googleEndpoint),
          AsyncStorage.getItem(STORAGE_KEYS.azureVisionKey),
          AsyncStorage.getItem(STORAGE_KEYS.azureVisionEndpoint),
          AsyncStorage.getItem(STORAGE_KEYS.azureTtsKey),
          AsyncStorage.getItem(STORAGE_KEYS.azureTtsEndpoint),
        ])
      setIsUiVoiceEnabled(voice === 'true')
      setIsAutoReadEnabled(autoRead !== 'false')
      setIsHapticsEnabled(haptics !== 'false')

      // One-time reset: builds before the api/ocr proxy only had on-device
      // Tesseract, and Settings saved that as an explicit choice. Clear it
      // once so this build defaults to Google Vision (see OcrContext).
      let savedProvider = provider || ''
      if (!(await AsyncStorage.getItem('songkhem_cloud_ocr_v1'))) {
        if (savedProvider === 'tesseract') {
          savedProvider = ''
          await AsyncStorage.removeItem(STORAGE_KEYS.ocrProvider)
        }
        await AsyncStorage.setItem('songkhem_cloud_ocr_v1', '1')
      }

      setOcrConfig({
        provider: savedProvider,
        googleApiKey: googleApiKey || '',
        googleEndpoint: googleEndpoint || '',
        azureVisionKey: azureVisionKey || '',
        azureVisionEndpoint: azureVisionEndpoint || '',
        azureTtsKey: azureTtsKey || '',
        azureTtsEndpoint: azureTtsEndpoint || '',
      })
    })()
  }, [])

  const triggerHaptic = useCallback((intensity = 'light') => {
    if (!isHapticsEnabledRef.current) return
    try {
      if (Platform.OS === 'android') {
        Vibration.vibrate(ANDROID_PATTERNS[intensity] || ANDROID_PATTERNS.light)
        return
      }
      const run = HAPTIC_MAP[intensity] || HAPTIC_MAP.light
      Promise.resolve(run()).catch(() => {})
    } catch (e) {
      // Devices without a vibrator / haptic engine: silently skip
    }
  }, [])

  // Test button in Settings: ignores the on/off switch's stored value so users can
  // confirm the hardware responds, and reports which backend fired.
  const testHaptics = useCallback(() => {
    try {
      if (Platform.OS === 'android') {
        Vibration.vibrate(ANDROID_PATTERNS.success)
      } else {
        Promise.resolve(HAPTIC_MAP.success()).catch(() => {})
      }
    } catch (e) {}
  }, [])

  const speakAccessibility = useCallback((text, interrupt = true) => {
    if (!text) return
    setSpokenStatusText(text)
    if (!isUiVoiceEnabledRef.current) return
    if (interrupt) Speech.stop()
    Speech.speak(text, { language: 'km-KH', rate: 1.0 })
  }, [])

  // Screen-reader announcement only (TalkBack / VoiceOver). Never touches the speech
  // queue, so it is safe to call while the document is being read aloud.
  const announce = useCallback((text) => {
    if (!text) return
    setSpokenStatusText(text)
    try {
      AccessibilityInfo.announceForAccessibility(text)
    } catch (e) {}
  }, [])

  const toggleUiVoice = useCallback(() => {
    setIsUiVoiceEnabled((prev) => {
      const next = !prev
      AsyncStorage.setItem(STORAGE_KEYS.voice, next ? 'true' : 'false').catch(() => {})
      triggerHaptic('success')
      if (next) speakAccessibility('បានបើកសំឡេងជំនួយបញ្ជា (Spoken Guidance Enabled)')
      return next
    })
  }, [triggerHaptic, speakAccessibility])

  const toggleAutoRead = useCallback(() => {
    setIsAutoReadEnabled((prev) => {
      const next = !prev
      AsyncStorage.setItem(STORAGE_KEYS.autoRead, next ? 'true' : 'false').catch(() => {})
      triggerHaptic('light')
      speakAccessibility(next ? 'បានបើកការអានដោយស្វ័យប្រវត្តិពេលស្កេនរួច' : 'បានបិទការអានស្វ័យប្រវត្តិ')
      return next
    })
  }, [triggerHaptic, speakAccessibility])

  const toggleHaptics = useCallback(() => {
    setIsHapticsEnabled((prev) => {
      const next = !prev
      AsyncStorage.setItem(STORAGE_KEYS.haptics, next ? 'true' : 'false').catch(() => {})
      if (next) testHaptics()
      speakAccessibility(next ? 'បានបើកការញ័រផ្តល់ដំណឹង (Haptics ON)' : 'បានបិទការញ័រ')
      return next
    })
  }, [speakAccessibility, testHaptics])

  const saveOcrConfig = useCallback(
    (next) => {
      setOcrConfig(next)
      AsyncStorage.multiSet([
        [STORAGE_KEYS.ocrProvider, next.provider || ''],
        [STORAGE_KEYS.googleApiKey, next.googleApiKey || ''],
        [STORAGE_KEYS.googleEndpoint, next.googleEndpoint || ''],
        [STORAGE_KEYS.azureVisionKey, next.azureVisionKey || ''],
        [STORAGE_KEYS.azureVisionEndpoint, next.azureVisionEndpoint || ''],
        [STORAGE_KEYS.azureTtsKey, next.azureTtsKey || ''],
        [STORAGE_KEYS.azureTtsEndpoint, next.azureTtsEndpoint || ''],
      ]).catch(() => {})
      triggerHaptic('light')
      speakAccessibility('បានរក្សាទុកការកំណត់ម៉ាស៊ីនស្កេន និងសំឡេង')
    },
    [triggerHaptic, speakAccessibility]
  )

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true)
    triggerHaptic('light')
    speakAccessibility('បានបើកផ្ទាំងការកំណត់លទ្ធភាពប្រើប្រាស់ (Accessibility Settings)')
  }, [triggerHaptic, speakAccessibility])

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false)
    triggerHaptic('light')
    speakAccessibility('បានបិទផ្ទាំងការកំណត់')
  }, [triggerHaptic, speakAccessibility])

  const openHelp = useCallback(() => {
    setIsHelpOpen(true)
    triggerHaptic('light')
    speakAccessibility('បានបើកការណែនាំពីរបៀបប្រើប្រាស់កម្មវិធី songKHEM')
  }, [triggerHaptic, speakAccessibility])

  const closeHelp = useCallback(() => {
    setIsHelpOpen(false)
    triggerHaptic('light')
    speakAccessibility('បានបិទការណែនាំ')
  }, [triggerHaptic, speakAccessibility])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'info', options = {}) => {
    const id = ++toastIdCounter
    const toast = { id, message, type, actionLabel: options.actionLabel, onAction: options.onAction }
    setToasts((prev) => [...prev, toast])
    const duration = options.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => dismissToast(id), duration)
    }
    return id
  }, [dismissToast])

  const value = useMemo(
    () => ({
      isUiVoiceEnabled,
      isAutoReadEnabled,
      isHapticsEnabled,
      spokenStatusText,
      toasts,
      isSettingsOpen,
      isHelpOpen,
      ocrConfig,
      triggerHaptic,
      testHaptics,
      speakAccessibility,
      announce,
      toggleUiVoice,
      toggleAutoRead,
      toggleHaptics,
      addToast,
      dismissToast,
      openSettings,
      closeSettings,
      openHelp,
      closeHelp,
      saveOcrConfig,
    }),
    [
      isUiVoiceEnabled,
      isAutoReadEnabled,
      isHapticsEnabled,
      spokenStatusText,
      toasts,
      isSettingsOpen,
      isHelpOpen,
      ocrConfig,
      triggerHaptic,
      testHaptics,
      speakAccessibility,
      announce,
      toggleUiVoice,
      toggleAutoRead,
      toggleHaptics,
      addToast,
      dismissToast,
      openSettings,
      closeSettings,
      openHelp,
      closeHelp,
      saveOcrConfig,
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within an AppProvider')
  return ctx
}
