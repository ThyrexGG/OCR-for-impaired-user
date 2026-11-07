/**
 * Edge Read-Aloud Protocol Cryptographic Token Generator (Sec-MS-GEC v2)
 * Pure JavaScript CS64 + SHA-256 implementation for zero-key 24kHz Khmer TTS.
 */

// Public Edge Read-Aloud protocol client identifier
export const EDGE_APP_ID = [0x6a5aa1d4, 0xeaff4e9f, 0xb37e23d6, 0x8491d6f4]
  .map((w) => w.toString(16).toUpperCase().padStart(8, '0'))
  .join('')

export const SEC_MS_GEC_VERSION = '2-143.0.3650.75'
export const WIN_EPOCH = 11644473600

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

export function setClockSkewSeconds(seconds) {
  clockSkewSeconds = seconds
}

export function getClockSkewSeconds() {
  return clockSkewSeconds
}

export function generateSecMsGecV2(unixTimestamp = Date.now() / 1000 + clockSkewSeconds) {
  let ticks = Math.floor(unixTimestamp) + WIN_EPOCH
  ticks -= ticks % 300
  const strToHash = Buffer.from(`${BigInt(ticks) * 10000000n}${EDGE_APP_ID}`, 'ascii')
  const digest = sha256DigestCustom(strToHash)
  const cs64 = cs64Digest(strToHash, digest)
  return `${cs64}-${digest.toString('hex').toUpperCase()}`
}

