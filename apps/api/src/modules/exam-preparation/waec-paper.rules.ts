import { BadRequestException } from '@nestjs/common'
import type { WaecSectionDto } from './waec-paper.dto'
import type { FrozenMockQuestion } from './exam-mock.rules'
export interface WaecQuestion extends FrozenMockQuestion {
  sectionId: string
  questionType: 'MCQ' | 'SHORT_ANSWER' | 'THEORY'
  marks: number
}
export interface WaecGrade {
  id: string
  score: number
  feedback: string
  missingPoints: string[]
}
export function validateSections(sections: WaecSectionDto[]) {
  if (new Set(sections.map((s) => s.id)).size !== sections.length)
    throw new BadRequestException('Section identifiers must be unique')
  if (sections.reduce((sum, s) => sum + s.count, 0) > 200)
    throw new BadRequestException('A paper may contain at most 200 questions')
  for (const s of sections) {
    if (s.choose > s.count)
      throw new BadRequestException('Questions to answer cannot exceed the section question count')
    if (s.questionType === 'MCQ' && s.marks !== 1)
      throw new BadRequestException('Objective questions carry one mark each')
  }
}
export function chosenWaecQuestions(
  questions: WaecQuestion[],
  sections: WaecSectionDto[],
  selected: string[],
  strict = false,
) {
  if (selected.some((id) => !questions.some((q) => q.id === id)))
    throw new BadRequestException('Selected question does not belong to this paper')
  const ids = new Set(selected)
  const chosen: WaecQuestion[] = []
  for (const s of sections) {
    const items = questions.filter((q) => q.sectionId === s.id)
    const picks = s.choose === s.count ? items : items.filter((q) => ids.has(q.id))
    if (picks.length > s.choose || (strict && picks.length !== s.choose))
      throw new BadRequestException(`${s.title}: select ${s.choose} questions`)
    chosen.push(...picks)
  }
  return chosen
}
export function markWaec(
  questions: WaecQuestion[],
  sections: WaecSectionDto[],
  selected: string[],
  answers: Record<string, string>,
  grades: WaecGrade[] = [],
  pending = false,
) {
  const chosen = chosenWaecQuestions(questions, sections, selected)
  const byId = new Map(grades.map((g) => [g.id, g]))
  const results = chosen.map((q) => {
    const written = q.questionType !== 'MCQ'
    const blank = !answers[q.id]?.trim()
    const grade = byId.get(q.id)
    const score = !written
      ? answers[q.id] === q.correctAnswer
        ? q.marks
        : 0
      : blank
        ? 0
        : grade && Number.isFinite(grade.score)
          ? Math.max(0, Math.min(q.marks, grade.score))
          : null
    return {
      questionId: q.id,
      sectionId: q.sectionId,
      topic: q.topic,
      score,
      maxScore: q.marks,
      feedback: grade?.feedback ?? null,
      missingPoints: grade?.missingPoints ?? [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    }
  })
  const maxMarks = sections.reduce((sum, s) => sum + s.choose * s.marks, 0)
  const ungradedMarks = results
    .filter((r) => r.score === null)
    .reduce((sum, r) => sum + r.maxScore, 0)
  const earnedMarks = results.reduce((sum, r) => sum + (r.score ?? 0), 0)
  return {
    exam: 'WAEC',
    results,
    maxMarks,
    earnedMarks,
    ungradedMarks,
    pending,
    percentage: ungradedMarks ? null : Math.round((earnedMarks / maxMarks) * 100),
    scoringNote:
      'Practice marking using teacher model answers and AI feedback. This is not an official WAEC grade. Ungraded written responses are not scored as zero.',
  }
}
