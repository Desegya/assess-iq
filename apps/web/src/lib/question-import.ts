// Parses a question paper from CSV (or rows pasted from a spreadsheet) into the
// shape POST /questions/bulk expects, reporting problems per row before upload.

export type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'THEORY'
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'

export interface DraftQuestion {
  questionText: string
  questionType: QuestionType
  options?: { key: string; text: string }[]
  correctAnswer: string
  difficulty: Difficulty
  explanation?: string
}
export interface ParsedRow {
  line: number
  question?: DraftQuestion
  problem?: string
}

export const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F']
export const TEMPLATE_HEADERS = ['type', 'question', 'A', 'B', 'C', 'D', 'E', 'answer', 'difficulty', 'explanation']

export const TEMPLATE_CSV = [
  TEMPLATE_HEADERS.join(','),
  'MCQ,Where in the cell does photosynthesis take place?,Nucleus,Chloroplast,Mitochondrion,Ribosome,,B,EASY,Chlorophyll is in the chloroplasts.',
  'TRUE_FALSE,Respiration releases energy from glucose.,,,,,,True,EASY,',
  'SHORT_ANSWER,Name the green pigment in leaves.,,,,,,Chlorophyll,EASY,',
  'THEORY,Explain the two stages of photosynthesis.,,,,,,"Light-dependent reactions in the thylakoids make ATP and NADPH; the Calvin cycle in the stroma fixes CO2 into glucose.",HARD,',
].join('\n')

/** RFC 4180-style CSV; tab-separated text (pasted from a spreadsheet) works too. */
export function parseDelimited(text: string): string[][] {
  const header = text.split('\n')[0] ?? ''
  const delimiter = header.includes('\t') && !header.includes(',') ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === delimiter) { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(cell => cell.trim() !== ''))
}

const TYPE_ALIASES: Record<string, QuestionType> = {
  mcq: 'MCQ', 'multiple choice': 'MCQ', objective: 'MCQ',
  true_false: 'TRUE_FALSE', 'true/false': 'TRUE_FALSE', tf: 'TRUE_FALSE', 't/f': 'TRUE_FALSE', 'true false': 'TRUE_FALSE',
  short_answer: 'SHORT_ANSWER', short: 'SHORT_ANSWER', 'short answer': 'SHORT_ANSWER', 'fill in': 'SHORT_ANSWER',
  theory: 'THEORY', essay: 'THEORY', long: 'THEORY',
}

export function parseQuestionPaper(text: string): ParsedRow[] {
  const rows = parseDelimited(text.replace(/^﻿/, ''))
  if (rows.length === 0) return []
  const header = rows[0]!.map(h => h.trim().toLowerCase())
  const hasHeader = header.includes('question') || header.includes('type')
  const columns = hasHeader ? header : TEMPLATE_HEADERS.map(h => h.toLowerCase())
  const col = (name: string) => columns.indexOf(name.toLowerCase())

  return rows.slice(hasHeader ? 1 : 0).map((cells, i): ParsedRow => {
    const line = i + (hasHeader ? 2 : 1)
    const get = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? '').trim() : '')
    const rawType = get('type').toLowerCase()
    const options = OPTION_KEYS.map(key => ({ key, text: get(key) })).filter(o => o.text)
    const type: QuestionType | undefined = rawType ? TYPE_ALIASES[rawType] : options.length ? 'MCQ' : undefined
    const questionText = get('question')
    const answer = get('answer')
    const difficulty = (get('difficulty').toUpperCase() || 'MEDIUM') as Difficulty

    if (!questionText) return { line, problem: 'The question is empty.' }
    if (!type) return { line, problem: `Unknown type "${get('type')}". Use MCQ, TRUE_FALSE, SHORT_ANSWER or THEORY.` }
    if (!['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) return { line, problem: `Difficulty must be EASY, MEDIUM or HARD, not "${get('difficulty')}".` }
    if (!answer) return { line, problem: type === 'THEORY' ? 'Add a model answer or marking guide.' : 'The answer is empty.' }

    if (type === 'MCQ') {
      if (options.length < 2) return { line, problem: 'A multiple-choice question needs at least two options (columns A, B, …).' }
      const key = answer.toUpperCase()
      const byText = options.find(o => o.text.toLowerCase() === answer.toLowerCase())
      const correct = options.some(o => o.key === key) ? key : byText?.key
      if (!correct) return { line, problem: `The answer "${answer}" is not one of the options. Use the option letter.` }
      return { line, question: { questionText, questionType: type, options, correctAnswer: correct, difficulty, explanation: get('explanation') || undefined } }
    }
    if (type === 'TRUE_FALSE') {
      const tf = /^(t|true|yes)$/i.test(answer) ? 'True' : /^(f|false|no)$/i.test(answer) ? 'False' : null
      if (!tf) return { line, problem: 'The answer to a true/false question must be True or False.' }
      return { line, question: { questionText, questionType: type, correctAnswer: tf, difficulty, explanation: get('explanation') || undefined } }
    }
    return { line, question: { questionText, questionType: type, correctAnswer: answer, difficulty, explanation: get('explanation') || undefined } }
  })
}
