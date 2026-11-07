/**
 * Vercel Serverless Function: Khmer Neural TTS Endpoint (/api/tts)
 * ================================================================
 * Supports 2 automatic modes:
 *   1. Paid Azure Speech Key (process.env.AZURE_TTS_API_KEY) -> Direct REST call
 *   2. Zero-Key Neural WebSocket Fallback (Sec-MS-GEC v2 CS64+SHA256 signed TLS WebSocket)
 *      with automatic RFC 2616 Date clock-skew adjustment so deployed Vercel / iPhone / Android
 *      builds ALWAYS speak 24kHz Khmer even when AZURE_TTS_API_KEY is not configured!
 */

import crypto from 'node:crypto'
import tls from 'node:tls'
import { normalizeKhmerForSpeech, applyAssistivePacing } from '../src/services/khmerNormalizer.js'
import { isAllowedCaller, rejectCaller } from './_appAccess.js'
import { record } from './_stats.js'

const VOICES = {
  'km-KH-PisethNeural': { baseVoice: 'km-KH-PisethNeural', pitch: '+0Hz', rate: '+0%', pace: false },
  'km-KH-SreymomNeural': { baseVoice: 'km-KH-SreymomNeural', pitch: '+0Hz', rate: '+0%', pace: false },
  'km-KH-SokhaMedical': { baseVoice: 'km-KH-PisethNeural', pitch: '-10Hz', rate: '-8%', pace: true },
  'km-KH-VitsOffline': { baseVoice: 'km-KH-PisethNeural', pitch: '+6Hz', rate: '-4%', pace: false },
}

const MAX_TEXT_LENGTH = 30000
const rateLimitMap = new Map()
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 30

const escapeXml = (s) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c])

import {
  EDGE_APP_ID,
  SEC_MS_GEC_VERSION,
  generateSecMsGecV2,
  setClockSkewSeconds,
} from './_edgeToken.js'

export { generateSecMsGecV2 }

/**
 * Pure Node.js TLS WebSocket client for zero-key 24kHz Khmer neural synthesis.
 */
