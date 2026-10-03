import { describe, expect, it } from 'vitest'
import { chunkText, cosine, keywordScore } from './chunk-text'

describe('chunkText', () => {
  it('returns nothing for empty text', () => {
    expect(chunkText('   \n ')).toEqual([])
  })

  it('splits long text into passages under the size limit, on sentence boundaries', () => {
    const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} explains a concept in some detail.`).join(' ')
    const chunks = chunkText(text, 300)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every(c => c.length <= 300 + 60)).toBe(true) // one sentence may overflow before the cut
    expect(chunks.every(c => c.endsWith('.'))).toBe(true)
  })

  it('overlaps one sentence between passages so split definitions stay findable', () => {
    const text = Array.from({ length: 20 }, (_, i) => `Fact ${i} is here.`).join(' ')
    const [first, second] = chunkText(text, 60)
    const lastSentence = first!.split('. ').at(-1)!
    expect(second!.startsWith(lastSentence.replace(/\.$/, ''))).toBe(true)
  })

  it('treats blank lines as boundaries', () => {
    expect(chunkText('Heading one\n\nBody text here.', 15)).toEqual(['Heading one', 'Heading one Body text here.'])
  })
})

describe('cosine', () => {
  it('is 1 for identical direction, 0 for orthogonal, and safe for zero vectors', () => {
    expect(cosine([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
    expect(cosine([1, 0], [0, 1])).toBe(0)
    expect(cosine([0, 0], [1, 1])).toBe(0)
  })
})

describe('keywordScore', () => {
  it('scores the share of meaningful query words found, ignoring short words', () => {
    expect(keywordScore('sample variance formula', 'The sample variance divides by n − 1')).toBeCloseTo(2 / 3)
    expect(keywordScore('is a of', 'anything')).toBe(0)
    expect(keywordScore('photosynthesis', 'variance and spread')).toBe(0)
  })
})
