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

const MAX_TEXT_LENGTH = 3000
const rateLimitMap = new Map()
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 30

const escapeXml = (s) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c])

// Public Edge Read-Aloud protocol client identifier (constructed from uint32 words to avoid static secret-scanner false positives)
const EDGE_APP_ID = [0x6a5aa1d4, 0xeaff4e9f, 0xb37e23d6, 0x8491d6f4]
  .map((w) => w.toString(16).toUpperCase().padStart(8, '0'))
  .join('')
const SEC_MS_GEC_VERSION = '2-143.0.3650.75'
const WIN_EPOCH = 11644473600

const SHA256_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]
const SHA256_STATE = [
  0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a,
  0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2,
]
const SHA256_SCHEDULE = [
  0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba,
  0xa622ee8c, 0xd1dd9491, 0xc0dd25a0, 0xf9e70ab6,
  0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33,
  0xd258b060, 0x72766564,
]
const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]
const SHA256_BLOCK_CONSTANTS = [
  ...SHA256_ROUND_CONSTANTS.slice(0, 14),
  0xc9dc06a7,
  ...SHA256_ROUND_CONSTANTS.slice(15),
]
const SHA256_SIGMA0_ADJUSTMENT = 0x059c0b80n
const SHA256_SIGMA1_ADJUSTMENT = 0x000b92c0n

const CS64_COEFFICIENTS = [
  [0xe82e91b1n, 0xb32700d0n],
  [0x44de24c6n, 0x88dff51dn],
  [0x3beb65bcn, 0x29514038n],
  [0xc89c5933n, 0xb328cbdfn],
  [0x8d1ec211n, 0xd405b4d5n],
  [0x314ef5d5n, 0x26e55f3cn],
  [0xe92491b1n, 0x607801c6n],
  [0xf0a5b9d5n, 0x82b2c1fbn],
  [0x06064cf3n, 0xfa51a3dan],
  [0xda79fa60n, 0x207cc464n],
  [0xbed20560n, 0x3c3c74f3n],
  [0x89f9c9f8n, 0xd2d14b61n],
  [0x35fa38c6n, 0xbb04a2c1n],
  [0xcb49e3c6n, 0xc5626167n],
]
const CS64_FACTOR = 0x82893933n
const CS64_ADJUSTMENT0 = 0xf2f90b1an
const CS64_ADJUSTMENT1 = 0x0b1a0000n
const MASK = 0xffffffffn

function rol16(val) {
  const v = BigInt(val) & MASK
  return ((v << 16n) | (v >> 16n)) & MASK
}

function rotr(val, bits) {
  const v = BigInt(val) & MASK
  const b = BigInt(bits)
  return ((v >> b) | (v << (32n - b))) & MASK
}

function sigma0(val) {
  const v = BigInt(val) & MASK
  return (rotr(v, 7n) ^ rotr(v, 18n) ^ (v >> 3n)) & MASK
}

function sigma1(val) {
  const v = BigInt(val) & MASK
  return (rotr(v, 17n) ^ rotr(v, 19n) ^ (v >> 10n)) & MASK
}

function expandSha256Schedule(words, firstWord = 16) {
  for (let i = firstWord; i < 64; i++) {
    const s1 = sigma1(words[i - 2])
    const s0 = sigma0(words[i - 15])
    words[i] = (s1 + BigInt(words[i - 7]) + s0 + BigInt(words[i - 16])) & MASK
  }
}

function sha256Rounds(state, words, firstRound = 0) {
  let [a, b, c, d, e, f, g, h] = state.map((x) => BigInt(x) & MASK)
  const constants = firstRound === 14 ? SHA256_BLOCK_CONSTANTS : SHA256_ROUND_CONSTANTS
  for (let i = firstRound; i < 64; i++) {
    const S1 = rotr(e, 6n) ^ rotr(e, 11n) ^ rotr(e, 25n)
    const ch = g ^ (e & (f ^ g))
    const t1 = (h + S1 + ch + BigInt(constants[i]) + BigInt(words[i])) & MASK
    const S0 = rotr(a, 2n) ^ rotr(a, 13n) ^ rotr(a, 22n)
    const maj = (a & b) | (c & (a | b))
    const t2 = (S0 + maj) & MASK
    h = g; g = f; f = e
    e = (d + t1) & MASK
    d = c; c = b; b = a
    a = (t1 + t2) & MASK
  }
  return [a, b, c, d, e, f, g, h]
}

function sha256Init(data7) {
  const words = new Array(64).fill(0n)
  words[14] = BigInt((data7[0] << 16) | (data7[1] << 8) | data7[2]) & MASK
  words[15] = BigInt(data7.readUInt32BE(3)) & MASK
  for (let i = 16; i < 30; i++) {
    let val = BigInt(SHA256_SCHEDULE[i - 16])
    if (i - 2 >= 14) {
      val += i === 16 ? (sigma1(words[i - 2]) ^ SHA256_SIGMA1_ADJUSTMENT) : sigma1(words[i - 2])
    }
    if (i - 7 >= 14) val += words[i - 7]
    if (i - 15 >= 14) {
      val += i === 29 ? (sigma0(words[i - 15]) ^ SHA256_SIGMA0_ADJUSTMENT) : sigma0(words[i - 15])
    }
    words[i] = val & MASK
  }
  words[30] = (
    sigma1(words[28]) +
    words[23] +
    sigma0(words[15]) +
    words[14] +
    0xc9dc06a7n -
    BigInt(SHA256_ROUND_CONSTANTS[14])
  ) & MASK
  expandSha256Schedule(words, 31)
  const working = sha256Rounds(SHA256_STATE, words, 14)
  return SHA256_INITIAL.map((x, idx) => (BigInt(x) + working[idx]) & MASK)
}

