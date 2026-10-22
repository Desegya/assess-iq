import { BadRequestException } from '@nestjs/common'
import { createHash } from 'crypto'
import type { BankQuestionDto } from './exam-content.dto'

export function subjectIdentity(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase()
  if (['english', 'english language', 'use of english'].includes(normalized)) return 'english'
  if (['math', 'maths', 'general mathematics', 'mathematics'].includes(normalized)) return 'mathematics'
  return normalized
}
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()

/** Version 1 (legacy rows): stem only. Kept to recognise exact copies of older questions. */
export function questionFingerprint(question: string) {
  return createHash('sha256').update(normalize(question)).digest('hex')
}

/**
 * Version 2: stem plus the set of option texts (order-insensitive). Distinct
 * questions that share a common stem ("Which of the following is a noble
 * gas?") are no longer rejected as duplicates; identical items still are.
 */
export function questionFingerprintV2(question: string, options?: { text: string }[] | null) {
  const optionTexts = (options ?? []).map((o) => normalize(o.text)).sort()
  return 'v2:' + createHash('sha256').update([normalize(question), ...optionTexts].join('\n')).digest('hex')
}

export function sameOptionSet(a?: { text: string }[] | null, b?: { text: string }[] | null) {
  const norm = (o?: { text: string }[] | null) => (o ?? []).map((x) => normalize(x.text)).sort().join('\n')
  return norm(a) === norm(b)
}

const words = (text: string) => new Set(normalize(text).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(' ').filter((w) => w.length > 2))

/**
 * Jaccard similarity of the content words of two questions (stem and options).
 * A review signal only: high similarity is shown to reviewers, never used to
 * reject a question automatically.
 */
export function questionSimilarity(
  a: { questionText: string; options?: { text: string }[] | null },
  b: { questionText: string; options?: { text: string }[] | null },
) {
  const set = (q: typeof a) => words([q.questionText, ...(q.options ?? []).map((o) => o.text)].join(' '))
  const x = set(a), y = set(b)
  if (!x.size || !y.size) return 0
  let shared = 0
  for (const w of x) if (y.has(w)) shared++
  return shared / (x.size + y.size - shared)
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
