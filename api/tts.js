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
// Lowered from 10000 to 3000 to protect against accidental credit burn
const MAX_TEXT_LENGTH = 3000

// In-memory sliding-window rate limiter (per IP)
const rateLimitMap = new Map()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30

const escapeXml = (s) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Basic rate limiting to prevent credit exhaustion
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
  const now = Date.now()
  const clientData = rateLimitMap.get(clientIp) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS }

  if (now > clientData.resetTime) {
    clientData.count = 1
    clientData.resetTime = now + RATE_LIMIT_WINDOW_MS
  } else {
    clientData.count++
  }
  rateLimitMap.set(clientIp, clientData)

  // Clean old rate limit entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [ip, data] of rateLimitMap.entries()) {
      if (now > data.resetTime) rateLimitMap.delete(ip)
    }
  }

  if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'Too many requests. សូមរង់ចាំបន្តិចមុននឹងព្យាយាមម្តងទៀត។' })
  }

  const apiKey = process.env.AZURE_TTS_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'TTS is not configured on the server' })
  }

  const rawText = req.body && req.body.text
  const voice = (req.body && req.body.voice) || 'km-KH-PisethNeural'
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return res.status(400).json({ error: 'Missing or empty text' })
  }

  // Gracefully cap text length to protect quota
  const text = rawText.length > MAX_TEXT_LENGTH ? rawText.slice(0, MAX_TEXT_LENGTH) : rawText

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
    // Edge cache: repeated requests for identical text will hit edge cache for free
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400')
    return res.status(200).send(audio)
  } catch (error) {
    console.error('Azure TTS request failed:', error)
    return res.status(502).json({ error: 'TTS provider unreachable' })
  }
}
