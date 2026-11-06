/**
 * Cuts a page out of a photo and straightens it: the four corners of the page (as 0..1 fractions of the
 * photo, top-left clockwise) are mapped onto a flat rectangle. The website's counterpart of the phone app's
 * native crop (DocCameraView.kt), used on the camera snapshot before it is sent to OCR.
 */

// The outline can sit a little inside the paper: cut well outside it, so text at the page's edge is never clipped
export const CROP_MARGIN = 1.06

export const withMargin = (corners, margin = CROP_MARGIN) => {
  const cx = corners.reduce((sum, p) => sum + p.x, 0) / 4
  const cy = corners.reduce((sum, p) => sum + p.y, 0) / 4
  const clamp = (v) => Math.min(1, Math.max(0, v))
  return corners.map((p) => ({ x: clamp(cx + (p.x - cx) * margin), y: clamp(cy + (p.y - cy) * margin) }))
}

// Maps the unit square (u right, v down) onto the quad p0..p3 (top-left clockwise), Heckbert's square-to-quad
const squareToQuad = ([p0, p1, p2, p3]) => {
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y
  let g = 0
  let h = 0
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const det = dx1 * dy2 - dx2 * dy1
    g = (dx3 * dy2 - dx2 * dy3) / det
    h = (dx1 * dy3 - dx3 * dy1) / det
  }
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x, c = p0.x
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y, f = p0.y
  return (u, v) => {
    const w = g * u + h * v + 1
    return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]
  }
}

/**
 * @param {Uint8ClampedArray} src RGBA pixels of the photo
 * @param {number} sw photo width
 * @param {number} sh photo height
 * @param {{x:number,y:number}[]} corners page corners, 0..1 fractions, top-left clockwise
 * @param {number} maxSide longest side of the result, in pixels
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
 */
export const warpQuad = (src, sw, sh, corners, maxSide = 2000) => {
  const px = corners.map((p) => ({ x: p.x * (sw - 1), y: p.y * (sh - 1) }))
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  let width = Math.max(dist(px[0], px[1]), dist(px[3], px[2]))
  let height = Math.max(dist(px[0], px[3]), dist(px[1], px[2]))
  const shrink = Math.max(1, Math.max(width, height) / maxSide)
  width = Math.max(2, Math.round(width / shrink))
  height = Math.max(2, Math.round(height / shrink))

  const map = squareToQuad(px)
  const out = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1)
    for (let x = 0; x < width; x++) {
      const [fx, fy] = map(x / (width - 1), v)
      // Bilinear sample, clamped to the photo
      const x0 = Math.min(sw - 1, Math.max(0, Math.floor(fx)))
      const y0 = Math.min(sh - 1, Math.max(0, Math.floor(fy)))
      const x1 = Math.min(sw - 1, x0 + 1)
      const y1 = Math.min(sh - 1, y0 + 1)
      const tx = Math.min(1, Math.max(0, fx - x0))
      const ty = Math.min(1, Math.max(0, fy - y0))
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4
      const o = (y * width + x) * 4
      for (let ch = 0; ch < 3; ch++) {
        const top = src[i00 + ch] + (src[i10 + ch] - src[i00 + ch]) * tx
        const bottom = src[i01 + ch] + (src[i11 + ch] - src[i01 + ch]) * tx
        out[o + ch] = top + (bottom - top) * ty
      }
      out[o + 3] = 255
    }
  }
  return { data: out, width, height }
}

/** Canvas wrapper: returns a new canvas holding just the page, straightened. */
export const cropPageFromCanvas = (canvas, corners, maxSide = 2000) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const page = warpQuad(data, canvas.width, canvas.height, corners, maxSide)
  const out = document.createElement('canvas')
  out.width = page.width
  out.height = page.height
  out.getContext('2d').putImageData(new ImageData(page.data, page.width, page.height), 0, 0)
  return out
}