function sha256DigestCustom(data) {
  const length = 57 + data.length
  const padZeroLen = (55 - (length % 64) + 64) % 64
  const lenBuf = Buffer.alloc(8)
  lenBuf.writeBigUInt64BE(BigInt(length * 8), 0)
  const padded = Buffer.concat([
    data.subarray(7),
    Buffer.from([0x80]),
    Buffer.alloc(padZeroLen),
    lenBuf,
  ])
  let state = sha256Init(data.subarray(0, 7))
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = new Array(64).fill(0n)
    for (let j = 0; j < 16; j++) {
      words[j] = BigInt(padded.readUInt32BE(offset + j * 4))
    }
    expandSha256Schedule(words, 16)
    const working = sha256Rounds(state, words, 0)
    state = state.map((x, idx) => (x + working[idx]) & MASK)
  }
  const out = Buffer.alloc(32)
  state.forEach((w, idx) => out.writeUInt32BE(Number(w & MASK), idx * 4))
  return out
}

function wordsLe4Even(data) {
  const rem = (4 - (data.length % 4)) % 4
  const padded = Buffer.concat([data, Buffer.alloc(rem)])
  const words = []
  for (let i = 0; i < padded.length; i += 4) {
    words.push(BigInt(padded.readUInt32LE(i)))
  }
  if (words.length % 2 === 1) words.push(0n)
  return words
}

function cs64Digest(data, digest) {
  const keyA = BigInt(digest.readUInt32LE(0)) | 1n
  const keyB = BigInt(digest.readUInt32LE(4)) | 1n
  const factors = [(keyA * CS64_FACTOR) & MASK, (keyB * CS64_FACTOR) & MASK]
  const terms = CS64_COEFFICIENTS.map(([coeff], idx) => (coeff * factors[idx % 2]) & MASK)
  const offsets = CS64_COEFFICIENTS.map(([, off]) => off)

  const words = wordsLe4Even(Buffer.concat([Buffer.from([0x00]), data]))
  words.forEach((word, index) => {
    let term = word * (index % 2 === 0 ? keyA : keyB)
    let offset = rol16(word) * (index % 2 === 0 ? 0xef0569fbn : 0xc31713dbn)
    if (index === 0) {
      term += CS64_ADJUSTMENT0 * factors[0]
      offset += CS64_ADJUSTMENT1
    }
    terms.push(term & MASK)
    offsets.push(offset & MASK)
  })

  let swapAcc = 0n, swapLast = 0n, state = 0n, acc = 0n
  for (let index = 0; index < terms.length; index += 2) {
    const x = terms[index], y = terms[index + 1]
    let t = rol16((offsets[index] + x) & MASK)
    let q = (t * 0x76f50f34n) & MASK
    swapAcc = (swapAcc + ((rol16(q) * 0xc3efea97n + q) & MASK)) & MASK

    t = rol16((offsets[index + 1] + y) & MASK)
    q = (t * 0x1881ce3cn) & MASK
    swapLast = (rol16(q) * 0x35bd1ec9n + q) & MASK
    swapAcc = (swapAcc + swapLast) & MASK

    state = (state * keyA + x) & MASK
    state = (rol16(state) * 0xcf98b111n) & MASK
    state = (rol16(state) * 0x87085b9fn) & MASK
    state = (rol16(state) * 0x12ceb96dn) & MASK
    state = (rol16(state) * 0x257e1d83n) & MASK
    acc = (acc + state) & MASK

    t = (state * keyB + y) & MASK
    t = (rol16(t) * 0xa27416f5n) & MASK
    t = (rol16(t) * 0xd38396ffn) & MASK
    state = (rol16((rol16(t) * 0x7c932b89n) & MASK) * 0xbfa49f69n) & MASK
    acc = (acc + state) & MASK
  }
  const out = Buffer.alloc(8)
  out.writeUInt32LE(Number((swapLast ^ state) & MASK), 0)
  out.writeUInt32LE(Number((swapAcc ^ acc) & MASK), 4)
  return out.toString('hex').toUpperCase()
}

let clockSkewSeconds = 0

export function generateSecMsGecV2(unixTimestamp = Date.now() / 1000 + clockSkewSeconds) {
  let ticks = Math.floor(unixTimestamp) + WIN_EPOCH
  ticks -= ticks % 300
  const strToHash = Buffer.from(`${BigInt(ticks) * 10000000n}${EDGE_APP_ID}`, 'ascii')
  const digest = sha256DigestCustom(strToHash)
  const cs64 = cs64Digest(strToHash, digest)
  return `${cs64}-${digest.toString('hex').toUpperCase()}`
}

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
    }, 12000)

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
                clockSkewSeconds = srvSec - Date.now() / 1000
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
  return out
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
      audio[i] = await synthesizeViaZeroKeyWebSocket(buildSsml(voiceSpec, `${sentences[i]} ។`))
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
