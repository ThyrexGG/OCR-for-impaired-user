/**
 * Khmer Linguistic Normalizer & Phonetic Pre-Processor for songKHEM
 * =================================================================
 * Mirrors khmer-tts-engine/khmer_linguistics.py in pure ES Module JavaScript so both
 * the browser UI and serverless api/tts.js can deterministically normalize:
 *   1. OCR split-vowel repair (េ + ា -> ោ, េ + ី -> ើ)
 *   2. Khmer & Arabic numerals -> spoken Khmer words
 *   3. Currency (៛ Riel & $ USD), Percentages (%), Dosages (mg, ml, kg)
 *   4. Dates (DD/MM/YYYY) and Times (HH:MM)
 *   5. Common Khmer abbreviations (គ.ស., ព.ស., ឯ.ឧ., ម.គ.ផ., ។ល។)
 *   6. Repeater symbol `ៗ` (lek too) grammatical word duplication
 */

const KHMER_DIGITS = {
  '០': '0', '១': '1', '២': '2', '៣': '3', '៤': '4',
  '៥': '5', '៦': '6', '៧': '7', '៨': '8', '៩': '9'
}

const UNITS_KH = ['សូន្យ', 'មួយ', 'ពីរ', 'បី', 'បួន', 'ប្រាំ', 'ប្រាំមួយ', 'ប្រាំពីរ', 'ប្រាំបី', 'ប្រាំបួន']
const TENS_KH = ['', 'ដប់', 'ម្ភៃ', 'សាមសិប', 'សែសិប', 'ហាសិប', 'ហុកសិប', 'ចិតសិប', 'ប៉ែតសិប', 'កៅសិប']

const MONTHS_KH = {
  1: 'មករា', 2: 'កុម្ភៈ', 3: 'មីនា', 4: 'មេសា',
  5: 'ឧសភា', 6: 'មិថុនា', 7: 'កក្កដា', 8: 'សីហា',
  9: 'កញ្ញា', 10: 'តុលា', 11: 'វិច្ឆិកា', 12: 'ធ្នូ'
}

const ABBREVIATIONS_KH = {
  'ក្រសួង ស.អ.យ.': 'ក្រសួងសង្គមកិច្ច អតីតយុទ្ធជន និងយុវនីតិសម្បទា',
  'ម.គ.ផ.': 'មន្ទីរពេទ្យគន្ធបុប្ផា',
  'គ.ជ.ប.': 'គណៈកម្មាធិការជាតិរៀបចំការបោះឆ្នោត',
  'ស.រ.អា.': 'សហរដ្ឋអាមេរិក',
  'អ.ស.ប.': 'អង្គការសហប្រជាជាតិ',
  'គ.ស.': 'គ្រិស្តសករាជ',
  'ព.ស.': 'ពុទ្ធសករាជ',
  'ឯ.ឧ.': 'ឯកឧត្តម',
  'ភ.ព.': 'ភ្នំពេញ',
  'គ.ក្រ.': 'គីឡូក្រាម',
  'ម.ក្រ.': 'មីលីក្រាម',
  'គ.ម.': 'គីឡូម៉ែត្រ',
  'ស.ម.': 'សង់ទីម៉ែត្រ',
  'ម.ម.': 'មីលីម៉ែត្រ'
}

const UNIT_SUFFIXES = {
  mg: 'មីលីក្រាម',
  ml: 'មីលីលីត្រ',
  kg: 'គីឡូក្រាម',
  km: 'គីឡូម៉ែត្រ',
  cm: 'សង់ទីម៉ែត្រ',
  mm: 'មីលីម៉ែត្រ'
}

/**
 * Converts a non-negative integer into natural spoken Khmer words.
 * @param {number} n
 * @returns {string}
 */
export function intToKhmerWords(n) {
  if (!Number.isFinite(n)) return ''
  if (n < 0) return 'ដក ' + intToKhmerWords(-n)
  n = Math.trunc(n)
  if (n < 10) return UNITS_KH[n]
  if (n < 100) {
    const tens = Math.trunc(n / 10)
    const rem = n % 10
    return TENS_KH[tens] + (rem === 0 ? '' : UNITS_KH[rem])
  }
  if (n < 1000) {
    const hundreds = Math.trunc(n / 100)
    const rem = n % 100
    return UNITS_KH[hundreds] + 'រយ' + (rem === 0 ? '' : ' ' + intToKhmerWords(rem))
  }

  const scales = [
    [10000000, 'កោដិ'],
    [1000000, 'លាន'],
    [100000, 'សែន'],
    [10000, 'ម៉ឺន'],
    [1000, 'ពាន់']
  ]
  for (const [val, label] of scales) {
    if (n >= val) {
      const head = Math.trunc(n / val)
      const rem = n % val
      return intToKhmerWords(head) + label + (rem === 0 ? '' : ' ' + intToKhmerWords(rem))
    }
  }
  return String(n)
}

