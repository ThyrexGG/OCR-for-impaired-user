/**
 * Client for songKHEM's own serverless functions (api/ocr.js, api/tts.js),
 * which hold the Google Vision and Azure Speech keys server-side so they are
 * never shipped in this bundle. In production the site and functions share
 * an origin; in `npm run dev`, Vite proxies /api to VITE_API_PROXY (see
 * vite.config.js), so local runs can use the deployed functions.
 */
export const CLOUD_API_AVAILABLE = import.meta.env.PROD || !!import.meta.env.VITE_API_PROXY

/**
 * @param {string} base64Image - Raw base64 (no data-url prefix)
 * @returns {Promise<string>} - Detected text (may be empty)
 */
export const cloudOcr = async (base64Image) => {
  const response = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image })
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    console.warn('Cloud OCR error:', response.status, body.error)
    throw new Error('មិនអាចទាក់ទងម៉ាស៊ីនស្កេន Google Vision បានទេ។ សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយព្យាយាមម្តងទៀត។ (Unable to reach the OCR service. Check your connection and try again.)')
  }
  const data = await response.json()
  return data.text || ''
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
