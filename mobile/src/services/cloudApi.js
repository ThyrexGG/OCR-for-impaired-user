/**
 * Client for songKHEM's serverless functions (api/ocr.js, api/tts.js on the
 * Vercel site), which hold the Google Vision and Azure Speech keys server-side
 * so none ship inside the APK. Enabled when EXPO_PUBLIC_API_BASE_URL is set
 * at build time (e.g. https://<app>.vercel.app).
 */
const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '')
// The server only serves app builds that carry its current pass (SONGKHEM_APP_KEY on Vercel)
const HEADERS = { 'Content-Type': 'application/json', 'X-SongKHEM-App-Key': process.env.EXPO_PUBLIC_APP_KEY || '' }

export const CLOUD_API_AVAILABLE = !!API_BASE

/**
 * @param {string} base64Image - Raw base64 (no data-url prefix)
 * @returns {Promise<string>} - Detected text (may be empty)
 */
export const cloudOcr = async (base64Image) => {
  const response = await fetch(`${API_BASE}/api/ocr`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ image: base64Image }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    console.warn('Cloud OCR error:', response.status, body.error)
    if (body.code === 'monthly_limit') {
      throw new Error('ការស្កេនសម្រាប់ខែនេះបានគ្រប់ចំនួនកំណត់ហើយ។ សូមព្យាយាមម្តងទៀតនៅខែក្រោយ។ (This month\'s scanning limit has been reached. Please try again next month.)')
    }
    if (response.status === 429) {
      throw new Error('ស្កេនច្រើនពេកក្នុងពេលខ្លី។ សូមរង់ចាំពីរបីនាទី ហើយព្យាយាមម្តងទៀត។ (Too many scans in a short time. Please wait a few minutes and try again.)')
    }
    if (response.status === 403) {
      throw new Error('កម្មវិធីនេះហួសសម័យហើយ។ សូមដំឡើងកំណែថ្មី។ (This copy of the app is out of date. Please install the latest version.)')
    }
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
    headers: HEADERS,
    body: JSON.stringify({ text, voice: voiceName }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Cloud TTS failed (${response.status})`)
  }
  return response.blob()
}
