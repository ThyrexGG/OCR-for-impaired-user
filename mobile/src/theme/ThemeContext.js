import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { AccessibilityInfo } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { themes, fonts } from './tokens'

const STORAGE_KEYS = {
  theme: 'songkhem_theme',
  fontScale: 'songkhem_font_scale',
  lineSpacing: 'songkhem_line_spacing',
  bold: 'songkhem_bold',
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState('light')
  const [fontScale, setFontScale] = useState(1.0)
  const [lineSpacing, setLineSpacingState] = useState(1.85)
  const [isBoldText, setIsBoldText] = useState(false)
  const [isReducedMotion, setIsReducedMotion] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const [savedTheme, savedScale, savedSpacing, savedBold] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.theme),
          AsyncStorage.getItem(STORAGE_KEYS.fontScale),
          AsyncStorage.getItem(STORAGE_KEYS.lineSpacing),
          AsyncStorage.getItem(STORAGE_KEYS.bold),
        ])
        if (!mounted) return

        if (savedTheme && themes[savedTheme]) setCurrentTheme(savedTheme)

        const parsedScale = parseFloat(savedScale)
        if (!Number.isNaN(parsedScale)) setFontScale(parsedScale)

        const parsedSpacing = parseFloat(savedSpacing)
        if (!Number.isNaN(parsedSpacing)) setLineSpacingState(parsedSpacing)

        setIsBoldText(savedBold === 'true')
      } finally {
        if (mounted) setIsReady(true)
      }
    })()

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setIsReducedMotion)
    AccessibilityInfo.isReduceMotionEnabled().then((val) => mounted && setIsReducedMotion(val))

    return () => {
      mounted = false
      sub.remove()
    }
  }, [])

  const setTheme = useCallback((theme) => {
    if (!themes[theme]) return
    setCurrentTheme(theme)
    AsyncStorage.setItem(STORAGE_KEYS.theme, theme).catch(() => {})
  }, [])

  const changeFontScale = useCallback((delta) => {
    setFontScale((prev) => {
      let next = Math.round((prev + delta) * 100) / 100
      if (next < 0.9) next = 0.9
      if (next > 1.6) next = 1.6
      AsyncStorage.setItem(STORAGE_KEYS.fontScale, String(next)).catch(() => {})
      return next
    })
  }, [])

  const resetFontScale = useCallback(() => {
    setFontScale(1.0)
    AsyncStorage.setItem(STORAGE_KEYS.fontScale, '1').catch(() => {})
  }, [])

  const setLineSpacing = useCallback((val) => {
    setLineSpacingState(val)
    AsyncStorage.setItem(STORAGE_KEYS.lineSpacing, String(val)).catch(() => {})
  }, [])

  const toggleBoldText = useCallback(() => {
    setIsBoldText((prev) => {
      const next = !prev
      AsyncStorage.setItem(STORAGE_KEYS.bold, next ? 'true' : 'false').catch(() => {})
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      currentTheme,
      colors: themes[currentTheme],
      fonts,
      fontScale,
      lineSpacing,
      isBoldText,
      isReducedMotion,
      isReady,
      setTheme,
      changeFontScale,
      resetFontScale,
      setLineSpacing,
      toggleBoldText,
    }),
    [currentTheme, fontScale, lineSpacing, isBoldText, isReducedMotion, isReady, setTheme, changeFontScale, resetFontScale, setLineSpacing, toggleBoldText]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
