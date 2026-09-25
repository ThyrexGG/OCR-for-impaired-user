/**
 * Vercel serverless function: Azure Neural TTS proxy.
 * The Speech key lives only in the server env (AZURE_TTS_API_KEY). Clients
 * POST { text, voice } and get back audio/mpeg bytes. Only the two Khmer
 * neural voices are allowed, so the endpoint can't be used as a general
 * Azure Speech relay.
 */

const VOICES = {
  'km-KH-PisethNeural': 'Male',
  'km-KH-SreymomNeural': 'Female',
}
const MAX_TEXT_LENGTH = 10000

const escapeXml = (s) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.AZURE_TTS_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'TTS is not configured on the server' })
  }

  const text = req.body && req.body.text
  const voice = (req.body && req.body.voice) || 'km-KH-PisethNeural'
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: 'Missing or oversized text' })
  }
  if (!VOICES[voice]) {
    return res.status(400).json({ error: 'Unsupported voice' })
  }

  const endpoint = process.env.AZURE_TTS_ENDPOINT || 'https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1'
  const ssml =
    `<speak version='1.0' xml:lang='km-KH'>` +
    `<voice xml:lang='km-KH' xml:gender='${VOICES[voice]}' name='${voice}'>${escapeXml(text)}</voice>` +
    `</speak>`

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
      },
      body: ssml,
    })

    if (!upstream.ok) {
      console.error('Azure TTS error:', upstream.status, await upstream.text().catch(() => ''))
      return res.status(502).json({ error: 'TTS provider error' })
    }

    const audio = Buffer.from(await upstream.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(audio)
  } catch (error) {
    console.error('Azure TTS request failed:', error)
    return res.status(502).json({ error: 'TTS provider unreachable' })
  }
}
