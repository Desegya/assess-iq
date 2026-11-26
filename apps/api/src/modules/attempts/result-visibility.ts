/**
 * What a student may see of their own result, decided by the lecturer per assessment:
 *  - HIDDEN: results not released yet (only that the test was submitted)
 *  - SCORE:  the score, but not which questions were right or the answers
 *  - FULL:   the score plus each question marked, with correct answers and explanations
 *
 * Stored in Assessment.settings: showResultsImmediately (release on submit), resultsReleasedAt
 * (released later by the lecturer) and allowReview (corrections). Missing keys keep the
 * historical defaults: results shown immediately, with corrections.
 */
export type ResultVisibility = 'HIDDEN' | 'SCORE' | 'FULL'

export interface ResultSettings {
  showResultsImmediately?: boolean
  allowReview?: boolean
  resultsReleasedAt?: string | null
}

export function resultVisibility(settings: unknown): ResultVisibility {
  const s = (settings ?? {}) as ResultSettings
  const released = s.showResultsImmediately !== false || !!s.resultsReleasedAt
  if (!released) return 'HIDDEN'
  return s.allowReview === false ? 'SCORE' : 'FULL'
}

/** A–F on the percentage. Default scale; kept in one place so it is easy to change. */
export const GRADE_BANDS: [min: number, grade: string][] = [
  [70, 'A'],
  [60, 'B'],
  [50, 'C'],
  [45, 'D'],
  [40, 'E'],
  [0, 'F'],
]

export function gradeFor(percentage: number | null | undefined): string {
  if (percentage === null || percentage === undefined || Number.isNaN(percentage)) return ''
  return GRADE_BANDS.find(([min]) => percentage >= min)?.[1] ?? 'F'
}
