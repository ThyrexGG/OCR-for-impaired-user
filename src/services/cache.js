/**
 * songKHEM Caching Service
 * Provides in-memory and local storage caching for OCR document recognition
 * and synthesized TTS audio blobs with LRU eviction policy.
 */

const OCR_CACHE_STORAGE_KEY = 'songkhem_ocr_cache'
const MAX_OCR_CACHE_ITEMS = 35

// In-memory cache fallback and audio Blob cache
const inMemoryOcrCache = new Map()
const inMemoryTtsCache = new Map()

/**
 * Generate a deterministic hash string from any text or metadata
 */
export const hashString = (str) => {
  let hash = 0
  if (!str || str.length === 0) return '0'
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32bit integer
  }
  return 'h_' + Math.abs(hash).toString(36)
}

/**
 * Compute a unique fingerprint for a File (by name, size, lastModified, and slice)
 * @param {File} file
 * @returns {Promise<string>}
 */
export const getFileFingerprint = async (file) => {
  if (!file) return ''
  const meta = `${file.name}_${file.size}_${file.lastModified}`
  
  // Read first and last 2KB for content-aware fingerprint
  try {
    const sliceStart = file.slice(0, 2048)
    const buf = await sliceStart.arrayBuffer()
    const view = new Uint8Array(buf)
    let sample = ''
    for (let i = 0; i < Math.min(view.length, 64); i++) {
      sample += view[i].toString(16)
    }
    return hashString(meta + '_' + sample)
  } catch (e) {
    return hashString(meta)
  }
}

/**
 * Retrieve cached OCR text by file fingerprint or key
 * @param {string} key
 * @returns {string|null}
 */
export const getOcrCache = (key) => {
  if (!key) return null

  // 1. Check in-memory map
  if (inMemoryOcrCache.has(key)) {
    return inMemoryOcrCache.get(key)
  }

  // 2. Check localStorage
  try {
    const raw = localStorage.getItem(OCR_CACHE_STORAGE_KEY)
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

/**
 * Store recognized text in cache with LRU eviction
 * @param {string} key
 * @param {string} text
 * @param {string} title
 */
export const setOcrCache = (key, text, title = '') => {
  if (!key || !text) return

  // Update in-memory
  inMemoryOcrCache.set(key, text)

  // Update localStorage with LRU eviction
  try {
    let cacheStore = {}
    const raw = localStorage.getItem(OCR_CACHE_STORAGE_KEY)
    if (raw) {
      cacheStore = JSON.parse(raw)
    }

    // Insert or update with timestamp
    cacheStore[key] = {
      text,
      title: title || 'Scanned Document',
      updatedAt: Date.now()
    }

    // Evict oldest if exceeding limit
    const keys = Object.keys(cacheStore)
    if (keys.length > MAX_OCR_CACHE_ITEMS) {
      keys.sort((a, b) => (cacheStore[a].updatedAt || 0) - (cacheStore[b].updatedAt || 0))
      const oldestKeys = keys.slice(0, keys.length - MAX_OCR_CACHE_ITEMS)
      for (const oldKey of oldestKeys) {
        delete cacheStore[oldKey]
        inMemoryOcrCache.delete(oldKey)
      }
    }

    localStorage.setItem(OCR_CACHE_STORAGE_KEY, JSON.stringify(cacheStore))
  } catch (err) {
    console.warn('OCR cache write error:', err)
  }
}

/**
 * Retrieve cached TTS audio blob URL
 * @param {string} text
 * @param {string} voiceName
 * @param {number} rate
 * @returns {string|null}
 */
export const getTtsCache = (text, voiceName, rate = 1.0) => {
  const key = hashString(`${voiceName}_${rate.toFixed(1)}_${text.trim()}`)
  return inMemoryTtsCache.get(key) || null
}

/**
 * Store synthesized audio blob URL in in-memory cache
 * @param {string} text
 * @param {string} voiceName
 * @param {number} rate
 * @param {string} blobUrl
 */
export const setTtsCache = (text, voiceName, rate, blobUrl) => {
  if (!blobUrl) return
  const key = hashString(`${voiceName}_${rate.toFixed(1)}_${text.trim()}`)
  inMemoryTtsCache.set(key, blobUrl)

  // Cap in-memory audio objects to avoid memory bloat
  if (inMemoryTtsCache.size > 25) {
    const firstKey = inMemoryTtsCache.keys().next().value
    inMemoryTtsCache.delete(firstKey)
  }
}

/**
 * Clear all cached OCR data
 */
export const clearOcrCache = () => {
  inMemoryOcrCache.clear()
  try {
    localStorage.removeItem(OCR_CACHE_STORAGE_KEY)
  } catch (e) {}
}
