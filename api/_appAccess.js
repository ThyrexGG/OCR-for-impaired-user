/**
 * Who may call the paid endpoints. The website calls them from its own pages, so the browser sends an Origin
 * header that matches this host. The Android app sends a pass (EXPO_PUBLIC_APP_KEY, baked in at build time)
 * that must be one of the comma-separated values in SONGKHEM_APP_KEY. Changing that env var cuts off every
 * APK built with an old pass. Without SONGKHEM_APP_KEY set, every caller is let through (local dev, scripts).
 * The files starting with "_" in api/ are helpers, not endpoints.
 */
import crypto from 'node:crypto'

const sameText = (a, b) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

export function isAllowedCaller(req) {
  const passes = (process.env.SONGKHEM_APP_KEY || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!passes.length) return true

  const sent = req.headers['x-songkhem-app-key']
  if (typeof sent === 'string' && passes.some((p) => sameText(sent, p))) return true

  // The website's own pages (production and preview deployments alike)
  const origin = req.headers.origin
  const host = req.headers['x-forwarded-host'] || req.headers.host
  if (typeof origin === 'string' && host) {
    try {
      return new URL(origin).host === host
    } catch (_) {
      return false
    }
  }
  return false
}

export function rejectCaller(res) {
  return res.status(403).json({ error: 'This copy of the app is no longer supported. Please install the latest version.' })
}
