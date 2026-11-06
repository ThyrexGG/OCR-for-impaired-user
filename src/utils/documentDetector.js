// Kept identical to mobile/src/utils/documentDetector.js (the phone app's copy): fix both together.
/**
 * Finds a page in a small greyscale picture of the camera view, for the red outline drawn around it.
 *
 * The camera view (native view in the app, the <video> on the website) hands over a ~72x96 brightness grid (not the full frame: this runs several times a
 * second). A page is the biggest blob that is clearly brighter, or darker, than what surrounds it, so the
 * picture is split in two with Otsu's threshold, each side is cut into connected blobs, and the blob whose
 * outline is closest to a four-cornered shape wins. Everything is in grid cells, results are 0..1 fractions
 * of the view so they do not depend on the grid's size.
 */

const MIN_AREA = 0.08 // a page smaller than this share of the view is not worth outlining
const MAX_AREA = 0.95 // bigger is the background, not a page
const MIN_QUAD_FIT = 0.85 // four corners must hug the blob's outline
const MIN_SOLIDITY = 0.55 // text holes are fine, a sprawling blob is not
const MAX_BORDER_SHARE = 0.35 // a blob hugging the view's edges is the background, not a page
const MIN_CONTRAST = 22

const blur3 = (luma, w, h) => {
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          sum += luma[yy * w + xx]
          n++
        }
      }
      out[y * w + x] = sum / n
    }
  }
  return out
}

// Otsu: the threshold that best separates the picture into a dark and a bright group
const otsu = (values) => {
  const hist = new Float64Array(256)
  for (let i = 0; i < values.length; i++) hist[Math.max(0, Math.min(255, Math.round(values[i])))]++
  const total = values.length
  let sumAll = 0
  for (let t = 0; t < 256; t++) sumAll += t * hist[t]
  let wB = 0
  let sumB = 0
  let best = -1
  let threshold = 127
  let meanLo = 0
  let meanHi = 0
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sumAll - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > best) {
      best = between
      threshold = t
      meanLo = mB
      meanHi = mF
    }
  }
  return { threshold, contrast: meanHi - meanLo }
}

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

const convexHull = (points) => {
  const pts = points.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1])
  const lower = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

const polygonArea = (poly) => {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p[0] * q[1] - q[0] * p[1]
  }
  return Math.abs(a) / 2
}

// Connected blobs (4-neighbour) of the cells where mask is 1 -> [{ cells, area }]
const blobsOf = (mask, w, h) => {
  const seen = new Uint8Array(w * h)
  const blobs = []
  const stack = []
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue
    const cells = []
    stack.push(start)
    seen[start] = 1
    while (stack.length) {
      const c = stack.pop()
      cells.push(c)
      const x = c % w
      const y = (c - x) / w
      if (x > 0 && mask[c - 1] && !seen[c - 1]) (seen[c - 1] = 1), stack.push(c - 1)
      if (x < w - 1 && mask[c + 1] && !seen[c + 1]) (seen[c + 1] = 1), stack.push(c + 1)
      if (y > 0 && mask[c - w] && !seen[c - w]) (seen[c - w] = 1), stack.push(c - w)
      if (y < h - 1 && mask[c + w] && !seen[c + w]) (seen[c + w] = 1), stack.push(c + w)
    }
    blobs.push({ cells, area: cells.length })
  }
  return blobs
}

// Outline of a blob as the corner points of its edge cells
const outlinePoints = (blob, mask, w, h) => {
  const points = []
  let edgeCells = 0
  let borderCells = 0
  for (const c of blob.cells) {
    const x = c % w
    const y = (c - x) / w
    const onBorder = x === 0 || y === 0 || x === w - 1 || y === h - 1
    const edge = onBorder || !mask[c - 1] || !mask[c + 1] || !mask[c - w] || !mask[c + w]
    if (!edge) continue
    edgeCells++
    if (onBorder) borderCells++
    points.push([x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1])
  }
  return { points, borderShare: borderCells / Math.max(1, edgeCells) }
}

