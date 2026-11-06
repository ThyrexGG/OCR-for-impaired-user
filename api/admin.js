/**
 * Data for the admin panel (/admin on the website). Needs SONGKHEM_ADMIN_PASSWORD on the server, sent as
 * "Authorization: Bearer <password>". Reports which settings are configured (never their values), usage counts
 * from api/_stats.js, and the deployment that is live.
 */
import crypto from 'node:crypto'
import { OCR_MONTHLY_CAP, STATS_ENABLED, billingMonth, localDay, redis } from './_stats.js'

const DAYS_SHOWN = 30

const sameText = (a, b) => {
  const x = crypto.createHash('sha256').update(a).digest()
  const y = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(x, y)
}

// Pairs from HGETALL arrive flat: [field, value, field, value, ...]
const toCounts = (flat) => {
  const out = {}
  for (let i = 0; flat && i < flat.length; i += 2) out[flat[i]] = Number(flat[i + 1]) || 0
  return out
}

// Start of the next Pacific-time month, when Google's free tier (and our cap) starts again
const nextBillingMonthStart = () => {
  const [y, m] = billingMonth().split('-').map(Number)
  const guess = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 8) // 00:00 PST is 08:00 UTC
  // In daylight time the month starts an hour earlier (07:00 UTC)
  return billingMonth(new Date(guess - 3600 * 1000)) === billingMonth() ? new Date(guess) : new Date(guess - 3600 * 1000)
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const password = process.env.SONGKHEM_ADMIN_PASSWORD
  if (!password) return res.status(503).json({ error: 'Admin panel is not set up', code: 'not_configured' })
  const sent = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!sent || !sameText(sent, password)) {
    await new Promise((r) => setTimeout(r, 600)) // slow down password guessing
    return res.status(401).json({ error: 'Wrong password', code: 'unauthorized' })
  }

  const appPasses = (process.env.SONGKHEM_APP_KEY || '').split(',').filter((s) => s.trim()).length
  const report = {
    generatedAt: new Date().toISOString(),
    deployment: {
      env: process.env.VERCEL_ENV || 'local',
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7),
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE || '',
      branch: process.env.VERCEL_GIT_COMMIT_REF || '',
      region: process.env.VERCEL_REGION || '',
    },
    config: {
      googleVisionKey: Boolean(process.env.GOOGLE_VISION_API_KEY),
      azureTtsKey: Boolean(process.env.AZURE_TTS_API_KEY),
      appPasses,
      storage: STATS_ENABLED,
      monthlyCap: OCR_MONTHLY_CAP,
    },
    quota: { month: billingMonth(), used: null, cap: OCR_MONTHLY_CAP, resetsAt: nextBillingMonthStart().toISOString() },
    month: null,
    days: [],
    recent: [],
  }
  if (!STATS_ENABLED) return res.status(200).json(report)

  const days = []
  for (let i = DAYS_SHOWN - 1; i >= 0; i--) days.push(localDay(new Date(Date.now() - i * 86400 * 1000)))
  try {
    const replies = await redis([
      ['GET', `ocr:count:${billingMonth()}`],
      ['HGETALL', `stats:m:${localDay().slice(0, 7)}`],
      ['LRANGE', 'stats:recent', 0, -1],
      ...days.map((d) => ['HGETALL', `stats:d:${d}`]),
    ])
    const [used, month, recent, ...daily] = replies
    report.quota.used = Number(used) || 0
    report.month = toCounts(month)
    report.recent = (recent || []).map((line) => {
      try {
        return JSON.parse(line)
      } catch (_) {
        return null
      }
    }).filter(Boolean)
    report.days = days.map((date, i) => ({ date, ...toCounts(daily[i]) }))
  } catch (error) {
    report.storageError = error.message
  }
  return res.status(200).json(report)
}
