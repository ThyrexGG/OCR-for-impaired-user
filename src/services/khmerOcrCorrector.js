/**
 * songKHEM-OCR v2.0 — Khmer Vision Pre-Processor & Orthographic Post-OCR Repair Engine
 * ====================================================================================
 * Engineered specifically for Cambodian visually impaired users scanning:
 *   - Medical prescriptions & hospital discharge summaries (មន្ទីរពេទ្យ, ឱសថស្ថាន, វេជ្ជបញ្ជា)
 *   - Pharmacy & store receipts (វិក្កយបត្រ, ៛ Riel, $ USD, quantities, dates)
 *   - Official notices, letters, and books in Khmer + English
 *
 * Three-Stage Accuracy Pipeline:
 *   1. Pre-OCR Vision Filter (`preprocessImageForKhmerOcr`):
 *      - Smart 2x bicubic upscaling for small images (<1500px) so 2px Khmer Coeng subscripts
 *        (្ក, ្រ, ្ល) and upper diacritics (ិ, ី, ឹ, ឺ, ់, ៉, ៊) are never lost.
 *      - Percentile luminance contrast stretching (2nd–98th percentile) to flatten camera shadows
 *        while preserving anti-aliased glyph edges required by Transformer/LSTM OCR models.
 *      - 3x3 Unsharp Mask kernel tuned for Khmer subscript & diacritic stroke sharpening.
 *   2. Multi-Engine Tuned Recognition (`builtin/latest` Google Vision + Tesseract `khm+eng`).
 *   3. Post-OCR Khmer Orthographic & Lexical Repair (`postProcessKhmerOcr`):
 *      - Repairs misordered Khmer Unicode syllable clusters (Vowel+Coeng -> Coeng+Vowel,
 *        Vowel+Shifter -> Shifter+Vowel, split composite vowels េ+ា -> ោ, េ+ី -> ើ).
 *      - Disambiguates Latin/Khmer lookalike digits inside numbers & prices (១O0 -> ១០០).
 *      - Repairs common Cambodian OCR misreads on prescriptions, receipts, and compound words.
 */

const KHMER_OCR_PHRASE_CORRECTIONS = [
  // Common spaced/broken compound words from receipt & prescription OCR
  [/ឱសថ\s+ស្ថាន/g, 'ឱសថស្ថាន'],
  [/ឱសថសាន/g, 'ឱសថស្ថាន'],
  [/អោសថស្ថាន/g, 'ឱសថស្ថាន'],
  [/សុខ\s+ភាព\s+ល្អ/g, 'សុខភាពល្អ'],
  [/សុខ\s+ភាព/g, 'សុខភាព'],
  [/វិក្កយ\s*ប័ត្រ/g, 'វិក្កយបត្រ'],
  [/វិកយបត្រ/g, 'វិក្កយបត្រ'],
  [/វិក្កយ\s+បត្រ/g, 'វិក្កយបត្រ'],
  [/ទូទាត់\s+ប្រាក់/g, 'ទូទាត់ប្រាក់'],
  [/កាល\s+បរិច្ឆេទ/g, 'កាលបរិច្ឆេទ'],
  [/កាលបរិចេទ/g, 'កាលបរិច្ឆេទ'],
  [/ថ្នាំ\s+បន្តក់\s+ភ្នែក/g, 'ថ្នាំបន្តក់ភ្នែក'],
  [/សរុប\s+ទាំង\s+អស់/g, 'សរុបទាំងអស់'],
  [/វេជ្ជ\s*បណ្ឌិត/g, 'វេជ្ជបណ្ឌិត'],
  [/វេជ្ជបណិត/g, 'វេជ្ជបណ្ឌិត'],
  [/វេជបណ្ឌិត/g, 'វេជ្ជបណ្ឌិត'],
  [/វេជ្ជ\s*បញ្ជា/g, 'វេជ្ជបញ្ជា'],
  [/វេជ្ជបញា/g, 'វេជ្ជបញ្ជា'],
  [/មន្ទីរ\s*ពេទ្យ/g, 'មន្ទីរពេទ្យ'],
  [/មន្ទីរពេទយ/g, 'មន្ទីរពេទ្យ'],
  [/មន្ទីរពទ្យ/g, 'មន្ទីរពេទ្យ'],
  [/មនី្ទរពេទ្យ/g, 'មន្ទីរពេទ្យ'],
  [/សម្ពាធ\s+ឈាម/g, 'សម្ពាធឈាម'],
  [/ប៉ារាសេតាម៉ុល/g, 'ប៉ារ៉ាសេតាម៉ុល'],
  [/បារ៉ាសេតាម៉ុល/g, 'ប៉ារ៉ាសេតាម៉ុល'],
  [/អាមុកស៊ីស៊ីលីន/g, 'អាម៉ុកស៊ីស៊ីលីន'],
  [/ក្រសួង\s+សុខា\s*ភិបាល/g, 'ក្រសួងសុខាភិបាល'],
  [/ព្រះ\s*រាជា\s*ណាចក្រ\s*កម្ពុជា/g, 'ព្រះរាជាណាចក្រកម្ពុជា'],
  [/អត្ត\s*សញ្ញាណ\s*ប័ណ្ណ/g, 'អត្តសញ្ញាណប័ណ្ណ']
]

