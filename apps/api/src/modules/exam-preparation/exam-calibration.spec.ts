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
})