function numberStrToKhmer(numStr) {
  const clean = numStr.replace(/,/g, '')
  if (clean.includes('.')) {
    const [left, right] = clean.split('.')
    const rightWords = right
      .split('')
      .filter((c) => /\d/.test(c))
      .map((c) => UNITS_KH[parseInt(c, 10)])
      .join(' ')
    return `${intToKhmerWords(parseInt(left || '0', 10))} ចុច ${rightWords}`
  }
  return intToKhmerWords(parseInt(clean, 10))
}

/**
 * Normalizes raw Khmer OCR / document text into natural spoken Khmer for TTS synthesis.
 * @param {string} rawText
 * @returns {string}
 */
export function normalizeKhmerForSpeech(rawText) {
  if (!rawText || typeof rawText !== 'string') return ''

  let s = rawText.normalize('NFC')
  // Repair split composite vowels common in OCR output
  s = s.replace(/\u17c1\u17b6/g, '\u17c4').replace(/\u17c1\u17b8/g, '\u17be')

  // Expand Khmer abbreviations
  for (const [abbr, full] of Object.entries(ABBREVIATIONS_KH)) {
    s = s.split(abbr).join(` ${full} `)
  }

  // Convert Khmer digits to ASCII digits for unified parsing
  s = s.replace(/[០-៩]/g, (ch) => KHMER_DIGITS[ch] ?? ch)

  // Expand dosage/metric suffixes attached to numbers (e.g. 500mg -> 500 មីលីក្រាម)
  for (const [unitEn, unitKh] of Object.entries(UNIT_SUFFIXES)) {
    const re = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unitEn}\\b`, 'gi')
    s = s.replace(re, `$1 ${unitKh} `)
  }

  // Expand Dates: DD/MM/YYYY or DD-MM-YYYY
  s = s.replace(/(?:ថ្ងៃទី\s*)?\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g, (match, dStr, mStr, yStr) => {
    const d = parseInt(dStr, 10)
    const m = parseInt(mStr, 10)
    const y = parseInt(yStr, 10)
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return ` ថ្ងៃទី${intToKhmerWords(d)} ខែ${MONTHS_KH[m]} ឆ្នាំ${intToKhmerWords(y)} `
    }
    return match
  })

  // Expand Time: HH:MM
  s = s.replace(/(?:ម៉ោង\s*)?(\d{1,2}):(\d{2})\b/g, (_, hStr, mStr) => {
    const hh = parseInt(hStr, 10)
    const mm = parseInt(mStr, 10)
    if (mm === 0) return ` ម៉ោង${intToKhmerWords(hh)}គត់ `
    if (mm === 30) return ` ម៉ោង${intToKhmerWords(hh)}កន្លះ `
    return ` ម៉ោង${intToKhmerWords(hh)} និង${intToKhmerWords(mm)}នាទី `
  })

  // Expand Riel currency (៛)
  s = s.replace(/(\d[\d,]*)\s*៛/g, (_, num) => {
    return ` ${intToKhmerWords(parseInt(num.replace(/,/g, ''), 10))}រៀល `
  })

  // Expand USD currency ($)
  s = s.replace(/\$\s*(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*\$/g, (_, g1, g2) => {
    const raw = (g1 || g2).replace(/,/g, '')
    if (raw.includes('.')) {
      const [dPart, cPart] = raw.split('.')
      const dWords = intToKhmerWords(parseInt(dPart || '0', 10))
      const cVal = parseInt((cPart + '0').slice(0, 2), 10)
      return cVal > 0 ? ` ${dWords}ដុល្លារ និង${intToKhmerWords(cVal)}សេន ` : ` ${dWords}ដុល្លារ `
    }
    return ` ${intToKhmerWords(parseInt(raw, 10))}ដុល្លារ `
  })

  // Expand Percentages (%)
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, (_, num) => ` ${numberStrToKhmer(num)}ភាគរយ `)

  // Expand remaining numbers
  s = s.replace(/\b\d[\d,]*(?:\.\d+)?\b/g, (num) => ` ${numberStrToKhmer(num)} `)

  // Expand Repeater symbol `ៗ`
  s = s.replace(/([ក-៻]+)\s*ៗ/g, '$1 $1')
  s = s.replace(/។ល។/g, ' ហើយនិងដទៃទៀត ')

  return s.replace(/\s+/g, ' ').trim()
}
