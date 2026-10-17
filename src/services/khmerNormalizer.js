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

  // Apply Pali/Sanskrit/Medical Lexicon & User Custom Overrides
  const lexicon = getCombinedLexicon()
  for (const [word, entry] of Object.entries(lexicon)) {
    if (word && entry?.respell && s.includes(word)) {
      s = s.split(word).join(entry.respell)
    }
  }

  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Built-in Pali / Sanskrit / Medical Khmer Pronunciation Lexicon
 */
export const DEFAULT_KHMER_LEXICON = {
  'សុខាភិបាល': { respell: 'សុ-ខា-ភិ-បាល', ipa: 'so.kʰaː.pʰi.baːl' },
  'វេជ្ជបណ្ឌិត': { respell: 'វេច-ជៈ-បន់-ឌិត', ipa: 'veːc.ca.bɑn.dɨt' },
  'វេជ្ជបញ្ជា': { respell: 'វេច-ជៈ-បាញ់-ជា', ipa: 'veːc.ca.baɲ.ciə' },
  'មន្ទីរពេទ្យ': { respell: 'មុន-ទី-ពេទ', ipa: 'mun.tiː.peːt' },
  'ឱសថស្ថាន': { respell: 'អោ-សថ-ស្ថាន', ipa: 'ʔao.sɑt.stʰaːn' },
  'ប៉ារ៉ាសេតាម៉ុល': { respell: 'ប៉ា-រ៉ា-សេ-តា-ម៉ុល', ipa: 'paː.raː.seː.taː.mol' },
  'អាម៉ុកស៊ីស៊ីលីន': { respell: 'អា-ម៉ុក-ស៊ី-ស៊ី-លីន', ipa: 'ʔaː.mok.siː.siː.liːn' },
  'សម្ពាធឈាម': { respell: 'សំ-ពៀត-ឈាម', ipa: 'sɑm.piət.cʰiəm' },
  'ព្រះរាជាណាចក្រកម្ពុជា': { respell: 'ព្រះ-រា-ជា-ណា-ចាក់-កាំ-ពុ-ជា', ipa: 'preah.riə.ciə.naː.cak.kam.pu.ciə' },
  'បច្ចេកវិទ្យា': { respell: 'ប៉ាច់-ចេក-កៈ-វិត-ទ្យា', ipa: 'pac.ceːk.ka.vit.tjiə' },
  'សាកលវិទ្យាល័យ': { respell: 'សា-កល់-វិត-ទ្យា-ល័យ', ipa: 'saː.kɑl.vit.tjiə.laj' },
  'គន្ធបុប្ផា': { respell: 'គន់-ធៈ-បុប-ផា', ipa: 'kʊən.tʰea.bop.pʰaː' }
}

const CUSTOM_LEXICON_STORAGE_KEY = 'songkhem_custom_lexicon_v1'

export function getCustomLexicon() {
  if (typeof window === 'undefined' || !window.localStorage) return {}
  try {
    const raw = window.localStorage.getItem(CUSTOM_LEXICON_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (_) {
    return {}
  }
}

export function saveCustomLexiconEntry(word, respell, ipa = '') {
  if (!word || !respell) return getCombinedLexicon()
  const current = getCustomLexicon()
  current[word.trim()] = {
    respell: respell.trim(),
    ipa: (ipa || respell).trim(),
    custom: true
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CUSTOM_LEXICON_STORAGE_KEY, JSON.stringify(current))
    } catch (_) {}
  }
  return getCombinedLexicon()
}

export function getCombinedLexicon() {
  return { ...DEFAULT_KHMER_LEXICON, ...getCustomLexicon() }
}

/**
 * Smart Assistive Pacing for visually impaired listeners:
 * Inserts deliberate breath micro-pauses around dosages, currency amounts, dates, times, and numbers.
 */
export function applyAssistivePacing(rawText) {
  if (!rawText || typeof rawText !== 'string') return ''
  const paced = rawText.replace(
    /([0-9០-៩][0-9០-៩,.\s/:]*(?:៛|រៀល|\$|ដុល្លារ|%|mg|មីលីក្រាម|ml|មីលីលីត្រ|kg|គីឡូក្រាម)?)/gi,
    ' , $1 , '
  )
  return paced.replace(/\s{2,}/g, ' ').trim()
}

// Khmer Consonant Series & Closed-Syllable IPA Tables (A-series Akhosak vs O-series Khosak)
const CONSONANT_IPA = {
  'ក': ['k', 'A'], 'ខ': ['kʰ', 'A'], 'គ': ['k', 'O'], 'ឃ': ['kʰ', 'O'], 'ង': ['ŋ', 'O'],
  'ច': ['c', 'A'], 'ឆ': ['cʰ', 'A'], 'ជ': ['c', 'O'], 'ឈ': ['cʰ', 'O'], 'ញ': ['ɲ', 'O'],
  'ដ': ['d', 'A'], 'ឋ': ['tʰ', 'A'], 'ឌ': ['d', 'O'], 'ឍ': ['tʰ', 'O'], 'ណ': ['n', 'A'],
  'ត': ['t', 'A'], 'ថ': ['tʰ', 'A'], 'ទ': ['t', 'O'], 'ធ': ['tʰ', 'O'], 'ន': ['n', 'O'],
  'ប': ['b', 'A'], 'ផ': ['pʰ', 'A'], 'ព': ['p', 'O'], 'ភ': ['pʰ', 'O'], 'ម': ['m', 'O'],
  'យ': ['j', 'O'], 'រ': ['r', 'O'], 'ល': ['l', 'O'], 'វ': ['v', 'O'],
  'ស': ['s', 'A'], 'ហ': ['h', 'A'], 'ឡ': ['l', 'A'], 'អ': ['ʔ', 'A']
}

