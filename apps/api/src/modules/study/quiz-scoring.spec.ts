import { describe, expect, it } from 'vitest'
import { QuestionType } from '@assessiq/types'
import { defaultMarks, recommendDifficulty } from './quiz-scoring'

describe('defaultMarks', () => {
  it('uses 1 for objective questions and 2 for short answers', () => {
    expect(defaultMarks(QuestionType.MCQ)).toBe(1)
    expect(defaultMarks(QuestionType.TRUE_FALSE)).toBe(1)
    expect(defaultMarks(QuestionType.SHORT_ANSWER, 10)).toBe(2)
  })

  it('uses generated marks for essays, defaulting to 8 and capping at 20', () => {
    expect(defaultMarks(QuestionType.THEORY, 6)).toBe(6)
    expect(defaultMarks(QuestionType.THEORY)).toBe(8)
    expect(defaultMarks(QuestionType.THEORY, 0)).toBe(8)
    expect(defaultMarks(QuestionType.THEORY, 50)).toBe(20)
  })
})

describe('recommendDifficulty', () => {
  it('steps up after 80%+ and down below 50%, within bounds', () => {
    expect(recommendDifficulty('EASY', 85)).toBe('MEDIUM')
    expect(recommendDifficulty('MEDIUM', 80)).toBe('HARD')
    expect(recommendDifficulty('HARD', 100)).toBe('HARD')
    expect(recommendDifficulty('HARD', 30)).toBe('MEDIUM')
    expect(recommendDifficulty('EASY', 0)).toBe('EASY')
  })

  it('stays put for middling scores or no score', () => {
    expect(recommendDifficulty('MEDIUM', 65)).toBe('MEDIUM')
    expect(recommendDifficulty('MEDIUM', null)).toBe('MEDIUM')
  })
})
