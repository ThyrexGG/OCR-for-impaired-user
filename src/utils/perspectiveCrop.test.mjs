// Run with: node src/utils/perspectiveCrop.test.mjs
// A tilted white page with a black square drawn in its top-left quarter must come out upright, filling the result.
import assert from 'node:assert/strict'
import { warpQuad } from './perspectiveCrop.js'

const SW = 400, SH = 300
const src = new Uint8ClampedArray(SW * SH * 4)
// Page corners (pixels), top-left clockwise: a tilted quadrilateral
const page = [{ x: 80, y: 40 }, { x: 330, y: 70 }, { x: 310, y: 260 }, { x: 60, y: 230 }]
const inside = (q, x, y) => {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4]
    const c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)
    if (c === 0) continue
    if (!sign) sign = Math.sign(c)
    else if (Math.sign(c) !== sign) return false
  }
  return true
}
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
// The black mark: the sub-quad covering u,v in [0.1, 0.4] of the page (bilinear is close enough for a test)
const at = (u, v) => lerp(lerp(page[0], page[1], u), lerp(page[3], page[2], u), v)
const mark = [at(0.1, 0.1), at(0.4, 0.1), at(0.4, 0.4), at(0.1, 0.4)]
for (let y = 0; y < SH; y++) {
  for (let x = 0; x < SW; x++) {
    const i = (y * SW + x) * 4
    const v = inside(mark, x, y) ? 0 : inside(page, x, y) ? 255 : 90
    src[i] = src[i + 1] = src[i + 2] = v
    src[i + 3] = 255
  }
}

const corners = page.map((p) => ({ x: p.x / (SW - 1), y: p.y / (SH - 1) }))
const out = warpQuad(src, SW, SH, corners, 500)
const px = (u, v) => out.data[(Math.round(v * (out.height - 1)) * out.width + Math.round(u * (out.width - 1))) * 4]

assert.ok(out.width > out.height, 'the page is wider than tall, so the result should be too')
assert.ok(px(0.25, 0.25) < 40, 'the black mark should land in the top-left quarter')
assert.ok(px(0.75, 0.75) > 215, 'the bottom-right should be white page')
assert.ok(px(0.02, 0.5) > 215 && px(0.98, 0.5) > 215, 'the edges should be page, not background')
console.log('perspectiveCrop: all checks passed', out.width + 'x' + out.height)
