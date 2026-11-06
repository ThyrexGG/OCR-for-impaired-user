/**
 * songKHEM TTS Service (React Native port of src/services/tts.js)
 * The web version returns a `URL.createObjectURL(blob)` for use with an
 * HTML <audio> element. RN's expo-audio needs a real file:// uri instead, so
 * the fetched MP3 bytes are written to the cache directory and that path is
 * returned. RN's built-in FileReader (a core polyfill, not web-only) can read
 * a fetch Blob into a base64 data URI, which is the standard way to get
 * fetched binary data onto disk in React Native.
 */
import * as FileSystem from 'expo-file-system/legacy'
import { cloudTts } from './cloudApi'

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

const escapeXml = (s) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c])

const writeAudioFile = async (blob) => {
  const base64 = await blobToBase64(blob)
  const fileUri = `${FileSystem.cacheDirectory}songkhem_tts_${Date.now()}.mp3`
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 })
  return fileUri
}

/**
 * Azure neural TTS through songKHEM's api/tts proxy (no key on the device).
 * @returns {Promise<string>} - Local file:// uri for the synthesized MP3
 */
export const synthesizeTextCloudTTS = async (text, voiceName = 'km-KH-PisethNeural') => {
  return writeAudioFile(await cloudTts(text, voiceName))
}

/**
 * Perform text-to-speech using Microsoft Azure Cognitive Speech API
 * @param {string} text - The text to synthesize
 * @param {string} apiKey - Azure Subscription Key
 * @param {string} endpoint - Full Azure TTS Endpoint (e.g. https://eastus.tts.speech.microsoft.com/cognitiveservices/v1)
 * @returns {Promise<string>} - Local file:// uri for the synthesized MP3
 */
export const synthesizeTextAzureTTS = async (text, apiKey, endpoint, rate = 1.0, pitch = 1.0, voiceName = 'km-KH-PisethNeural', gender = 'Male') => {
  try {
    if (!endpoint || !endpoint.includes('cognitiveservices/v1')) {
      throw new Error('Please provide a valid Azure TTS endpoint (e.g., https://<region>.tts.speech.microsoft.com/cognitiveservices/v1)')
    }

    const ratePercent = ((rate - 1) * 100).toFixed(2)
    const rateString = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`

    const pitchPercent = ((pitch - 1) * 100).toFixed(2)
    const pitchString = pitchPercent >= 0 ? `+${pitchPercent}%` : `${pitchPercent}%`

    const ssml = `
      <speak version='1.0' xml:lang='km-KH'>
        <voice xml:lang='km-KH' xml:gender='${gender}' name='${voiceName}'>
          <prosody rate='${rateString}' pitch='${pitchString}'>
            ${escapeXml(text)}
          </prosody>
        </voice>
      </speak>
    `.trim()

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
      },
      body: ssml,
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(errText || 'Failed to communicate with Azure TTS API')
    }

    return writeAudioFile(await response.blob())
  } catch (error) {
    console.error('Azure TTS API Execution Error:', error)
    throw error
  }
}
