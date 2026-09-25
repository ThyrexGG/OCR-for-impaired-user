/**
 * Vercel serverless function: Google Cloud Vision OCR proxy.
 * The API key lives only in the server env (GOOGLE_VISION_API_KEY), never in
 * the website bundle or the mobile app. Clients POST { image: <base64> } and
 * get back { text }.
 */

// Vercel caps request bodies at 4.5MB; clients downscale photos before sending.
const MAX_BASE64_LENGTH = 4_200_000

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'OCR is not configured on the server' })
  }

  const image = req.body && req.body.image
  if (typeof image !== 'string' || !image || image.length > MAX_BASE64_LENGTH) {
    return res.status(400).json({ error: 'Missing or oversized image' })
  }

  const endpoint = process.env.GOOGLE_VISION_ENDPOINT || 'https://vision.googleapis.com/v1/images:annotate'

  try {
    const upstream = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: image },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            imageContext: { languageHints: ['km', 'en'] },
          },
        ],
      }),
    })

    const data = await upstream.json().catch(() => null)
    const result = data && data.responses && data.responses[0]

    if (!upstream.ok || !result || result.error) {
      console.error('Google Vision error:', upstream.status, JSON.stringify((result && result.error) || (data && data.error) || data))
      return res.status(502).json({ error: 'OCR provider error' })
    }

    return res.status(200).json({ text: (result.fullTextAnnotation && result.fullTextAnnotation.text) || '' })
  } catch (error) {
    console.error('Google Vision request failed:', error)
    return res.status(502).json({ error: 'OCR provider unreachable' })
  }
}
