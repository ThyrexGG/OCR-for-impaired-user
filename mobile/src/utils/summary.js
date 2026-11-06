// Same logic as the web DocumentReader's `summaryPoints`: bullet lines if the
// document is a list, otherwise its first few sentences.
export function buildSummaryPoints(text) {
  if (!text) return []
  const clean = text.replace(/\r\n/g, '\n').trim()
  if (!clean) return []

  const lines = clean
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^[-*_]{3,}$/.test(l))

  const bullets = lines.filter((l) => /^[0-9]+[.)\s]|^[•\-*]\s/.test(l))
  if (bullets.length >= 2) {
    return bullets.slice(0, 5).map((l) => l.replace(/^[0-9]+[.)\s]*|^[•\-*]\s*/, '').trim())
  }

  const sentences = clean
    .split(/[។៕.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
  if (sentences.length > 0) return sentences.slice(0, 4)

  return [clean.slice(0, 180) + '...']
}