/**
 * Repairs canonical Khmer Unicode syllable ordering and composite vowel splits
 * frequently produced by optical character recognition engines.
 * @param {string} rawText
 * @returns {string}
 */
export function repairKhmerUnicodeClusters(rawText) {
  if (!rawText || typeof rawText !== 'string') return ''

  let s = rawText.normalize('NFC')

  // 1. Strip zero-width joiners/non-joiners and stray control characters (except \n and \t)
  s = s.replace(/[\u200B-\u200F\uFEFF]/g, '')

  // 2. Collapse duplicate identical Coeng signs (\u17d2\u17d2 -> \u17d2)
  s = s.replace(/\u17d2{2,}/g, '\u17d2')

  // 3. Reorder [Consonant] + [Dependent Vowel] + [Register Shifter ៉/៊] -> [Consonant] + [Shifter] + [Vowel]
  s = s.replace(/([ក-អ])([\u17b6-\u17c5])([\u17c9\u17ca])/g, '$1$3$2')

  // 4. Reorder [Consonant] + [Pre-vowel េ/ែ/ៃ or top vowel] + [Coeng + Subscript] -> [Consonant] + [Coeng + Subscript] + [Vowel]
  s = s.replace(/([ក-អ][\u17c9\u17ca]?)([\u17b6-\u17c5])(\u17d2[ក-អ])/g, '$1$3$2')

  // 5. Merge split composite Khmer vowels (OCR often outputs េ + ា as two separate glyphs)
  s = s
    .replace(/\u17c1\u17b6/g, '\u17c4') // េ + ា -> ោ
    .replace(/\u17c1\u17b8/g, '\u17be') // េ + ី -> ើ
    .replace(/\u17bbb\u17c6/g, '\u17bb\u17c6')

  // 6. Collapse accidental duplicate identical dependent vowels or diacritics on the same consonant
  s = s.replace(/([\u17b6-\u17c8\u17c9-\u17d1])\1+/g, '$1')

  // 7. Remove orphan combining vowels/diacritics at the very start of a line or after whitespace
  s = s.replace(/(^|[\s([{"'])[\u17b6-\u17d2]+/gm, '$1')

  return s
}

/**
 * Repairs OCR digit confusions (e.g. Latin O/o inside Khmer or ASCII numbers, spaced decimals on receipts).
 * @param {string} text
 * @returns {string}
 */
export function repairKhmerNumbersAndPrices(text) {
  if (!text) return ''
  let s = text

  // Fix Latin 'O'/'o' misread inside Khmer digits (e.g. ១O០ -> ១០០, ៥O -> ៥០)
  s = s.replace(/([០-៩])[Oo]([០-៩])/g, '$1០$2')
  s = s.replace(/([០-៩])[Oo](?![A-Za-z])/g, '$1០')
  s = s.replace(/(?<![A-Za-z])[Oo]([០-៩])/g, '០$1')

  // Fix Latin 'O' misread inside ASCII digits after currency symbols ($ 1O.OO -> $ 10.00)
  s = s.replace(/(\d)[Oo](\d)/g, '$10$2')
  s = s.replace(/(\d)[Oo](?![A-Za-z])/g, '$10')

  // Normalize spaced decimal prices on receipts (e.g. "$ ៦ . ០០" -> "$៦.០០", "$ 4 . 50" -> "$4.50")
  s = s.replace(/([០-៩\d])\s*\.\s*([០-៩\d]{1,2})(?![០-៩\d])/g, '$1.$2')
  s = s.replace(/\$\s+([០-៩\d])/g, '$$$1')

  return s
}

/**
 * Master Post-OCR Khmer Orthographic, Numeric, and Lexical Repair Pipeline.
 * @param {string} rawOcrText
 * @returns {string}
 */
export function postProcessKhmerOcr(rawOcrText) {
  if (!rawOcrText || typeof rawOcrText !== 'string') return ''

  // Stage A: Repair Khmer Unicode syllable cluster order & split vowels
  let s = repairKhmerUnicodeClusters(rawOcrText)

  // Stage B: Repair numbers, prices, and currency formatting
  s = repairKhmerNumbersAndPrices(s)

  // Stage C: Apply Cambodian medical, pharmacy, receipt & administrative vocabulary corrections
  for (const [pattern, replacement] of KHMER_OCR_PHRASE_CORRECTIONS) {
    s = s.replace(pattern, replacement)
  }

  // Stage D: Clean up excessive horizontal spaces on each line while preserving line breaks (\n)
  s = s
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return s
}

/**
 * Pre-OCR Canvas Vision Enhancer for Khmer Script:
 * - Upscales small images (<1500px wide) by up to 2x so tiny Khmer Coeng subscripts and top vowels are crisp.
 * - Applies 2nd–98th percentile luminance contrast stretching to remove phone camera shadows.
 * - Applies a subtle 3x3 Unsharp Mask edge-sharpening pass to boost Khmer stroke definition.
 *
 * @param {File|Blob} fileOrBlob
 * @param {{ maxWidth?: number, minWidth?: number, sharpenAmount?: number }} [options]
 * @returns {Promise<{ blob: Blob, base64: string }>}
 */
export async function preprocessImageForKhmerOcr(fileOrBlob, options = {}) {
  const maxWidth = options.maxWidth || 2400
  const minWidth = options.minWidth || 1500
  const sharpenAmount = options.sharpenAmount ?? 0.38

  if (typeof window === 'undefined' || typeof createImageBitmap !== 'function') {
    const base64 = await blobToBase64(fileOrBlob)
    return { blob: fileOrBlob, base64 }
  }

  let bitmap
  try {
    bitmap = await createImageBitmap(fileOrBlob)
  } catch {
    const base64 = await blobToBase64(fileOrBlob)
    return { blob: fileOrBlob, base64 }
  }

  let scale = 1.0
  if (bitmap.width < minWidth) {
    scale = Math.min(2.0, minWidth / Math.max(1, bitmap.width))
  } else if (bitmap.width > maxWidth) {
    scale = maxWidth / bitmap.width
  }

  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  try {
    const imgData = ctx.getImageData(0, 0, width, height)
    const data = imgData.data
    const pixelCount = width * height

    // 1. Compute luminance histogram (sampled for speed on large images)
    const hist = new Uint32Array(256)
    const step = pixelCount > 1_000_000 ? 4 : 1
    let sampledCount = 0
    for (let i = 0; i < data.length; i += 4 * step) {
      const lum = (77 * data[i] + 150 * data[i + 1] + 29 * data[i + 2]) >> 8
      hist[lum]++
      sampledCount++
    }

    // Find 2nd percentile (black point) and 96th percentile (paper white point)
    let lowCut = 0
    let highCut = 255
    let acc = 0
    const lowTarget = sampledCount * 0.02
    const highTarget = sampledCount * 0.96
    for (let v = 0; v < 256; v++) {
      acc += hist[v]
      if (acc <= lowTarget) lowCut = v
      if (acc <= highTarget) highCut = v
    }

    const range = Math.max(40, highCut - lowCut)
    const gray = new Uint8Array(pixelCount)

    // Normalize contrast into clean grayscale
    for (let p = 0, i = 0; p < pixelCount; p++, i += 4) {
      const lum = (77 * data[i] + 150 * data[i + 1] + 29 * data[i + 2]) >> 8
      let stretched = ((lum - lowCut) * 255) / range
      if (stretched < 0) stretched = 0
      else if (stretched > 255) stretched = 255
      gray[p] = stretched
    }

    // 2. Apply 3x3 Unsharp Mask (Laplacian edge boost) for crisp Khmer subscripts & vowels
    if (sharpenAmount > 0 && width > 4 && height > 4) {
      for (let y = 1; y < height - 1; y++) {
        let rowOffset = y * width
        for (let x = 1; x < width - 1; x++) {
          const idx = rowOffset + x
          const center = gray[idx]
          const neighbors =
            (gray[idx - 1] + gray[idx + 1] + gray[idx - width] + gray[idx + width]) >> 2
          let val = center + (center - neighbors) * sharpenAmount * 2.2
          if (val < 0) val = 0
          else if (val > 255) val = 255
          const outIdx = idx << 2
          data[outIdx] = val
          data[outIdx + 1] = val
          data[outIdx + 2] = val
        }
      }
    } else {
      for (let p = 0, i = 0; p < pixelCount; p++, i += 4) {
        const val = gray[p]
        data[i] = val
        data[i + 1] = val
        data[i + 2] = val
      }
    }

    ctx.putImageData(imgData, 0, 0)
  } catch (err) {
    console.warn('Khmer OCR canvas pre-filter skipped:', err)
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94))
  const base64 = await blobToBase64(blob || fileOrBlob)
  return { blob: blob || fileOrBlob, base64 }
}

function blobToBase64(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = String(reader.result || '')
      resolve(res.includes(',') ? res.split(',')[1] : res)
    }
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(fileOrBlob)
  })
}
