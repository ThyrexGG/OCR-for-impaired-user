/**
 * songKHEM Caching Service (React Native port)
 * Ported from src/services/cache.js — localStorage becomes AsyncStorage
 * (async API), and the File-based fingerprint becomes a FileSystem-info-based
 * one since RN files are {uri, name, ...} rather than web File/Blob objects.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'

const OCR_CACHE_STORAGE_KEY = 'songkhem_ocr_cache'
const MAX_OCR_CACHE_ITEMS = 35

const inMemoryOcrCache = new Map()
const inMemoryTtsCache = new Map()

export const hashString = (str) => {
  let hash = 0
  if (!str || str.length === 0) return '0'
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return 'h_' + Math.abs(hash).toString(36)
}

/**
 * Compute a fingerprint for a picked/captured file: {uri, name, mimeType}
 */
export const getFileFingerprint = async (file) => {
  if (!file?.uri) return ''
  try {
    const info = await FileSystem.getInfoAsync(file.uri, { size: true })
    const meta = `${file.name || ''}_${info.size || 0}_${info.modificationTime || 0}`
    return hashString(meta)
  } catch (e) {
    return hashString(`${file.name || ''}_${file.uri}`)
  }
}

export const getOcrCache = async (key) => {
  if (!key) return null

  if (inMemoryOcrCache.has(key)) {
    return inMemoryOcrCache.get(key)
  }

  try {
    const raw = await AsyncStorage.getItem(OCR_CACHE_STORAGE_KEY)
    if (!raw) return null
    const cacheStore = JSON.parse(raw)
    if (cacheStore && cacheStore[key]) {
      const entry = cacheStore[key]
      inMemoryOcrCache.set(key, entry.text)
      return entry.text
    }
  } catch (err) {
    console.warn('OCR cache read error:', err)
  }

  return null
}

export const setOcrCache = async (key, text, title = '') => {
  if (!key || !text) return

  inMemoryOcrCache.set(key, text)

  try {
    let cacheStore = {}
    const raw = await AsyncStorage.getItem(OCR_CACHE_STORAGE_KEY)
    if (raw) {
      cacheStore = JSON.parse(raw)
    }

    cacheStore[key] = {
      text,
      title: title || 'Scanned Document',
      updatedAt: Date.now(),
    }

    const keys = Object.keys(cacheStore)
    if (keys.length > MAX_OCR_CACHE_ITEMS) {
      keys.sort((a, b) => (cacheStore[a].updatedAt || 0) - (cacheStore[b].updatedAt || 0))
      const oldestKeys = keys.slice(0, keys.length - MAX_OCR_CACHE_ITEMS)
      for (const oldKey of oldestKeys) {
        delete cacheStore[oldKey]
        inMemoryOcrCache.delete(oldKey)
      }
    }

    await AsyncStorage.setItem(OCR_CACHE_STORAGE_KEY, JSON.stringify(cacheStore))
  } catch (err) {
    console.warn('OCR cache write error:', err)
  }
}

export const getTtsCache = (text, voiceName, rate = 1.0) => {
  const key = hashString(`${voiceName}_${rate.toFixed(1)}_${text.trim()}`)
  return inMemoryTtsCache.get(key) || null
}

export const setTtsCache = (text, voiceName, rate, uri) => {
  if (!uri) return
  const key = hashString(`${voiceName}_${rate.toFixed(1)}_${text.trim()}`)
  inMemoryTtsCache.set(key, uri)

  if (inMemoryTtsCache.size > 25) {
    const firstKey = inMemoryTtsCache.keys().next().value
    inMemoryTtsCache.delete(firstKey)
  }
}

export const clearOcrCache = async () => {
  inMemoryOcrCache.clear()
  try {
    await AsyncStorage.removeItem(OCR_CACHE_STORAGE_KEY)
  } catch (e) {}
}
