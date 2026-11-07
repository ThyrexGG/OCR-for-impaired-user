import { normalizeKhmerForSpeech } from './khmerNormalizer'

/**
 * Segment a Khmer or multilingual sentence into display word tokens.
 */
export const segmentSentenceIntoWords = (sentenceText) => {
  if (!sentenceText) return []
  if (/[ក-៿]/.test(sentenceText) && typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter('km', { granularity: 'word' })
      const words = []
      for (const { segment } of segmenter.segment(sentenceText)) {
        const trimmed = segment.trim()
        if (trimmed) words.push(trimmed)
      }
      if (words.length > 0) return words
    } catch (_) {}
  }
  return sentenceText.split(/\s+/).filter((w) => w.length > 0)
}

/**
 * Count spoken syllables in Latin/English words for calibrated speech pacing.
 */
export const countEnglishSyllables = (word) => {
  const w = (word || '').toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 1
  if (w.length <= 3) return 1
  const cleaned = w.replace(/(?:[^laeiouy]|ed|es)e$/, '').replace(/^y/, '')
  const matches = cleaned.match(/[aeiouy]{1,2}/g)
  return matches ? Math.max(1, Math.min(6, matches.length)) : 1
}

/**
 * Compute acoustic duration weight for a token to synchronize karaoke highlight to speech audio.
 */
export const computeTokenAcousticWeight = (rawToken) => {
  const tStr = (rawToken || '').trim()
  if (!tStr) return 0.05
  // Pure visual separators / bullets / dashes take negligible spoken time
  if (/^[-‐-―=_()[\]{}"'«»/\\|+*•●*]+$/.test(tStr)) return 0.05
  // Standalone clause or sentence punctuation
  if (/^[:;,.?!។៕]+$/.test(tStr)) return /[។៕.?!]/.test(tStr) ? 0.40 : 0.20
  // Currency symbols spoken as words
  if (tStr === '$' || tStr === '៛') return 1.25

  let weight = 1.0

  // 1. English / Latin words: speech duration tracks syllable count (~180ms per syllable)
  if (/[a-zA-Z]/.test(tStr)) {
    const syllables = countEnglishSyllables(tStr)
    weight = 0.36 + (syllables * 0.36)
  } else if (/^[០-៩0-9]+[.,]?[០-៩0-9]*$/.test(tStr)) {
    // 2. Numbers (spoken as multi-syllable numbers)
    const digits = tStr.replace(/\D/g, '').length
    weight = digits <= 2 ? 0.95 : digits <= 4 ? 1.65 : 2.2
  } else {
    // 3. Khmer words: calibrated by phonetic consonant-vowel clusters
    const spoken = normalizeKhmerForSpeech(tStr).replace(/[^ក-៿a-zA-Z0-9]/g, '')
    const charLen = Math.max(1, spoken.length || tStr.length)
    weight = Math.max(0.70, Math.pow(charLen, 0.72) * 0.52)
  }

  // Trailing punctuation pause anchors:
  if (/[។៕.?!]$/.test(tStr)) {
    weight += 0.40 // Full sentence boundary pause
  } else if (/[,;:—–]$/.test(tStr)) {
    weight += 0.20 // Comma / clause breath pause
  }

  return weight
}

/**
 * Tokenize raw text into paragraphs of words plus a cumulative acoustic timeline.
 */
export const tokenizeForReading = (rawText) => {
  const paragraphs = []
  const flat = []
  const weights = []
  if (!rawText) return { paragraphs, tokens: flat, timeline: [] }

  const rawParas = rawText.split(/\n\s*\n|\n/)
  rawParas.forEach((paraText, pIdx) => {
    if (!paraText.trim()) return
    const paraStartIdx = flat.length
    const words = []
    const rawSentences = paraText.split(/([។៕.?!]+)/).filter(Boolean)
    for (let i = 0; i < rawSentences.length; i += 2) {
      const sText = (rawSentences[i] + (rawSentences[i + 1] || '')).trim()
      if (!sText) continue
      for (const w of segmentSentenceIntoWords(sText)) {
        words.push({ index: flat.length, text: w, paragraphIndex: pIdx })
        flat.push(w)
        weights.push(computeTokenAcousticWeight(w))
      }
    }
    const paraEndIdx = flat.length - 1
    if (paraEndIdx >= paraStartIdx) {
      if (/^[០-៩0-9]{1,3}\.?$/.test(flat[paraStartIdx])) {
        weights[paraStartIdx] += 0.55
        if (paraStartIdx + 1 <= paraEndIdx && flat[paraStartIdx + 1] === '.') {
          weights[paraStartIdx + 1] = 0.45
        }
      }
      weights[paraEndIdx] += 0.40
    }
    paragraphs.push({ paragraphIndex: pIdx, words })
  })

  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1
  let cum = 0
  const timeline = flat.map((w, idx) => {
    const startFrac = cum / totalWeight
    cum += weights[idx]
    return { index: idx, word: w, weight: weights[idx], startFrac, endFrac: cum / totalWeight }
  })
  return { paragraphs, tokens: flat, timeline }
}

