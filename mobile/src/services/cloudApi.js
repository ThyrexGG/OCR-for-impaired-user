/**
 * Client for songKHEM's serverless functions (api/ocr.js, api/tts.js on the
 * Vercel site), which hold the Google Vision and Azure Speech keys server-side
 * so none ship inside the APK. Enabled when EXPO_PUBLIC_API_BASE_URL is set
 * at build time (e.g. https://<app>.vercel.app).
 */
const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '')

export const CLOUD_API_AVAILABLE = !!API_BASE

/**
 * @param {string} base64Image - Raw base64 (no data-url prefix)
 * @returns {Promise<string>} - Detected text (may be empty)
 */
export const cloudOcr = async (base64Image) => {
  const response = await fetch(`${API_BASE}/api/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    console.warn('Cloud OCR error:', response.status, body.error)
    throw new Error(
      'មិនអាចទាក់ទងម៉ាស៊ីនស្កេនបានទេ។ សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយព្យាយាមម្តងទៀត។ (Unable to connect to OCR service. Please check your network and try again.)'
    )
  }
  const data = await response.json()
  return data.text || ''
}

/**
 * @param {string} text
 * @param {string} voiceName - km-KH-PisethNeural | km-KH-SreymomNeural
 * @returns {Promise<Blob>} - MP3 audio
 */
export const cloudTts = async (text, voiceName) => {
  const response = await fetch(`${API_BASE}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: voiceName }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Cloud TTS failed (${response.status})`)
  }
  return response.blob()
}
