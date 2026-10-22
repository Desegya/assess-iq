import 'reflect-metadata'
import { describe, expect, it, vi } from 'vitest'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { ExamContentService } from './exam-content.service'
import { BankQuestionDto, GenerateBankDto } from './exam-content.dto'
import { questionFingerprint, subjectIdentity, validateBankQuestion } from './exam-content.rules'

const question = { exam: 'JAMB', subject: 'Government', topic: 'Democracy', questionText: 'Which option describes democracy?', questionType: 'MCQ', options: ['A','B','C','D'].map(key => ({ key, text: `Option ${key}` })), correctAnswer: 'A', explanation: 'Citizens participate in choosing their government.', marks: 1, difficulty: 'MEDIUM' }
describe('Shared exam bank validation', () => {
  it('normalizes subject aliases without restricting arts or languages', () => {
    expect(subjectIdentity('Use of English')).toBe(subjectIdentity('English Language'))
    expect(subjectIdentity(' General Mathematics ')).toBe('mathematics')
    expect(subjectIdentity('Yoruba')).toBe('yoruba')
  })
  it('deduplicates whitespace/case while retaining mathematical distinctions', () => {
    expect(questionFingerprint('What is  2 + 3?')).toBe(questionFingerprint('WHAT IS 2 + 3?'))
    expect(questionFingerprint('What is 2 + 3?')).not.toBe(questionFingerprint('What is 2 - 3?'))
  })
  it('accepts valid four-option questions and rejects malformed keys', () => {
    expect(() => validateBankQuestion(question as BankQuestionDto)).not.toThrow()
    expect(() => validateBankQuestion({ ...question, correctAnswer: 'E' } as BankQuestionDto)).toThrow('matching answer')
    expect(() => validateBankQuestion({ ...question, options: question.options.slice(0, 2) } as BankQuestionDto)).toThrow('four distinct')
  })
  it('requires JAMB MCQs but allows WAEC theory with model answers', () => {
    expect(() => validateBankQuestion({ ...question, questionType: 'THEORY' } as BankQuestionDto)).toThrow('multiple choice')
    expect(() => validateBankQuestion({ ...question, exam: 'WAEC', questionType: 'THEORY' } as BankQuestionDto)).not.toThrow()
  })
  it('bounds AI batches and rejects injected approval or reviewer fields', async () => {
    const dto = plainToInstance(GenerateBankDto, { exam: 'JAMB', subject: 'Government', topic: 'Democracy', count: 100, status: 'APPROVED' })
    expect((await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).map(e => e.property)).toEqual(expect.arrayContaining(['count', 'status']))
  })
  it('does not publish invalid generated items and deduplicates valid drafts', async () => {
    const tx = { nightklassAdmin: { findUnique: vi.fn().mockResolvedValue({ user: { status: 'ACTIVE', organizationId: null } }) },
      examBankQuestion: { createMany: vi.fn().mockResolvedValue({ count: 1 }) }, nightklassAdminAudit: { create: vi.fn() } }
    const service = new ExamContentService({ $transaction: vi.fn(fn => fn(tx)) } as never, { generateQuestions: vi.fn().mockResolvedValue([
      { type: 'MCQ', ...question, options: question.options },
      { type: 'MCQ', ...question, correctAnswer: 'Z' },
    ]) } as never)
    const result = await service.generate(plainToInstance(GenerateBankDto, { exam: 'JAMB', subject: 'Government', topic: 'Democracy', count: 2 }), 'teacher')
    expect(result).toEqual({ saved: 1, rejected: 1, duplicates: 0 })
    expect(tx.examBankQuestion.createMany.mock.calls[0]![0].data[0]).not.toHaveProperty('status', 'APPROVED')
  })
  it('rechecks revoked admin grants inside a write transaction', async () => {
    const tx = { nightklassAdmin: { findUnique: vi.fn().mockResolvedValue(null) }, examMaterial: { create: vi.fn() } }
    const service = new ExamContentService({ $transaction: vi.fn(fn => fn(tx)) } as never, {} as never)
    await expect(service.createMaterial({} as never, 'revoked')).rejects.toThrow('administrator')
    expect(tx.examMaterial.create).not.toHaveBeenCalled()
  })
})
