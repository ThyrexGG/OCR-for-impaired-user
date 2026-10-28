import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { AccessibilityInfo, Platform, Vibration } from 'react-native'
import { vibratePattern, playEffects, EFFECT } from '../services/nativeHaptics'
import { setPhoneVoiceAllowed, setSpeechRate, speakNow, stopSpeaking } from '../services/talkback'
import { TP } from '../services/talkPhrases'

const STORAGE_KEYS = {
  voice: 'songkhem_voice',
  autoRead: 'songkhem_auto_read',
  haptics: 'songkhem_haptics',
  explore: 'songkhem_explore_touch',
  voiceRate: 'songkhem_voice_rate',
  welcomed: 'songkhem_welcomed',
  ocrProvider: 'songkhem_ocr_engine',
  googleApiKey: 'songkhem_google_api_key',
  googleEndpoint: 'songkhem_google_endpoint',
  azureVisionKey: 'songkhem_azure_vision_key',
  azureVisionEndpoint: 'songkhem_azure_vision_endpoint',
  azureTtsKey: 'songkhem_azure_tts_key',
  azureTtsEndpoint: 'songkhem_azure_tts_endpoint',
  appVoiceOnly: 'songkhem_app_voice_only',
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
  light: [0, 55],
  medium: [0, 80],
  heavy: [0, 120],
  selection: [0, 40],
  success: [0, 110, 60, 150],
  warning: [0, 150, 70, 150],
  error: [0, 150, 80, 150, 80, 220],
  // Settings > Test Vibration: long and unmistakable, so "nothing felt" really means the phone is blocking it
  test: [0, 300, 150, 300, 150, 500],
}

// The phone's built-in effects [effectId, startMs]; preferred over the plain buzzes above because linear-motor
// phones render a timed buzz as almost nothing. Each tap type is a distinct shape you can tell apart.
const EFFECT_STEPS = {
  light: [[EFFECT.CLICK, 0]],
  selection: [[EFFECT.TICK, 0]],
  medium: [[EFFECT.HEAVY_CLICK, 0]],
  heavy: [[EFFECT.HEAVY_CLICK, 0], [EFFECT.HEAVY_CLICK, 130]],
  success: [[EFFECT.CLICK, 0], [EFFECT.HEAVY_CLICK, 150]],
  warning: [[EFFECT.HEAVY_CLICK, 0], [EFFECT.HEAVY_CLICK, 200]],
  error: [[EFFECT.HEAVY_CLICK, 0], [EFFECT.HEAVY_CLICK, 160], [EFFECT.HEAVY_CLICK, 320]],
  test: [[EFFECT.HEAVY_CLICK, 0], [EFFECT.HEAVY_CLICK, 700], [EFFECT.HEAVY_CLICK, 1400]],
}

let toastIdCounter = 0

const AppContext = createContext(null)

