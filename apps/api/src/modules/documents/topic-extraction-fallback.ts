export interface ExtractedTopicProposal {
  name: string
  description?: string
}

const HEADING_LIKE = /^(chapter|module|unit|topic|section)\s+\d+[:.\-]?\s*(.*)$/i
const NUMBERED_LINE = /^\d+[.)]\s+(.{3,80})$/

/**
 * Best-effort topic extraction with no AI involved — used as a fallback when
 * AI extraction is unavailable (missing/invalid API key, request failure).
 * Looks for heading-shaped lines first; falls back to splitting the text into
 * roughly-equal sections if nothing heading-like is found.
 */
export function extractTopicsHeuristically(text: string, maxTopics = 10): ExtractedTopicProposal[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const seen = new Set<string>()
  const candidates: string[] = []

  for (const line of lines) {
    if (line.length > 90) continue

    const headingMatch = line.match(HEADING_LIKE)
    if (headingMatch) {
      const name = (headingMatch[2] || headingMatch[0]).trim()
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase())
        candidates.push(name)
      }
      continue
    }

    const numberedMatch = line.match(NUMBERED_LINE)
    if (numberedMatch) {
      const name = numberedMatch[1]!.trim()
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase())
        candidates.push(name)
      }
    }
  }

  if (candidates.length >= 3) {
    return candidates.slice(0, maxTopics).map(name => ({ name }))
  }

  // No clear headings — chunk the text into roughly-equal sections instead
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const chunkCount = Math.min(maxTopics, Math.max(3, Math.ceil(words.length / 250)))
  const chunkSize = Math.ceil(words.length / chunkCount)
  const proposals: ExtractedTopicProposal[] = []

  for (let i = 0; i < chunkCount; i++) {
    const chunk = words.slice(i * chunkSize, (i + 1) * chunkSize)
    if (chunk.length === 0) continue
    proposals.push({ name: `Section ${i + 1}`, description: `${chunk.slice(0, 18).join(' ')}…` })
  }

  return proposals
}
