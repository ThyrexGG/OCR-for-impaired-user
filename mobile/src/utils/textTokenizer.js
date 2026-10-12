/**
 * Ported verbatim (pure JS, no Vue reactivity) from OcrPanel.vue's
 * `parsedParagraphs` computed: splits text into paragraphs -> sentences
 * (on Khmer/Latin punctuation) -> words, each word carrying a stable
 * globalIndex used to sync karaoke highlighting with TTS playback.
 */
export function tokenizeText(text) {
  if (!text) return []

  const rawParas = text.split(/\n\s*\n|\n/)
  let globalWordCounter = 0
  let globalSentenceCounter = 0

  return rawParas
    .map((paraText, pIdx) => {
      if (!paraText.trim()) return null

      const rawSentences = paraText.split(/([។៕\.\?!]+)/).filter(Boolean)
      const sentences = []

      for (let i = 0; i < rawSentences.length; i += 2) {
        const sText = (rawSentences[i] + (rawSentences[i + 1] || '')).trim()
        if (!sText) continue

        const sIndex = globalSentenceCounter++
        const words = sText
          .split(/\s+/)
          .filter((w) => w.length > 0)
          .map((w) => {
            const wIdx = globalWordCounter++
            return { text: w, globalIndex: wIdx, sentenceIndex: sIndex, paragraphIndex: pIdx }
          })

        sentences.push({ text: sText, index: sIndex, words })
      }

      return { index: pIdx, sentences }
    })
    .filter(Boolean)
}
