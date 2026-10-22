import { describe, it, expect } from 'vitest'
import { summarizeCalibration } from './exam-calibration.rules'
describe('Teacher/AI marking calibration', () => {
  it('reports partial-credit disagreement and signed bias', () => {
    const result = summarizeCalibration([
      { questionId: 'a', maxMarks: 10, teacherScore: 5, aiScore: 6 },
      { questionId: 'b', maxMarks: 10, teacherScore: 8, aiScore: 6 },
    ])
    expect(result.meanAbsoluteError).toBe(1.5)
    expect(result.signedBias).toBe(-0.5)
    expect(result.withinOneMarkPercent).toBe(50)
  })
  it('rejects empty, unbounded and nonfinite scores', () => {
    expect(() => summarizeCalibration([])).toThrow('teacher-marked')
    expect(() =>
      summarizeCalibration([{ questionId: 'a', maxMarks: 10, teacherScore: 11, aiScore: 5 }]),
    ).toThrow('bounded')
    expect(() =>
      summarizeCalibration([{ questionId: 'a', maxMarks: 10, teacherScore: 5, aiScore: NaN }]),
    ).toThrow('bounded')
  })
  // Synthetic fixtures exercise the decision rules only; they are not calibration evidence.
  const synthetic = (n: number, aiOffset: (i: number) => number, subject = 'Biology') =>
    Array.from({ length: n }, (_, i) => ({
      questionId: `q${i}`,
      subject,
      abilityBand: ['low', 'middle', 'high'][i % 3],
      maxMarks: 10,
      teacherScore: 5,
      secondTeacherScore: i % 2 ? 6 : 5,
      aiScore: Math.min(10, Math.max(0, 5 + aiOffset(i))),
    }))
  it('calls a subject calibrated only with enough double-marked scripts across ability bands', () => {
    const ok = summarizeCalibration(synthetic(60, (i) => (i % 2 ? 1 : 0)))
    expect(ok.subjects[0]!.verdict).toBe('CALIBRATED')
    const small = summarizeCalibration(synthetic(20, () => 0))
    expect(small.subjects[0]!.verdict).toBe('INSUFFICIENT_SAMPLE')
    expect(small.subjects[0]!.reasons.join()).toMatch(/at least 60/)
  })
  it('flags systematic over-marking and judges each subject separately', () => {
    const result = summarizeCalibration([...synthetic(60, () => 2), ...synthetic(60, () => 0, 'Economics')])
    const bio = result.subjects.find((s) => s.subject === 'Biology')!
    expect(bio.verdict).toBe('NOT_CALIBRATED')
    expect(bio.reasons.join()).toMatch(/bias/)
    expect(result.subjects.find((s) => s.subject === 'Economics')!.verdict).toBe('CALIBRATED')
  })
  it('refuses files carrying learner identity or answer text', () => {
    expect(() =>
      summarizeCalibration([{ questionId: 'a', maxMarks: 10, teacherScore: 5, aiScore: 5, studentName: 'Ada' } as never]),
    ).toThrow(/identifying/)
  })
})
