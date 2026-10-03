// Split text into passages of ~maxChunkSize characters on sentence boundaries, keeping a little overlap so a
// definition split across two passages is still retrievable from either.
export function chunkText(text: string, maxChunkSize = 1200, overlapSentences = 1): string[] {
  const clean = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim()
  if (!clean) return []

  const sentences = clean.split(/(?<=[.!?])\s+|\n{2,}/).map(s => s.trim()).filter(Boolean)
  const chunks: string[] = []
  let current: string[] = []
  let length = 0

  for (const sentence of sentences) {
    if (length > 0 && length + sentence.length + 1 > maxChunkSize) {
      chunks.push(current.join(' '))
      current = current.slice(-overlapSentences)
      length = current.join(' ').length
    }
    current.push(sentence)
    length += sentence.length + 1
  }
  if (current.length) chunks.push(current.join(' '))
  return chunks
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

// Fallback relevance when embeddings aren't available: share of query terms present in the passage
export function keywordScore(query: string, text: string): number {
  const terms = [...new Set(query.toLowerCase().split(/\W+/).filter(t => t.length > 3))]
  if (terms.length === 0) return 0
  const haystack = text.toLowerCase()
  return terms.filter(t => haystack.includes(t)).length / terms.length
}
