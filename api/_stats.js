/**
 * Usage counters for the admin panel and the monthly scan cap, kept in Upstash Redis (connected through Vercel
 * Storage, which sets KV_REST_API_URL / KV_REST_API_TOKEN). Without that storage nothing is recorded and there
 * is no monthly cap. Only counts, timings and outcomes are kept: never the photos, the recognized text or IPs
 * (a short salted hash stands in for the caller, so repeat callers can be spotted).
 */
import crypto from 'node:crypto'

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
export const STATS_ENABLED = Boolean(REDIS_URL && REDIS_TOKEN)

// Google's free tier is 1,000 scans a month per billing account; stop a little short of it
export const OCR_MONTHLY_CAP = Number(process.env.OCR_MONTHLY_CAP) || 950
const RECENT_MAX = 150
const DAY_TTL_S = 45 * 24 * 3600
const MONTH_TTL_S = 400 * 24 * 3600
const REDIS_TIMEOUT_MS = 1500

// Google bills by the calendar month in Pacific time; the charts use Cambodia's day
const dateIn = (timeZone, at = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(at) // YYYY-MM-DD
export const billingMonth = (at) => dateIn('America/Los_Angeles', at).slice(0, 7)
export const localDay = (at) => dateIn('Asia/Phnom_Penh', at)

export async function redis(commands) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REDIS_TIMEOUT_MS)
  try {
    const response = await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Redis HTTP ${response.status}`)
    const replies = await response.json()
    const failed = replies.find((r) => r.error)
    if (failed) throw new Error(`Redis: ${failed.error}`)
    return replies.map((r) => r.result)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Counts one scan against this billing month before Google is called.
 * @returns {Promise<{ allowed: boolean, used?: number, reason?: string }>}
 */
export async function takeScan() {
  if (!STATS_ENABLED) return { allowed: true }
  const key = `ocr:count:${billingMonth()}`
  try {
    const [used] = await redis([['INCR', key], ['EXPIRE', key, MONTH_TTL_S]])
    if (used <= OCR_MONTHLY_CAP) return { allowed: true, used }
    await redis([['DECR', key]]) // a refused scan is not a billed one
    return { allowed: false, used: OCR_MONTHLY_CAP, reason: 'monthly_limit' }
  } catch (error) {
    // Cannot count, so cannot promise the scan is free: refuse rather than risk a bill
    console.error('Scan counter unavailable:', error)
    return { allowed: false, reason: 'counter_unavailable' }
  }
}

export const callerTag = (req) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
  const salt = process.env.SONGKHEM_ADMIN_PASSWORD || ''
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 8)
}

/**
 * Records one request. `outcome` is one of: ok, fail, denied (old app), limited (too fast), capped (monthly cap).
 * Never throws and gives up quickly, so stats can never slow down or break a scan.
 */
export async function record(req, kind, outcome, extra = {}) {
  if (!STATS_ENABLED) return
  const day = localDay()
  const month = day.slice(0, 7)
  const source = req.headers['x-songkhem-app-key'] ? 'app' : req.headers.origin ? 'web' : 'unknown'
  const fields = [`${kind}_${outcome}`, `${kind}_${source}`]
  const event = {
    t: Date.now(),
    kind,
    outcome,
    source,
    who: callerTag(req),
    country: req.headers['x-vercel-ip-country'] || '',
    ...extra,
  }
  const commands = []
  for (const key of [`stats:d:${day}`, `stats:m:${month}`]) {
    for (const field of fields) commands.push(['HINCRBY', key, field, 1])
    if (extra.ms) commands.push(['HINCRBY', key, `${kind}_ms`, Math.round(extra.ms)], ['HINCRBY', key, `${kind}_timed`, 1])
    commands.push(['EXPIRE', key, key.startsWith('stats:d:') ? DAY_TTL_S : MONTH_TTL_S])
  }
  commands.push(['LPUSH', 'stats:recent', JSON.stringify(event)], ['LTRIM', 'stats:recent', 0, RECENT_MAX - 1])
  try {
    await redis(commands)
  } catch (error) {
    console.warn('Could not record usage:', error.message)
  }
}
