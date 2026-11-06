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
  // A scanned page often has no ។ at all, only line breaks: without this the whole page came back as one point
  const byLine = lines.filter((l) => l.length > 8)
  const pieces = sentences.length < 2 && byLine.length >= 2 ? byLine : sentences
  if (pieces.length > 0) return pieces.slice(0, 4).map(clip)

  return [clip(clean)]
}

const clip = (s) => (s.length > 180 ? s.slice(0, 180).trim() + '...' : s)