const quadOf = (hull) => {
  const n = hull.length
  const pick = (score) => {
    let best = 0
    for (let i = 1; i < n; i++) if (score(hull[i]) > score(hull[best])) best = i
    return best
  }
  // hull indices in ascending order: the four diagonal extremes
  let idx = [pick((p) => -(p[0] + p[1])), pick((p) => p[0] - p[1]), pick((p) => p[0] + p[1]), pick((p) => p[1] - p[0])]
  idx = [...new Set(idx)].sort((a, b) => a - b)
  if (idx.length < 4) return null

  // Slide each corner between its neighbours to the hull vertex that gives the largest quad: a page turned at
  // an angle has corners the diagonal extremes only approximate
  for (let round = 0; round < 3; round++) {
    for (let k = 0; k < 4; k++) {
      const prev = idx[(k + 3) % 4]
      const next = idx[(k + 1) % 4]
      let bestI = idx[k]
      let bestArea = -1
      for (let i = (prev + 1) % n; i !== next; i = (i + 1) % n) {
        const trial = idx.slice()
        trial[k] = i
        const area = polygonArea(trial.map((j) => hull[j]))
        if (area > bestArea) {
          bestArea = area
          bestI = i
        }
      }
      idx[k] = bestI
    }
  }

  // Name the corners as seen on screen: top-left first, then clockwise
  const quad = idx.map((j) => hull[j])
  const cx = quad.reduce((s, p) => s + p[0], 0) / 4
  const cy = quad.reduce((s, p) => s + p[1], 0) / 4
  quad.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx))
  let first = 0
  for (let i = 1; i < 4; i++) if (quad[i][0] + quad[i][1] < quad[first][0] + quad[first][1]) first = i
  return [0, 1, 2, 3].map((i) => quad[(first + i) % 4])
}

const isConvexQuad = (q) => {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const c = cross(q[i], q[(i + 1) % 4], q[(i + 2) % 4])
    if (c === 0) return false
    const s = c > 0 ? 1 : -1
    if (sign && s !== sign) return false
    sign = s
  }
  return true
}

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1])

/**
 * @param {Uint8Array} luma w*h brightness values, row by row
 * @returns {{x:number,y:number}[] | null} corners (top-left, top-right, bottom-right, bottom-left) as 0..1 fractions
 */
export function detectDocument(luma, w, h) {
  const smooth = blur3(luma, w, h)
  const { threshold, contrast } = otsu(smooth)
  if (contrast < MIN_CONTRAST) return null

  const total = w * h
  let best = null
  for (const bright of [true, false]) {
    const mask = new Uint8Array(total)
    for (let i = 0; i < total; i++) mask[i] = bright ? (smooth[i] > threshold ? 1 : 0) : smooth[i] <= threshold ? 1 : 0

    for (const blob of blobsOf(mask, w, h)) {
      if (blob.area / total < MIN_AREA) continue
      const { points, borderShare } = outlinePoints(blob, mask, w, h)
      if (borderShare > MAX_BORDER_SHARE) continue
      const hull = convexHull(points)
      if (hull.length < 4) continue
      const hullArea = polygonArea(hull)
      if (hullArea / total > MAX_AREA + 0.04) continue

      const quad = quadOf(hull)
      if (!quad || !isConvexQuad(quad)) continue
      const quadArea = polygonArea(quad)
      const share = quadArea / total
      if (share < MIN_AREA || share > MAX_AREA) continue
      const fit = quadArea / hullArea
      const solidity = blob.area / hullArea
      if (fit < MIN_QUAD_FIT || solidity < MIN_SOLIDITY) continue
      const shortSide = Math.min(dist(quad[0], quad[1]), dist(quad[1], quad[2]), dist(quad[2], quad[3]), dist(quad[3], quad[0]))
      if (shortSide < 0.12 * Math.max(w, h)) continue

      const score = quadArea * fit * solidity
      if (!best || score > best.score) best = { score, quad }
    }
  }
  return best ? best.quad.map(([x, y]) => ({ x: x / w, y: y / h })) : null
}

