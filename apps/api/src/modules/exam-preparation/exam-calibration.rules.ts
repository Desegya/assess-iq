export interface CalibrationSample {
  questionId: string
  maxMarks: number
  teacherScore: number
  aiScore: number
  questionType?: string
  /** e.g. "Biology". Results are reported per subject; one subject never vouches for another. */
  subject?: string
  /** e.g. "low" | "middle" | "high"; recorded so coverage across ability levels can be checked. */
  abilityBand?: string
  /** Independent second teacher mark for the same script, used to measure human agreement. */
  secondTeacherScore?: number
}

/** Version 1 of the anonymised calibration input. Keep in step with docs/nightklass/09. */
export const CALIBRATION_FORMAT = 'nightklass-marking-calibration/1'

// Calibration files must never carry learner identity or answer text.
const FORBIDDEN_FIELDS = ['name', 'email', 'studentName', 'studentId', 'learnerId', 'answer', 'answerText', 'studentAnswer', 'phone']

/**
 * Launch thresholds, per subject. AI marks may be described as calibrated for a
 * subject only when the sample is large enough, error and bias are small, and
 * the AI agrees with the teacher about as well as two teachers agree.
 */
export const CALIBRATION_THRESHOLDS = {
  minSamplesPerSubject: 60,
  minAbilityBands: 3,
  maxMeanErrorPercentOfMax: 10,
  maxAbsoluteBiasPercentOfMax: 5,
  maxExtraErrorVsTeachers: 2,
}

function validate(samples: CalibrationSample[]) {
  if (!samples.length) throw new Error('Supply at least one independently teacher-marked sample')
  for (const s of samples as unknown as Record<string, unknown>[]) {
    const leaked = FORBIDDEN_FIELDS.filter((f) => f in s)
    if (leaked.length) throw new Error(`Remove identifying or answer fields before calibration: ${leaked.join(', ')}`)
  }
  for (const s of samples)
    if (
      !s.questionId ||
      ![s.maxMarks, s.teacherScore, s.aiScore].every(Number.isFinite) ||
      s.maxMarks <= 0 ||
      s.teacherScore < 0 ||
      s.aiScore < 0 ||
      s.teacherScore > s.maxMarks ||
      s.aiScore > s.maxMarks ||
      (s.secondTeacherScore !== undefined && (!Number.isFinite(s.secondTeacherScore) || s.secondTeacherScore < 0 || s.secondTeacherScore > s.maxMarks))
    )
      throw new Error('Every sample needs an ID, positive maximum marks and bounded teacher/AI scores')
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

function stats(samples: CalibrationSample[]) {
  const errors = samples.map((s) => s.aiScore - s.teacherScore)
  const doubleMarked = samples.filter((s) => s.secondTeacherScore !== undefined)
  return {
    sampleCount: samples.length,
    meanAbsoluteError: mean(errors.map(Math.abs)),
    meanErrorAsPercentOfMax: mean(samples.map((s, i) => (Math.abs(errors[i]!) / s.maxMarks) * 100)),
    signedBias: mean(errors),
    signedBiasPercentOfMax: mean(samples.map((s, i) => (errors[i]! / s.maxMarks) * 100)),
    withinOneMarkPercent: (samples.filter((_, i) => Math.abs(errors[i]!) <= 1).length / samples.length) * 100,
    withinTenPercentOfMaxPercent:
      (samples.filter((s, i) => Math.abs(errors[i]!) <= s.maxMarks * 0.1).length / samples.length) * 100,
    maxAbsoluteError: Math.max(...errors.map(Math.abs)),
    abilityBands: [...new Set(samples.map((s) => s.abilityBand).filter(Boolean))],
    teacherAgreementErrorPercentOfMax: doubleMarked.length
      ? mean(doubleMarked.map((s) => (Math.abs(s.teacherScore - s.secondTeacherScore!) / s.maxMarks) * 100))
      : null,
  }
}

/** Compare independently teacher-marked examples; never infer quality from synthetic scores. */
export function summarizeCalibration(samples: CalibrationSample[]) {
  validate(samples)
  const t = CALIBRATION_THRESHOLDS
  const bySubject = new Map<string, CalibrationSample[]>()
  for (const s of samples) bySubject.set(s.subject ?? '(unspecified)', [...(bySubject.get(s.subject ?? '(unspecified)') ?? []), s])
  const subjects = [...bySubject].map(([subject, group]) => {
    const st = stats(group)
    const reasons: string[] = []
    if (subject === '(unspecified)') reasons.push('subject not recorded')
    if (st.sampleCount < t.minSamplesPerSubject) reasons.push(`needs at least ${t.minSamplesPerSubject} samples`)
    if (st.abilityBands.length < t.minAbilityBands) reasons.push(`needs scripts from at least ${t.minAbilityBands} ability bands`)
    if (st.teacherAgreementErrorPercentOfMax === null) reasons.push('needs independent second teacher marks to measure human agreement')
    const insufficient = reasons.length > 0
    if (st.meanErrorAsPercentOfMax > t.maxMeanErrorPercentOfMax) reasons.push(`mean error ${st.meanErrorAsPercentOfMax.toFixed(1)}% of max exceeds ${t.maxMeanErrorPercentOfMax}%`)
    if (Math.abs(st.signedBiasPercentOfMax) > t.maxAbsoluteBiasPercentOfMax) reasons.push(`bias ${st.signedBiasPercentOfMax.toFixed(1)}% of max exceeds ±${t.maxAbsoluteBiasPercentOfMax}%`)
    if (st.teacherAgreementErrorPercentOfMax !== null && st.meanErrorAsPercentOfMax > st.teacherAgreementErrorPercentOfMax + t.maxExtraErrorVsTeachers)
      reasons.push('AI disagrees with teachers more than teachers disagree with each other')
    return {
      subject,
      ...st,
      verdict: insufficient ? 'INSUFFICIENT_SAMPLE' : reasons.length ? 'NOT_CALIBRATED' : 'CALIBRATED',
      reasons,
    }
  })
  return {
    format: CALIBRATION_FORMAT,
    thresholds: t,
    ...stats(samples),
    subjects,
    note: 'This report describes only the supplied teacher-marked sample. It does not establish official grading equivalence or generalize to other subjects, prompts or models.',
  }
}
