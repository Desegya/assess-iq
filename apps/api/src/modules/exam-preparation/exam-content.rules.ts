import { BadRequestException } from '@nestjs/common'
import { createHash } from 'crypto'
import type { BankQuestionDto } from './exam-content.dto'

export function subjectIdentity(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase()
  if (['english', 'english language', 'use of english'].includes(normalized)) return 'english'
  if (['math', 'maths', 'general mathematics', 'mathematics'].includes(normalized)) return 'mathematics'
  return normalized
}
export function questionFingerprint(question: string) {
  return createHash('sha256').update(question.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex')
}
export function validateBankQuestion(q: BankQuestionDto) {
  if (!q.questionText.trim() || !q.correctAnswer.trim() || !q.explanation.trim()) throw new BadRequestException('Question, model answer and explanation are required')
  if (q.questionType === 'MCQ') {
    const options = q.options ?? []
    if (options.length !== 4 || new Set(options.map(o => o.key)).size !== 4 ||
      options.some(o => !['A', 'B', 'C', 'D'].includes(o.key) || !o.text.trim()) ||
      !options.some(o => o.key === q.correctAnswer)) throw new BadRequestException('Provide four distinct A–D options and a matching answer key')
  }
  if (q.questionType === 'TRUE_FALSE' && !['true', 'false'].includes(q.correctAnswer)) throw new BadRequestException('True/false answers must be true or false')
  if (['MCQ', 'TRUE_FALSE'].includes(q.questionType) && q.marks !== 1) throw new BadRequestException('Objective practice questions carry one mark each')
  if (q.exam === 'JAMB' && q.questionType !== 'MCQ') throw new BadRequestException('JAMB bank questions must be multiple choice')
  if (!Number.isInteger(q.marks) || q.marks < 1 || q.marks > 100) throw new BadRequestException('Marks must be between 1 and 100')
}
