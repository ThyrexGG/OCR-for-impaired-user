// Run with: node mobile/src/utils/documentDetector.test.mjs
// Checks the page finder on synthetic brightness pictures (the same 72x96 grid the camera view streams).
import assert from 'node:assert/strict'
import { detectDocument, DocumentTracker } from './documentDetector.js'

const W = 72, H = 96
let seed = 7
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const inside = (q, x, y) => {
  let s = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4]
    const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])
    if (c === 0) continue
    if (!s) s = c > 0 ? 1 : -1
    else if ((c > 0 ? 1 : -1) !== s) return false
  }
  return true
}
const make = (q, bg, fg, text) => {
  const a = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = inside(q, x + 0.5, y + 0.5) ? fg : bg
    if (text && inside(q, x + .5, y + .5) && (y % 6 === 2 || y % 6 === 3) && x % 9 < 6) v = bg + 30
    a[y * W + x] = Math.max(0, Math.min(255, v + (rnd() - 0.5) * 14))
  }
  return a
}
const err = (found, q) => found ? Math.max(...found.map((p, i) => Math.hypot(p.x * W - q[i][0], p.y * H - q[i][1]))) : null
const cases = [
  ['white page on dark desk, text', [[14,12],[58,18],[54,82],[10,76]], 45, 205, true],
  ['dark page on light desk', [[16,14],[60,12],[56,78],[12,80]], 215, 50, false],
  ['page almost filling view', [[4,5],[68,4],[67,90],[5,92]], 60, 220, true],
  ['small page (about 11%)', [[24,30],[50,32],[48,62],[22,60]], 50, 210, true],
  ['tilted 30 degrees', [[30,10],[62,26],[44,86],[8,62]], 40, 200, false],
  ['tilted 45 degrees', [[36,6],[66,38],[34,90],[6,52]], 50, 210, true],
]

const MAX_CORNER_ERROR_CELLS = 4 // of a 72x96 grid, about 4% of the picture
for (const [name, q, bg, fg, text] of cases) {
  const found = detectDocument(make(q, bg, fg, text), W, H)
  assert.ok(found, name + ': page not found')
  assert.ok(err(found, q) < MAX_CORNER_ERROR_CELLS, name + ': corner off by ' + err(found, q).toFixed(2) + ' cells')
}

const noise = new Uint8Array(W * H).map(() => 120 + rnd() * 20)
assert.equal(detectDocument(noise, W, H), null, 'flat noise must not look like a page')
const grad = new Uint8Array(W * H).map((_, i) => 40 + ((i % W) / W) * 160)
assert.equal(detectDocument(grad, W, H), null, 'a plain gradient must not look like a page')

const tracker = new DocumentTracker()
const page = detectDocument(make(cases[0][1], 45, 205, true), W, H)
const seen = [1, 2, 3, 4].map(() => tracker.update(page))
assert.ok(seen[3].corners && seen[3].steady, 'tracker should show a steady outline after repeated sightings')
const gone = [1, 2, 3, 4].map(() => tracker.update(null))
assert.equal(gone[3].corners, null, 'tracker should drop the outline after the page is lost')

console.log('documentDetector: all checks passed')
