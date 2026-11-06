/**
 * Client for songKHEM's own serverless functions (api/ocr.js, api/tts.js),
 * which hold the Google Vision and Azure Speech keys server-side so they are
 * never shipped in this bundle. In production the site and functions share
 * an origin; in `npm run dev`, Vite proxies /api to VITE_API_PROXY (see
 * vite.config.js), so local runs can use the deployed functions.
 */
import { ScanError } from './scanErrors'

export const CLOUD_API_AVAILABLE = import.meta.env.PROD || !!import.meta.env.VITE_API_PROXY

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
    const response = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image }),
      signal: controller.signal
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      console.warn('Cloud OCR error:', response.status, body.error)
      if (body.code === 'monthly_limit') throw new ScanError('monthly_limit')
      if (response.status === 429) throw new ScanError('busy')
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
 * @returns {Promise<string>} - Blob URL for the MP3 audio
 */
export const cloudTts = async (text, voiceName) => {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: voiceName })
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Cloud TTS failed (${response.status})`)
  }
  return URL.createObjectURL(await response.blob())
}
