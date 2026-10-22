import { BadRequestException } from '@nestjs/common'

/** Canonical identity shared across a learner's goals. No science-only allowlist. */
export function normalizeSubjects(exam: string, names: string[]) {
  const subjects = names.map(value => {
    const name = value.trim().replace(/\s+/g, ' ')
    if (name.length < 2 || name.length > 100) throw new BadRequestException('Enter a subject name between 2 and 100 characters')
    let key = name.toLocaleLowerCase('en-NG')
    if (['english', 'english language', 'use of english'].includes(key)) key = 'english'
    if (['maths', 'math', 'mathematics', 'general mathematics'].includes(key)) key = 'mathematics'
    return { key, name: key === 'english' ? 'English Language' : key === 'mathematics' ? 'Mathematics' : name }
  })
  if (new Set(subjects.map(s => s.key)).size !== subjects.length) throw new BadRequestException('Choose each subject only once')
  if (exam === 'JAMB' && (subjects.length !== 4 || !subjects.some(s => s.key === 'english'))) {
    throw new BadRequestException('Choose Use of English and three other subjects for JAMB')
  }
  return subjects
}
