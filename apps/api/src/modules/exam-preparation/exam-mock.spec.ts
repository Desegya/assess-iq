import { describe, it, expect } from 'vitest'
import { markMock, FrozenMockQuestion } from './exam-mock.rules'
const q = (id: string, subject: string, topic: string): FrozenMockQuestion => ({ id, subjectKey: subject, subject, topic, questionText: 'Question', options: [{ key: 'A', text: 'Answer' }], correctAnswer: 'A', explanation: 'Explanation', bankRevision: 1 })
describe('Mock scoring', () => {
  it('scales each subject independently and labels the estimate', () => {
    const result = markMock([q('1','english','Comprehension'),q('2','english','Grammar'),q('3','government','Democracy')], { '1': 'A', '2': 'B', '3': 'A' })
    expect(result.practiceScore).toBe(150)
    expect(result.subjects[0]!.practiceScore).toBe(50)
    expect(result.scoringNote).toContain('not an official')
    expect(result.subjects[0]!.topics.find(t => t.topic === 'Grammar')!.correct).toBe(0)
  })
  it('counts unanswered questions and ignores forged answer identities', () => {
    const result = markMock([q('1','english','Grammar')], { foreign: 'A' })
    expect(result.practiceScore).toBe(0)
    expect(result.subjects[0]!.unanswered).toBe(1)
  })
})
