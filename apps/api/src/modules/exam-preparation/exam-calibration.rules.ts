export interface CalibrationSample {
  questionId: string
  maxMarks: number
  teacherScore: number
  aiScore: number
  questionType?: string
}
/** Compare independently teacher-marked examples; never infer quality from synthetic scores. */
export function summarizeCalibration(samples: CalibrationSample[]) {
  if (!samples.length) throw new Error('Supply at least one independently teacher-marked sample')
  for (const s of samples)
    if (
      !s.questionId ||
      ![s.maxMarks, s.teacherScore, s.aiScore].every(Number.isFinite) ||
      s.maxMarks <= 0 ||
      s.teacherScore < 0 ||
      s.aiScore < 0 ||
      s.teacherScore > s.maxMarks ||
      s.aiScore > s.maxMarks
    )
      throw new Error(
        'Every sample needs an ID, positive maximum marks and bounded teacher/AI scores',
      )
  const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length
  const errors = samples.map((s) => s.aiScore - s.teacherScore)
  return {
    sampleCount: samples.length,
    meanAbsoluteError: mean(errors.map(Math.abs)),
    meanErrorAsPercentOfMax: mean(samples.map((s, i) => (Math.abs(errors[i]!) / s.maxMarks) * 100)),
    signedBias: mean(errors),
    withinOneMarkPercent:
      (samples.filter((_, i) => Math.abs(errors[i]!) <= 1).length / samples.length) * 100,
    withinTenPercentOfMaxPercent:
      (samples.filter((s, i) => Math.abs(errors[i]!) <= s.maxMarks * 0.1).length / samples.length) *
      100,
    maxAbsoluteError: Math.max(...errors.map(Math.abs)),
    note: 'This report describes only the supplied teacher-marked sample. It does not establish official grading equivalence or generalize to other subjects.',
  }
}
