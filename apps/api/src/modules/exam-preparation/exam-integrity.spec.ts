import { describe, expect, it } from 'vitest'
import { shuffleOptions } from './exam-sampling'
import { freezeQuestion, markMock } from './exam-mock.rules'
import { questionFingerprintV2, questionSimilarity, sameOptionSet } from './exam-content.rules'
import { evidenceLevel } from './exam-syllabus.service'

const options = [
  { key: 'A', text: 'Argon' },
  { key: 'B', text: 'Oxygen' },
  { key: 'C', text: 'Nitrogen' },
  { key: 'D', text: 'Carbon' },
]
function seeded(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
}

describe('option shuffling', () => {
  it('keeps display keys A–D and maps the answer to the same option text', () => {
    for (let seed = 1; seed < 50; seed++) {
      const s = shuffleOptions(options, 'A', seeded(seed))!
      expect(s.options.map((o) => o.key)).toEqual(['A', 'B', 'C', 'D'])
      expect(s.options.find((o) => o.key === s.correctAnswer)!.text).toBe('Argon')
      expect([...s.optionOrder].sort()).toEqual(['A', 'B', 'C', 'D'])
      expect(s.options.map((o) => o.text)).toEqual(s.optionOrder.map((k) => options.find((o) => o.key === k)!.text))
    }
  })
  it('produces different orders across attempts', () => {
    const orders = new Set(Array.from({ length: 30 }, (_, i) => shuffleOptions(options, 'A', seeded(i + 1))!.optionOrder.join('')))
    expect(orders.size).toBeGreaterThan(5)
  })
  it('leaves positional and non-standard option sets in their authored order', () => {
    expect(shuffleOptions([...options.slice(0, 3), { key: 'D', text: 'All of the above' }], 'D')).toBeNull()
    expect(shuffleOptions([...options.slice(0, 3), { key: 'D', text: 'A and B' }], 'D')).toBeNull()
    expect(shuffleOptions(options.slice(0, 3), 'A')).toBeNull()
    expect(shuffleOptions(options, 'E')).toBeNull()
  })
  it('scores a frozen, shuffled question against its frozen key', () => {
    const q = freezeQuestion(
      { id: 'q', subjectKey: 'chemistry', subject: 'Chemistry', topic: 'Gases', questionText: 'Which is a noble gas?', options, correctAnswer: 'A', explanation: 'Argon is a noble gas.', revision: 1 },
      seeded(7),
    )
    const right = q.correctAnswer, wrong = ['A', 'B', 'C', 'D'].find((k) => k !== right)!
    expect(markMock([q], { q: right }).subjects[0]!.correct).toBe(1)
    expect(markMock([q], { q: wrong }).subjects[0]!.correct).toBe(0)
  })
})

describe('duplicate detection', () => {
  it('distinguishes common stems with different options', () => {
    const stem = 'Which of the following is a noble gas?'
    expect(questionFingerprintV2(stem, options)).not.toBe(
      questionFingerprintV2(stem, [...options.slice(0, 3), { key: 'D', text: 'Neon' }]),
    )
  })
  it('treats reordered options and whitespace or case changes as the same question', () => {
    expect(questionFingerprintV2('Which  is a NOBLE gas?', [...options].reverse())).toBe(questionFingerprintV2('which is a noble gas?', options))
    expect(sameOptionSet(options, [...options].reverse())).toBe(true)
  })
  it('scores near-duplicates as similar without being identical', () => {
    const a = { questionText: 'Which of the following gases is a noble gas?', options }
    const b = { questionText: 'Which one of these gases is a noble gas?', options }
    const c = { questionText: 'Define photosynthesis and state two of its products.', options: [] }
    expect(questionSimilarity(a, b)).toBeGreaterThan(0.6)
    expect(questionSimilarity(a, c)).toBeLessThan(0.2)
  })
})

describe('coverage evidence levels', () => {
  it('withholds judgement on tiny samples', () => {
    expect(evidenceLevel(0)).toBe('NONE')
    expect(evidenceLevel(1)).toBe('INSUFFICIENT')
    expect(evidenceLevel(2)).toBe('INSUFFICIENT')
    expect(evidenceLevel(3)).toBe('EMERGING')
    expect(evidenceLevel(7)).toBe('EMERGING')
    expect(evidenceLevel(8)).toBe('ESTABLISHED')
  })
})