const maxCornerShift = (a, b) => Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y)))

/**
 * Steadies the detector's per-frame guesses so the outline glides instead of jittering, appears only once a page
 * has been seen in consecutive frames, and lingers briefly when a frame misses it.
 */
export class DocumentTracker {
  constructor() {
    this.reset()
  }

  reset() {
    this.corners = null
    this.pending = null
    this.misses = 0
    this.seen = 0
  }

  /** @returns {{corners: {x:number,y:number}[] | null, steady: boolean}} */
  update(found) {
    if (!found) {
      this.pending = null
      if (++this.misses >= 4) {
        this.corners = null
        this.seen = 0
      }
      return { corners: this.corners, steady: this.corners !== null && this.seen >= 3 }
    }
    this.misses = 0

    if (!this.corners) {
      // First sighting: wait for a second frame that agrees before showing anything
      if (this.pending && maxCornerShift(this.pending, found) < 0.1) {
        this.corners = found
        this.pending = null
        this.seen = 2
      } else {
        this.pending = found
      }
    } else if (maxCornerShift(this.corners, found) < 0.15) {
      this.corners = this.corners.map((p, i) => ({ x: p.x + (found[i].x - p.x) * 0.5, y: p.y + (found[i].y - p.y) * 0.5 }))
      this.seen++
      this.pending = null
    } else if (this.pending && maxCornerShift(this.pending, found) < 0.1) {
      // The page moved a long way and stayed there: jump to it
      this.corners = found
      this.pending = null
      this.seen = 1
    } else {
      this.pending = found
    }
    return { corners: this.corners, steady: this.corners !== null && this.seen >= 3 }
  }
}

// ---- Framing: is the whole page in view, and if not, which way should the phone move? ----
// Cutting the photo down to the page is only safe when the whole page is clearly inside the picture; anything
// else would risk cutting text away, so the camera then keeps the whole photo and tells the user how to move.
const EDGE_MARGIN = 0.03 // a corner closer than this to the picture's edge means the page may run off it
const MIN_CROP_AREA = 0.12 // smaller: ask to come closer (the text would be tiny), and don't crop
const MAX_CROP_AREA = 0.9 // bigger: the page nearly fills the picture, cropping gains nothing

/**
 * @param {{x:number,y:number}[] | null} corners page corners (0..1 fractions), top-left clockwise
 * @returns {{ cropSafe: boolean, hint: null | 'left' | 'right' | 'up' | 'down' | 'further' | 'closer' }}
 *   hint: which way to move the phone so the whole page is in view and big enough (null = it is)
 */
export function assessFraming(corners) {
  if (!corners || corners.length !== 4) return { cropSafe: false, hint: null }
  const xs = corners.map((p) => p.x)
  const ys = corners.map((p) => p.y)
  const cut = {
    left: Math.min(...xs) < EDGE_MARGIN,
    right: Math.max(...xs) > 1 - EDGE_MARGIN,
    up: Math.min(...ys) < EDGE_MARGIN,
    down: Math.max(...ys) > 1 - EDGE_MARGIN,
  }
  const sides = Object.keys(cut).filter((k) => cut[k])
  const area = polygonArea(corners.map((p) => [p.x, p.y]))
  // Running off two opposite sides (or more than two) means the phone is too close to fit the page
  const hint =
    sides.length > 2 || (cut.left && cut.right) || (cut.up && cut.down)
      ? 'further'
      : sides.length > 0
        ? sides[0]
        : area < MIN_CROP_AREA
          ? 'closer'
          : null
  return { cropSafe: sides.length === 0 && area >= MIN_CROP_AREA && area <= MAX_CROP_AREA, hint }
}
