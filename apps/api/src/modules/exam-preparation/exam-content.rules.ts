import { BadRequestException } from '@nestjs/common'
import { createHash } from 'crypto'
import type { BankQuestionDto } from './exam-content.dto'

/**
 * Canonical subject keys for names and abbreviations that unambiguously mean the
 * same WAEC/JAMB subject. Anything not listed keeps its own lower-cased key, so
 * custom subjects still work and genuinely different subjects (for example JAMB
 * "Agriculture" and WAEC "Agricultural Science", or "Principles of Accounts" and
 * "Financial Accounting") are never merged by guesswork.
 */
export const SUBJECT_ALIASES: Record<string, string[]> = {
  english: ['english', 'english language', 'use of english'],
  mathematics: ['math', 'maths', 'general mathematics', 'mathematics'],
  'further mathematics': ['further mathematics', 'further maths', 'further math'],
  'christian religious studies': [
    'christian religious studies',
    'christian religious knowledge',
    'crs',
    'crk',
  ],
  'islamic studies': ['islamic studies', 'islamic religious studies', 'islamic religious knowledge', 'irs', 'irk'],
  'literature in english': ['literature in english', 'literature-in-english', 'lit in english', 'lit-in-english', 'literature'],
  'agricultural science': ['agricultural science', 'agric', 'agric science', 'agric. science'],
  economics: ['economics', 'econs'],
  government: ['government', 'govt'],
  geography: ['geography', 'geog'],
  biology: ['biology', 'bio'],
  chemistry: ['chemistry', 'chem'],
  physics: ['physics', 'phy'],
}
/** Display names for canonical keys, so "CRK" is shown as the full subject name. */
export const SUBJECT_NAMES: Record<string, string> = {
  english: 'English Language',
  mathematics: 'Mathematics',
  'further mathematics': 'Further Mathematics',
  'christian religious studies': 'Christian Religious Studies',
  'islamic studies': 'Islamic Studies',
  'literature in english': 'Literature in English',
  'agricultural science': 'Agricultural Science',
  economics: 'Economics',
  government: 'Government',
  geography: 'Geography',
  biology: 'Biology',
  chemistry: 'Chemistry',
  physics: 'Physics',
}
const ALIAS_INDEX = new Map(Object.entries(SUBJECT_ALIASES).flatMap(([key, names]) => names.map((n) => [n, key])))

export function subjectIdentity(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase()
  return ALIAS_INDEX.get(normalized) ?? normalized
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

/** Longest single teaching note; longer documents are saved as numbered parts. */
export const MATERIAL_PART_CHARS = 40_000
/** Longest notes accepted in one upload or paste (roughly 250 pages of text). */
export const MATERIAL_MAX_CHARS = 500_000

/**
 * Splits long notes into parts of at most `max` characters, preferring to break
 * between paragraphs, then between lines, so a topic is rarely cut mid-sentence.
 */
export function splitMaterial(body: string, max = MATERIAL_PART_CHARS) {
  const parts: string[] = []
  let rest = body.trim()
  while (rest.length > max) {
    const window = rest.slice(0, max)
    let cut = window.lastIndexOf('\n\n')
    if (cut < max / 2) cut = window.lastIndexOf('\n')
    if (cut < max / 2) cut = window.lastIndexOf(' ')
    if (cut < max / 2) cut = max
    parts.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) parts.push(rest)
  return parts
}

/**
 * A paragraph-aligned excerpt of long notes for one generation request. The
 * start is random, so repeated batches cover the whole note rather than only
 * its opening pages.
 */
export function materialExcerpt(body: string, max: number, random = Math.random) {
  if (body.length <= max) return body
  let start = Math.floor(random() * (body.length - max))
  const paragraph = body.lastIndexOf('\n\n', start)
  if (paragraph >= 0 && start - paragraph < max / 4) start = paragraph + 2
  return body.slice(start, start + max).trim()
}
