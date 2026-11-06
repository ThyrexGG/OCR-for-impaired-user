/**
 * Client for songKHEM's serverless functions (api/ocr.js, api/tts.js on the
 * Vercel site), which hold the Google Vision and Azure Speech keys server-side
 * so none ship inside the APK. Enabled when EXPO_PUBLIC_API_BASE_URL is set
 * at build time (e.g. https://<app>.vercel.app).
 */
import { ScanError } from './scanErrors'

const API_BASE =(process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '')
// The server only serves app builds that carry its current pass (SONGKHEM_APP_KEY on Vercel)
const HEADERS = { 'Content-Type': 'application/json', 'X-SongKHEM-App-Key': process.env.EXPO_PUBLIC_APP_KEY || '' }

export const CLOUD_API_AVAILABLE = !!API_BASE

const OCR_TIMEOUT_MS = 45000

/**
 * @param {string} base64Image - Raw base64 (no data-url prefix)
 * @returns {Promise<string>} - Detected text (may be empty)
 */
export const cloudOcr = async (base64Image) => {
  // A stalled upload would otherwise leave the user listening to the waiting sound forever
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE}/api/ocr`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ image: base64Image }),
      signal: controller.signal,
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      console.warn('Cloud OCR error:', response.status, body.error)
      if (body.code === 'monthly_limit') throw new ScanError('monthly_limit')
      if (response.status === 429) throw new ScanError('busy')
      if (response.status === 403) throw new ScanError('outdated')
      if (response.status === 400 || response.status === 413) throw new ScanError('bad_file', body.error)
      throw new ScanError('server', body.error)
    }
    const data = await response.json()
    return data.text || ''
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {string} text
 * @param {string} voiceName - km-KH-PisethNeural | km-KH-SreymomNeural
 * @returns {Promise<Blob>} - MP3 audio
 */
export const cloudTts = async (text, voiceName) => {
  const response = await fetch(`${API_BASE}/api/tts`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ text, voice: voiceName }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Cloud TTS failed (${response.status})`)
  }
  return response.blob()
}