export function AppProvider({ children }) {
  // Talk-back is on by default: this app is built for people who may not see the screen,
  // In-app talk-back is OFF by default so songKHEM functions as a normal app unless the user
  // explicitly turns it on, or uses their device's native TalkBack (Android) / VoiceOver (iOS).
  const [isUiVoiceEnabled, setIsUiVoiceEnabled] = useState(false)
  const [isExploreEnabled, setIsExploreEnabled] = useState(false)
  const [voiceRate, setVoiceRateState] = useState(1.25)
  const [isScreenReaderOn, setIsScreenReaderOn] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [isAutoReadEnabled, setIsAutoReadEnabled] = useState(true)
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true)
  const [isAppVoiceOnly, setIsAppVoiceOnly] = useState(false)
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
  const isScreenReaderOnRef = useRef(false)
  useEffect(() => { isUiVoiceEnabledRef.current = isUiVoiceEnabled }, [isUiVoiceEnabled])
  useEffect(() => { isScreenReaderOnRef.current = isScreenReaderOn }, [isScreenReaderOn])

  // Testing switch (off by default): speak everything in songKHEM's own voice, never the phone's, for phones
  // whose Khmer voice is missing or broken. Also covers TalkBack / VoiceOver announcements.
  const appVoiceOnlyRef = useRef(false)
  useEffect(() => {
    appVoiceOnlyRef.current = isAppVoiceOnly
    setPhoneVoiceAllowed(!isAppVoiceOnly)
  }, [isAppVoiceOnly])
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.appVoiceOnly).then((v) => setIsAppVoiceOnly(v === 'true')).catch(() => {})
  }, [])

  // The OS screen reader (TalkBack / VoiceOver) already speaks every control and does
  // its own touch exploration; running ours as well would double every sentence.
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isScreenReaderEnabled().then((on) => alive && setIsScreenReaderOn(!!on)).catch(() => {})
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (on) => setIsScreenReaderOn(!!on))
    return () => {
      alive = false
      sub?.remove?.()
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      const [voice, autoRead, haptics, explore, savedRate, provider, googleApiKey, googleEndpoint, azureVisionKey, azureVisionEndpoint, azureTtsKey, azureTtsEndpoint] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.voice),
          AsyncStorage.getItem(STORAGE_KEYS.autoRead),
          AsyncStorage.getItem(STORAGE_KEYS.haptics),
          AsyncStorage.getItem(STORAGE_KEYS.explore),
          AsyncStorage.getItem(STORAGE_KEYS.voiceRate),
          AsyncStorage.getItem(STORAGE_KEYS.ocrProvider),
          AsyncStorage.getItem(STORAGE_KEYS.googleApiKey),
          AsyncStorage.getItem(STORAGE_KEYS.googleEndpoint),
          AsyncStorage.getItem(STORAGE_KEYS.azureVisionKey),
          AsyncStorage.getItem(STORAGE_KEYS.azureVisionEndpoint),
          AsyncStorage.getItem(STORAGE_KEYS.azureTtsKey),
          AsyncStorage.getItem(STORAGE_KEYS.azureTtsEndpoint),
        ])
      setIsUiVoiceEnabled(voice === 'true')
      setIsExploreEnabled(explore === 'true')
      const rateNum = parseFloat(savedRate)
      if (rateNum >= 0.75 && rateNum <= 2.5) {
        setVoiceRateState(rateNum)
        setSpeechRate(rateNum)
      } else {
        setSpeechRate(1.25)
      }
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
      setPrefsLoaded(true)
    })()
  }, [])

  const triggerHaptic = useCallback((intensity = 'light') => {
    if (!isHapticsEnabledRef.current) return
    try {
      if (Platform.OS === 'android') {
        const pattern = ANDROID_PATTERNS[intensity] || ANDROID_PATTERNS.light
        if (!playEffects(EFFECT_STEPS[intensity] || EFFECT_STEPS.light) && !vibratePattern(pattern)) Vibration.vibrate(pattern)
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
        if (!playEffects(EFFECT_STEPS.test) && !vibratePattern(ANDROID_PATTERNS.test)) Vibration.vibrate(ANDROID_PATTERNS.test)
      } else {
        Promise.resolve(HAPTIC_MAP.success()).catch(() => {})
      }
    } catch (e) {}
  }, [])

  // Screen-reader announcement only (TalkBack / VoiceOver).
  const announceToScreenReader = useCallback((text) => {
    try {
      AccessibilityInfo.announceForAccessibility(text)
    } catch (e) {}
  }, [])

  // Spoken feedback. Starts immediately (no state update first, so no re-render sits between
  // the touch and the sound). The OS screen reader takes over when one is running.
  const speakAccessibility = useCallback(
    (text, interrupt = true) => {
      if (!text) return
      if (isScreenReaderOnRef.current && !appVoiceOnlyRef.current) {
        announceToScreenReader(Array.isArray(text) ? text.join('. ') : text)
        return
      }
      if (!isUiVoiceEnabledRef.current && !isScreenReaderOnRef.current) return
      speakNow(text, { interrupt })
    },
    [announceToScreenReader]
  )

  // Status messages that must not touch the document reading (skip, seek). They replace each
  // other, so tapping skip five times says "forward" once, not five times in a queue.
  const announce = useCallback(
    (text) => {
      if (!text) return
      if (isScreenReaderOnRef.current && appVoiceOnlyRef.current) {
        speakNow(text)
        return
      }
      if (isScreenReaderOnRef.current || !isUiVoiceEnabledRef.current) {
        announceToScreenReader(text)
        return
      }
      speakNow(text)
    },
    [announceToScreenReader]
  )

  const toggleUiVoice = useCallback(() => {
    const next = !isUiVoiceEnabledRef.current
    triggerHaptic('success')
    if (next) {
      isUiVoiceEnabledRef.current = true
      setIsUiVoiceEnabled(true)
      if (isScreenReaderOnRef.current) announceToScreenReader(TP.voiceOn.km)
      else speakNow(TP.voiceOn.km)
    } else {
      // Say it before going quiet, otherwise the user never learns it worked
      if (isScreenReaderOnRef.current) announceToScreenReader(TP.voiceOff.km)
      else speakNow(TP.voiceOff.km)
      isUiVoiceEnabledRef.current = false
      setIsUiVoiceEnabled(false)
    }
    AsyncStorage.setItem(STORAGE_KEYS.voice, next ? 'true' : 'false').catch(() => {})
  }, [triggerHaptic, announceToScreenReader])

  const toggleExplore = useCallback(() => {
    const next = !isExploreEnabled
    setIsExploreEnabled(next)
    AsyncStorage.setItem(STORAGE_KEYS.explore, next ? 'true' : 'false').catch(() => {})
    triggerHaptic('light')
    speakAccessibility(next ? TP.exploreOn.km : TP.exploreOff.km)
  }, [isExploreEnabled, triggerHaptic, speakAccessibility])

  const setVoiceRate = useCallback(
    (value) => {
      setVoiceRateState(value)
      setSpeechRate(value)
      AsyncStorage.setItem(STORAGE_KEYS.voiceRate, String(value)).catch(() => {})
      triggerHaptic('light')
      speakAccessibility(TP.exploreOn.km)
    },
    [triggerHaptic, speakAccessibility]
  )

  // Said once when the app opens: the first time in full, afterwards just a short reminder.
  const speakWelcome = useCallback(async () => {
    let seen = false
    try {
      seen = (await AsyncStorage.getItem(STORAGE_KEYS.welcomed)) === 'true'
      if (!seen) await AsyncStorage.setItem(STORAGE_KEYS.welcomed, 'true')
    } catch (e) {}
    if (!seen) speakAccessibility([TP.welcomeIntro.km, TP.welcomeHow.km, TP.welcomeOff.km])
    else speakAccessibility([TP.welcomeIntro.km, TP.exploreOn.km])
  }, [speakAccessibility])

  useEffect(() => () => stopSpeaking(), [])

  // Screen intros wait for the saved preferences; never let a storage hiccup hold them back forever
  useEffect(() => {
    const id = setTimeout(() => setPrefsLoaded(true), 1500)
    return () => clearTimeout(id)
  }, [])

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

  const toggleAppVoiceOnly = useCallback(() => {
    setIsAppVoiceOnly((prev) => {
      const next = !prev
      AsyncStorage.setItem(STORAGE_KEYS.appVoiceOnly, next ? 'true' : 'false').catch(() => {})
      triggerHaptic('light')
      return next
    })
  }, [triggerHaptic])

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

  const isTalkbackActive = isUiVoiceEnabled && !isScreenReaderOn
  const isExploreActive = isTalkbackActive && isExploreEnabled

  const value = useMemo(
    () => ({
      isTalkbackActive,
      isExploreActive,
      isUiVoiceEnabled,
      isExploreEnabled,
      voiceRate,
      isScreenReaderOn,
      prefsLoaded,
      isAutoReadEnabled,
      isHapticsEnabled,
      isAppVoiceOnly,
      toasts,
      isSettingsOpen,
      isHelpOpen,
      ocrConfig,
      triggerHaptic,
      testHaptics,
      speakAccessibility,
      announce,
      toggleUiVoice,
      toggleExplore,
      setVoiceRate,
      speakWelcome,
      toggleAutoRead,
      toggleHaptics,
      addToast,
      dismissToast,
      openSettings,
      closeSettings,
      openHelp,
      closeHelp,
      saveOcrConfig,
      toggleAppVoiceOnly,
    }),
    [
      isTalkbackActive,
      isExploreActive,
      isUiVoiceEnabled,
      isExploreEnabled,
      voiceRate,
      isScreenReaderOn,
      prefsLoaded,
      isAutoReadEnabled,
      isHapticsEnabled,
      isAppVoiceOnly,
      toasts,
      isSettingsOpen,
      isHelpOpen,
      ocrConfig,
      triggerHaptic,
      testHaptics,
      speakAccessibility,
      announce,
      toggleUiVoice,
      toggleExplore,
      setVoiceRate,
      speakWelcome,
      toggleAutoRead,
      toggleHaptics,
      addToast,
      dismissToast,
      openSettings,
      closeSettings,
      openHelp,
      closeHelp,
      saveOcrConfig,
      toggleAppVoiceOnly,
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within an AppProvider')
  return ctx
}
