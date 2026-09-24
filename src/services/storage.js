/**
 * Storage Service (Repository / Adapter)
 * DRY: Single source of truth for localStorage keys, serialization, and safety guards.
 */

export const STORAGE_KEYS = {
  THEME: 'songkhem_theme',
  FONT_SCALE: 'songkhem_font_scale',
  LINE_SPACING: 'songkhem_line_spacing',
  BOLD: 'songkhem_bold',
  VOICE: 'songkhem_voice',
  AUTO_READ: 'songkhem_auto_read',
  HAPTICS: 'songkhem_haptics',
  HISTORY: 'songkhem_history',
  OCR_CACHE: 'songkhem_ocr_cache',
  LANGUAGE: 'songkhem_lang'
}

class StorageService {
  getItem(key, defaultValue = null) {
    if (typeof window === 'undefined' || !window.localStorage) return defaultValue
    try {
      const val = localStorage.getItem(key)
      return val !== null ? val : defaultValue
    } catch {
      return defaultValue
    }
  }

  getJson(key, defaultValue = null) {
    const raw = this.getItem(key)
    if (!raw) return defaultValue
    try {
      return JSON.parse(raw)
    } catch {
      return defaultValue
    }
  }

  setItem(key, value) {
    if (typeof window === 'undefined' || !window.localStorage) return false
    try {
      localStorage.setItem(key, String(value))
      return true
    } catch {
      return false
    }
  }

  setJson(key, value) {
    try {
      return this.setItem(key, JSON.stringify(value))
    } catch {
      return false
    }
  }

  removeItem(key) {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      localStorage.removeItem(key)
    } catch {}
  }
}

export const storage = new StorageService()
