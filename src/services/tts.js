
import { normalizeKhmerForSpeech } from './khmerNormalizer'

const escapeXml = (s) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c])

const LOCAL_KHMER_ENGINE_URL = import.meta.env.VITE_LOCAL_TTS_URL || '/api/tts'

/**
 * Synthesize Khmer speech via same-origin /api/tts (proxied to KhmerNeuralTTS engine or Vercel api/tts.js).
 * Works on iPhone (iOS Safari), Android, and Desktop with zero paid API keys.
 */
export const synthesizeLocalKhmerTTS = async (text, voiceName = 'km-KH-PisethNeural', rate = 1.0) => {
  const normalizedText = normalizeKhmerForSpeech(text)
  const payload = JSON.stringify({
    text: normalizedText,
    voice: voiceName,
    rate,
    binary: true
  })

  let response
  try {
    response = await fetch(LOCAL_KHMER_ENGINE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    })
  } catch (_) {
    // Direct localhost fallback if running without Vite proxy
    response = await fetch('http://localhost:5055/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    })
  }

  if (!response.ok) {
    throw new Error(`Khmer TTS engine returned ${response.status}`)
  }
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

/**
 * Perform text-to-speech using Microsoft Azure Cognitive Speech API
 * @param {string} text - The text to synthesize
 * @param {string} apiKey - Azure Subscription Key
 * @param {string} endpoint - Full Azure TTS Endpoint (e.g. https://eastus.tts.speech.microsoft.com/cognitiveservices/v1)
 * @param {number} rate - Speaking rate (default 1.0)
 * @param {number} pitch - Pitch (default 1.0)
 * @returns {Promise<string>} - Blob URL for the MP3 audio
 */
export const synthesizeTextAzureTTS = async (text, apiKey, endpoint, rate = 1.0, pitch = 1.0, voiceName = 'km-KH-PisethNeural', gender = 'Male') => {
  try {
    const normalizedText = normalizeKhmerForSpeech(text)

    if (!endpoint || !endpoint.includes('cognitiveservices/v1')) {
      throw new Error('Please provide a valid Azure TTS endpoint (e.g., https://<region>.tts.speech.microsoft.com/cognitiveservices/v1)')
    }

    // Convert rate and pitch to Azure SSML format (percentages)
    // rate: 1.0 -> '0.00%', 0.5 -> '-50.00%', 2.0 -> '+100.00%'
    const ratePercent = ((rate - 1) * 100).toFixed(2)
    const rateString = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`

    // pitch: 1.0 -> '0.00%', 0.5 -> '-50.00%', 2.0 -> '+100.00%'
    const pitchPercent = ((pitch - 1) * 100).toFixed(2)
    const pitchString = pitchPercent >= 0 ? `+${pitchPercent}%` : `${pitchPercent}%`

    const ssml = `
      <speak version='1.0' xml:lang='km-KH'>
        <voice xml:lang='km-KH' xml:gender='${gender}' name='${voiceName}'>
          <prosody rate='${rateString}' pitch='${pitchString}'>
            ${escapeXml(normalizedText)}
          </prosody>
        </voice>
      </speak>
    `.trim()

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3'
      },
      body: ssml
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(errText || 'Failed to communicate with Azure TTS API')
    }

    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    return blobUrl
  } catch (error) {
    console.error('Azure TTS API Execution Error:', error)
    throw error
  }
}


