import { QuestionType } from '@assessiq/types'

// Marks per question type: objective 1, short answer/calculation 2, structured/essay as generated (default 8)
export function defaultMarks(type: QuestionType, marks?: number | null): number {
  if (type === QuestionType.THEORY) return marks && marks > 0 ? Math.min(marks, 20) : 8
  if (type === QuestionType.SHORT_ANSWER) return 2
  return 1
}

export const DIFFICULTY_STEPS = ['EASY', 'MEDIUM', 'HARD'] as const

// Adaptive difficulty: step up after 80%+, step down below 50%
export function recommendDifficulty(current: string, scorePercent: number | null): (typeof DIFFICULTY_STEPS)[number] {
  const i = Math.max(0, DIFFICULTY_STEPS.indexOf(current as (typeof DIFFICULTY_STEPS)[number]))
  if (scorePercent === null) return DIFFICULTY_STEPS[i]!
  if (scorePercent >= 80) return DIFFICULTY_STEPS[Math.min(2, i + 1)]!
  if (scorePercent < 50) return DIFFICULTY_STEPS[Math.max(0, i - 1)]!
  return DIFFICULTY_STEPS[i]!
}