function synthesizeViaZeroKeyWebSocket(ssml, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const reqId = crypto.randomBytes(16).toString('hex')
    const muid = crypto.randomBytes(16).toString('hex').toUpperCase()
    const secMsGec = generateSecMsGecV2()
    const host = 'speech.platform.bing.com'
    const path = `/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${EDGE_APP_ID}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${reqId}`
    const wsKey = crypto.randomBytes(16).toString('base64')

    const socket = tls.connect(443, host, { servername: host }, () => {
      const handshake = [
        `GET ${path} HTTP/1.1`,
        `Host: ${host}`,
        'Pragma: no-cache',
        'Cache-Control: no-cache',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${wsKey}`,
        'Sec-WebSocket-Version: 13',
        'Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        `Cookie: muid=${muid};`,
        '\r\n',
      ].join('\r\n')
      socket.write(handshake)
    })

    let upgraded = false
    let rawBuffer = Buffer.alloc(0)
    const audioChunks = []

    function sendWsTextFrame(text) {
      const payload = Buffer.from(text, 'utf8')
      const mask = crypto.randomBytes(4)
      let header
      if (payload.length < 126) {
        header = Buffer.from([0x81, 0x80 | payload.length])
      } else if (payload.length < 65536) {
        header = Buffer.alloc(4)
        header[0] = 0x81
        header[1] = 0x80 | 126
        header.writeUInt16BE(payload.length, 2)
      } else {
        header = Buffer.alloc(10)
        header[0] = 0x81
        header[1] = 0x80 | 127
        header.writeBigUInt64BE(BigInt(payload.length), 2)
      }
      const masked = Buffer.alloc(payload.length)
      for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4]
      socket.write(Buffer.concat([header, mask, masked]))
    }

    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error('WebSocket TTS timeout'))
    }, 30000)

    socket.on('data', (chunk) => {
      rawBuffer = Buffer.concat([rawBuffer, chunk])

      if (!upgraded) {
        const idx = rawBuffer.indexOf('\r\n\r\n')
        if (idx !== -1) {
          const headerStr = rawBuffer.subarray(0, idx).toString('utf8')
          if (!headerStr.includes('101 Switching Protocols')) {
            clearTimeout(timeout)
            socket.destroy()
            const dateMatch = headerStr.match(/^Date:\s*(.+)$/im)
            if (dateMatch && retryCount < 1) {
              const srvSec = Date.parse(dateMatch[1].trim()) / 1000
              if (Number.isFinite(srvSec)) {
                setClockSkewSeconds(srvSec - Date.now() / 1000)
                return synthesizeViaZeroKeyWebSocket(ssml, retryCount + 1).then(resolve, reject)
              }
            }
            return reject(new Error('WebSocket upgrade rejected: ' + headerStr.split('\r\n')[0]))
          }
          upgraded = true
          rawBuffer = rawBuffer.subarray(idx + 4)

          const cfgMsg =
            `X-Timestamp:${new Date().toUTCString()}\r\n` +
            'Content-Type:application/json; charset=utf-8\r\n' +
            'Path:speech.config\r\n\r\n' +
            JSON.stringify({
              context: {
                synthesis: {
                  audio: {
                    metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
                    outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
                  },
                },
              },
            })
          sendWsTextFrame(cfgMsg)

          const ssmlMsg =
            `X-RequestId:${reqId}\r\n` +
            'Content-Type:application/ssml+xml\r\n' +
            `X-Timestamp:${new Date().toUTCString()}Z\r\n` +
            'Path:ssml\r\n\r\n' +
            ssml
          sendWsTextFrame(ssmlMsg)
        }
      }

      while (upgraded && rawBuffer.length >= 2) {
        const byte0 = rawBuffer[0]
        const byte1 = rawBuffer[1]
        const opcode = byte0 & 0x0f
        let payloadLen = byte1 & 0x7f
        let offset = 2

        if (payloadLen === 126) {
          if (rawBuffer.length < 4) break
          payloadLen = rawBuffer.readUInt16BE(2)
          offset = 4
        } else if (payloadLen === 127) {
          if (rawBuffer.length < 10) break
          payloadLen = Number(rawBuffer.readBigUInt64BE(2))
          offset = 10
        }

        if (rawBuffer.length < offset + payloadLen) break
        const frameData = rawBuffer.subarray(offset, offset + payloadLen)
        rawBuffer = rawBuffer.subarray(offset + payloadLen)

        if (opcode === 0x01) {
          const txt = frameData.toString('utf8')
          if (txt.includes('Path:turn.end')) {
            clearTimeout(timeout)
            socket.end()
            return resolve(Buffer.concat(audioChunks))
          }
        } else if (opcode === 0x02 && frameData.length >= 2) {
          const headerLen = frameData.readUInt16BE(0)
          const headerTxt = frameData.subarray(2, 2 + headerLen).toString('utf8')
          if (headerTxt.includes('Path:audio')) {
            audioChunks.push(frameData.subarray(2 + headerLen))
          }
        } else if (opcode === 0x08) {
          clearTimeout(timeout)
          socket.end()
          return resolve(Buffer.concat(audioChunks))
        }
      }
    })

    socket.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

// The zero-key voice service rejects every SSML tag except <prosody>, so <break> is not available and
// the Khmer full stop adds no pause by itself. Sentences are synthesized one by one instead and joined
// with real silence, which is what gives long text its natural breathing.
// 24 kHz mono MPEG-2 Layer III at 48 kbps is the format requested above: 144-byte frames of 24 ms each.
const SILENT_FRAME = Buffer.concat([Buffer.from([0xff, 0xf3, 0x64, 0xc4]), Buffer.alloc(140)])
const FRAME_BYTES = 144
const SENTENCE_PAUSE_MS = 260
const KEEP_TAIL_FRAMES = 4 // ~100 ms of natural fade after the last spoken frame
const MIN_SENTENCE_CHARS = 8
const MAX_PARALLEL_SENTENCES = 8
const MAX_CHUNK_CHARS = 250 // large pieces can outlast the socket timeout, so long lists and tables with no full stop never spoke

const silenceMp3 = (ms) => Buffer.concat(Array(Math.max(1, Math.round(ms / 24))).fill(SILENT_FRAME))

// part2_3_length (bits of audio data) of frame f, read from the 12 bits after the 4-byte header, main_data_begin and private bit
const frameAudioBits = (buf, start) => {
  const o = start + 4
  return ((buf[o + 1] & 0x7f) << 5) | (buf[o + 2] >> 3)
}

/**
 * The voice ends every clip with about a second of silence, which would make the gaps between sentences far
 * too long. Frames with no audio data after the last spoken frame are dropped; the pause is then added back at
 * a controlled length. Anything that does not look like the expected frame layout is returned untouched.
 */
export function trimTrailingSilence(buf) {
  // Walk the real frame headers (a frame can carry a padding byte), so one odd frame cannot disable trimming
  const starts = []
  let at = 0
  while (at + 4 <= buf.length) {
    if (buf[at] !== 0xff || buf[at + 1] !== 0xf3 || (buf[at + 2] & 0xfc) !== 0x64) break
    const len = FRAME_BYTES + ((buf[at + 2] >> 1) & 1)
    if (at + len > buf.length) break
    starts.push(at)
    at += len
  }
  if (starts.length < 8 || at !== buf.length) return buf // not the expected stream: leave it alone

  let last = starts.length - 1
  while (last > 0 && frameAudioBits(buf, starts[last]) < 24) last--
  const keep = Math.min(starts.length, last + 1 + KEEP_TAIL_FRAMES)
  return keep === starts.length ? buf : buf.subarray(0, starts[keep])
}

// Cuts at a space. With none nearby it cuts before a base consonant, never between a letter and its subscript (after U+17D2) or vowel signs.
const findCut = (text) => {
  const lastWhere = (isCut) => {
    for (let i = MAX_CHUNK_CHARS; i > MAX_CHUNK_CHARS / 2; i--) if (isCut(i)) return i
    return -1
  }
  const atSpace = lastWhere((i) => /\s/.test(text[i]))
  if (atSpace !== -1) return atSpace
  const atLetter = lastWhere((i) => /[ក-អ]/.test(text[i]) && text[i - 1] !== '្')
  return atLetter !== -1 ? atLetter : MAX_CHUNK_CHARS
}

const chopLongPiece = (piece) => {
  const chunks = []
  let rest = piece
  while (rest.length > MAX_CHUNK_CHARS) {
    const cut = findCut(rest)
    chunks.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) chunks.push(rest)
  return chunks
}

export function splitIntoSentences(text) {
  const parts = text.split(/\s*។\s*/).map((p) => p.trim()).filter(Boolean)
  const out = []
  let carry = ''
  // Tiny fragments (list numbers, one-word lines) ride along with a neighbour instead of getting their own pause
  for (const p of parts) {
    const piece = carry ? `${carry} , ${p}` : p
    if (piece.length < MIN_SENTENCE_CHARS) {
      carry = piece
    } else {
      out.push(piece)
      carry = ''
    }
  }
  if (carry) {
    if (out.length) out[out.length - 1] += ` , ${carry}`
    else out.push(carry)
  }
  return out.flatMap(chopLongPiece)
}

const buildSsml = (voiceSpec, text) =>
  `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='km-KH'>` +
  `<voice name='${voiceSpec.baseVoice}'><prosody pitch='${voiceSpec.pitch}' rate='${voiceSpec.rate}'>${escapeXml(text)}</prosody></voice>` +
  `</speak>`

async function synthesizeWithPauses(text, voiceSpec) {
  const sentences = splitIntoSentences(text)
  if (sentences.length < 2) return trimTrailingSilence(await synthesizeViaZeroKeyWebSocket(buildSsml(voiceSpec, text)))

  const audio = new Array(sentences.length)
  let next = 0
  const worker = async () => {
    while (next < sentences.length) {
      const i = next++
      const ssml = buildSsml(voiceSpec, `${sentences[i]} ។`)
      // One stalled connection should not cost the whole page
      audio[i] = await synthesizeViaZeroKeyWebSocket(ssml).catch(() => synthesizeViaZeroKeyWebSocket(ssml))
      if (!audio[i] || !audio[i].length) throw new Error('Empty audio for a sentence')
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_SENTENCES, sentences.length) }, worker))

  const pause = silenceMp3(SENTENCE_PAUSE_MS)
  return Buffer.concat(audio.flatMap((a, i) => (i ? [pause, trimTrailingSilence(a)] : [trimTrailingSilence(a)])))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAllowedCaller(req)) {
    await record(req, 'tts', 'denied')
    return rejectCaller(res)
  }

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

  if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
    await record(req, 'tts', 'limited')
    return res.status(429).json({ error: 'Too many requests. សូមរង់ចាំបន្តិចមុននឹងព្យាយាមម្តងទៀត។' })
  }

  const rawText = req.body && req.body.text
  const voice = (req.body && req.body.voice) || 'km-KH-PisethNeural'
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return res.status(400).json({ error: 'Missing or empty text' })
  }

  const voiceSpec = VOICES[voice]
  if (!voiceSpec) {
    return res.status(400).json({ error: 'Unsupported voice' })
  }

  const cappedText = rawText.length > MAX_TEXT_LENGTH ? rawText.slice(0, MAX_TEXT_LENGTH) : rawText
  const shouldPace = voiceSpec.pace || Boolean(req.body && req.body.assistive_pacing)
  const preText = shouldPace ? applyAssistivePacing(cappedText) : cappedText
  const text = normalizeKhmerForSpeech(preText)

  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='km-KH'>` +
    `<voice name='${voiceSpec.baseVoice}'><prosody pitch='${voiceSpec.pitch}' rate='${voiceSpec.rate}'>${escapeXml(text)}</prosody></voice>` +
    `</speak>`

  const apiKey = process.env.AZURE_TTS_API_KEY
  const started = Date.now()
  const usage = { voice, chars: cappedText.length }

  // Mode 1: Paid Azure REST API (if configured)
  if (apiKey) {
    const endpoint = process.env.AZURE_TTS_ENDPOINT || 'https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1'
    try {
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
        },
        body: ssml,
      })

      if (upstream.ok) {
        const audio = Buffer.from(await upstream.arrayBuffer())
        await record(req, 'tts', 'ok', { ...usage, ms: Date.now() - started, via: 'azure' })
        res.setHeader('Content-Type', 'audio/mpeg')
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400')
        return res.status(200).send(audio)
      }
    } catch (err) {
      console.warn('Azure key request failed, falling back to zero-key neural stream:', err)
    }
  }

  // Mode 2: Zero-Key Neural WebSocket Stream Fallback (Always works on Vercel / iPhone)
  try {
    let audioBuffer
    try {
      audioBuffer = await synthesizeWithPauses(text, voiceSpec)
    } catch (chunkErr) {
      console.warn('Sentence-by-sentence synthesis failed, retrying as one block:', chunkErr)
      audioBuffer = await synthesizeViaZeroKeyWebSocket(ssml)
    }
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio stream returned')
    }
    await record(req, 'tts', 'ok', { ...usage, ms: Date.now() - started, via: 'edge' })
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400')
    return res.status(200).send(audioBuffer)
  } catch (error) {
    console.error('Serverless Khmer TTS fallback failed:', error)
    await record(req, 'tts', 'fail', { ...usage, ms: Date.now() - started })
    return res.status(502).json({ error: 'TTS provider unreachable' })
  }
}