const FINAL_CODA_IPA = {
  'ក': 'k̚', 'ខ': 'k̚', 'គ': 'k̚', 'ឃ': 'k̚', 'ង': 'ŋ',
  'ច': 'c̚', 'ជ': 'c̚', 'ញ': 'ɲ',
  'ដ': 't̚', 'ត': 't̚', 'ថ': 't̚', 'ទ': 't̚', 'ធ': 't̚', 'ណ': 'n', 'ន': 'n',
  'ប': 'p̚', 'ផ': 'p̚', 'ព': 'p̚', 'ភ': 'p̚', 'ម': 'm',
  'យ': 'j', 'រ': '', 'ល': 'l', 'វ': 'w', 'ស': 'h'
}

const VOWEL_IPA = {
  'ា': ['aː', 'iə'],
  'ិ': ['ə', 'ɨ'],
  'ី': ['əj', 'iː'],
  'ឹ': ['ə', 'ɨ'],
  'ឺ': ['əɨ', 'ɨː'],
  'ុ': ['o', 'u'],
  'ូ': ['oː', 'uː'],
  'ួ': ['uə', 'uə'],
  'ើ': ['aə', 'əː'],
  'ឿ': ['ɨə', 'ɨə'],
  'ៀ': ['iə', 'iə'],
  'េ': ['eː', 'eː'],
  'ែ': ['ae', 'ɛː'],
  'ៃ': ['aj', 'ɨj'],
  'ោ': ['ao', 'oː'],
  'ៅ': ['aw', 'ɨw'],
  'ុំ': ['om', 'um'],
  'ំ': ['ɑm', 'um'],
  'ាំ': ['am', 'oăm'],
  'ះ': ['ah', 'eah']
}

export function wordToKhmerIpa(word) {
  const lexicon = getCombinedLexicon()
  if (lexicon[word]?.ipa) {
    return { ipa: lexicon[word].ipa, register: 'Lexicon' }
  }
  let currentSeries = 'A'
  let firstSeries = 'A'
  let hasConsonant = false
  const chars = Array.from(word)
  const out = []

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (ch === '៉') {
      currentSeries = 'A'
      continue
    }
    if (ch === '៊') {
      currentSeries = 'O'
      continue
    }
    if (ch === '៍' || ch === '្' || ch === '់') continue

    if (CONSONANT_IPA[ch]) {
      const [onset, series] = CONSONANT_IPA[ch]
      const isFinal = i === chars.length - 1 && i > 0
      if (isFinal && FINAL_CODA_IPA[ch] !== undefined) {
        out.push(FINAL_CODA_IPA[ch])
      } else {
        out.push(onset)
        currentSeries = series
        if (!hasConsonant) {
          firstSeries = series
          hasConsonant = true
        }
        const nextCh = chars[i + 1]
        if (!nextCh || (CONSONANT_IPA[nextCh] && i + 1 < chars.length - 1)) {
          out.push(currentSeries === 'A' ? 'ɑː' : 'ɔː')
        }
      }
      continue
    }
    if (VOWEL_IPA[ch]) {
      const [vA, vO] = VOWEL_IPA[ch]
      out.push(currentSeries === 'A' ? vA : vO)
    }
  }
  return {
    ipa: out.join('') || word,
    register: firstSeries === 'A' ? 'អ-Series (Akhosak)' : 'អ៊-Series (Khosak)'
  }
}

/**
 * Full Khmer G2P & Phoneme X-Ray Analysis for the Interactive Inspector UI
 */
export function analyzeKhmerG2P(rawText, options = { assistivePacing: false }) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      normalizedText: '',
      ipaString: '',
      wordBreakdown: []
    }
  }
  const source = options?.assistivePacing ? applyAssistivePacing(rawText) : rawText
  const normalizedText = normalizeKhmerForSpeech(source)
  const words = normalizedText
    .split(/[\s,។៕]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)

  const lexicon = getCombinedLexicon()
  const wordBreakdown = words.slice(0, 60).map((w) => {
    const { ipa, register } = wordToKhmerIpa(w)
    return {
      word: w,
      respell: lexicon[w]?.respell || w,
      ipa,
      register
    }
  })

  return {
    normalizedText,
    ipaString: wordBreakdown.map((item) => item.ipa).join(' · '),
    wordBreakdown
  }
}

