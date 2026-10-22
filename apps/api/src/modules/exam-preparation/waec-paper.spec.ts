import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { chosenWaecQuestions, markWaec, validateSections, WaecQuestion } from './waec-paper.rules'
import { SaveMockDto } from './exam-mock.dto'
const sections = [
  {
    id: 'a',
    title: 'Compulsory objectives',
    questionType: 'MCQ' as const,
    count: 1,
    choose: 1,
    marks: 1,
  },
  {
    id: 'b',
    title: 'Essay choices',
    questionType: 'THEORY' as const,
    count: 2,
    choose: 1,
    marks: 10,
  },
]
const questions: WaecQuestion[] = [
  {
    id: '1',
    subject: 'Government',
    subjectKey: 'government',
    topic: 'Democracy',
    sectionId: 'a',
    questionText: 'Which is correct?',
    questionType: 'MCQ',
    options: [{ key: 'A', text: 'Answer' }],
    correctAnswer: 'A',
    explanation: 'Because A',
    marks: 1,
    bankRevision: 1,
  },
  ...[2, 3].map((id) => ({
    id: String(id),
    subject: 'Government',
    subjectKey: 'government',
    topic: 'Democracy',
    sectionId: 'b',
    questionText: '(a) Define democracy. (b) Explain two benefits.',
    questionType: 'THEORY' as const,
    options: [],
    correctAnswer: 'Definition and two benefits.',
    explanation: 'Award definition marks and marks per benefit.',
    marks: 10,
    bankRevision: 1,
  })),
]
describe('WAEC paper rules', () => {
  it('rejects duplicate sections and impossible choice rules', () => {
    expect(() => validateSections([sections[0]!, sections[0]!])).toThrow('unique')
    expect(() => validateSections([{ ...sections[1]!, choose: 3 }])).toThrow('cannot exceed')
    expect(() => validateSections([{ ...sections[0]!, marks: 2 }])).toThrow('one mark')
  })
  it('selects compulsory items automatically and checks optional groups on submission', () => {
    expect(chosenWaecQuestions(questions, sections, ['2'], true).map((q) => q.id)).toEqual([
      '1',
      '2',
    ])
    expect(() => chosenWaecQuestions(questions, sections, [], true)).toThrow('select 1')
    expect(() => chosenWaecQuestions(questions, sections, ['2', '3'])).toThrow('select 1')
    expect(() => chosenWaecQuestions(questions, sections, ['foreign'])).toThrow('does not belong')
  })
  it('allows incomplete choices at expiry while preserving the full paper denominator', () => {
    const result = markWaec(questions, sections, [], { '1': 'A' })
    expect(result.maxMarks).toBe(11)
    expect(result.earnedMarks).toBe(1)
    expect(result.percentage).toBe(9)
  })
  it('keeps nonblank written answers ungraded until feedback arrives', () => {
    const result = markWaec(
      questions,
      sections,
      ['2'],
      { '1': 'A', '2': 'My written answer' },
      [],
      true,
    )
    expect(result.percentage).toBeNull()
    expect(result.ungradedMarks).toBe(10)
    expect(result.results.find((r) => r.questionId === '2')!.score).toBeNull()
  })
  it('applies rubric partial credit and excludes unselected answers', () => {
    const result = markWaec(
      questions,
      sections,
      ['2'],
      { '1': 'A', '2': 'Definition', '3': 'Ignored' },
      [{ id: '2', score: 4.5, feedback: 'Add benefits', missingPoints: ['Two benefits'] }],
    )
    expect(result.earnedMarks).toBe(5.5)
    expect(result.percentage).toBe(50)
    expect(result.results).toHaveLength(2)
    expect(result.results[1]!.missingPoints).toEqual(['Two benefits'])
  })
  it('marks blank written answers zero without a provider and clamps invalid grade ranges', () => {
    expect(markWaec(questions, sections, ['2'], {}).ungradedMarks).toBe(0)
    expect(
      markWaec(questions, sections, ['2'], { '2': 'answer' }, [
        { id: '2', score: 1000, feedback: '', missingPoints: [] },
      ]).earnedMarks,
    ).toBe(10)
  })
  it('accepts bounded written payloads but rejects oversized responses and forged grading fields', async () => {
    const good = plainToInstance(SaveMockDto, {
      expectedVersion: 1,
      answers: [{ questionId: '2', answer: 'Written response' }],
      flags: [],
      selectedQuestions: ['2'],
    })
    expect(await validate(good, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0)
    const bad = plainToInstance(SaveMockDto, {
      expectedVersion: 1,
      answers: [{ questionId: '2', answer: 'x'.repeat(6001) }],
      flags: [],
      score: 100,
    })
    expect(
      (await validate(bad, { whitelist: true, forbidNonWhitelisted: true })).length,
    ).toBeGreaterThan(0)
  })
})
