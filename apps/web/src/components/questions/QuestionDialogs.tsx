'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { Notice } from '@/components/auth/FormParts'
import {
  OPTION_KEYS,
  TEMPLATE_CSV,
  parseQuestionPaper,
  type Difficulty,
  type DraftQuestion,
  type QuestionType,
} from '@/lib/question-import'

interface Course { id: string; title: string }

function Dialog({ title, intro, onClose, children, footer }: {
  title: string
  intro: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-modal animate-scale-in">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{intro}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">✕</button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-6">{children}</div>
        <div className="flex gap-3 border-t border-slate-100 p-6">{footer}</div>
      </div>
    </div>
  )
}

function CoursePicker({ courses, value, onChange }: { courses: Course[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor="course" className="mb-1.5 block text-sm font-medium text-slate-700">Class</label>
      <select id="course" value={value} onChange={e => onChange(e.target.value)} className="input-base" required>
        <option value="">Choose a class…</option>
        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
    </div>
  )
}

const TYPES: { value: QuestionType; label: string }[] = [
  { value: 'MCQ', label: 'Multiple choice' },
  { value: 'TRUE_FALSE', label: 'True / false' },
  { value: 'SHORT_ANSWER', label: 'Short answer' },
  { value: 'THEORY', label: 'Theory / essay' },
]

export function WriteQuestionDialog({ courses, defaultCourseId, onClose, onSaved }: {
  courses: Course[]
  defaultCourseId: string
  onClose: () => void
  onSaved: (q: unknown) => void
}) {
  const api = useApi()
  const [courseId, setCourseId] = useState(defaultCourseId)
  const [type, setType] = useState<QuestionType>('MCQ')
  const [text, setText] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [answer, setAnswer] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM')
  const [explanation, setExplanation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  function reset() {
    setText(''); setOptions(['', '', '', '']); setAnswer(''); setExplanation('')
  }

  async function save(addAnother: boolean) {
    setError(null)
    const filled = options.map((t, i) => ({ key: OPTION_KEYS[i]!, text: t.trim() })).filter(o => o.text)
    if (!courseId) return setError('Choose a class.')
    if (type === 'MCQ' && filled.length < 2) return setError('Add at least two options.')
    if (!answer.trim()) return setError(type === 'THEORY' ? 'Add a model answer or marking guide.' : 'Choose the correct answer.')
    setSaving(true)
    try {
      const saved = await api.post('/questions', {
        courseId,
        questionText: text.trim(),
        questionType: type,
        options: type === 'MCQ' ? filled : undefined,
        correctAnswer: answer.trim(),
        difficulty,
        explanation: explanation.trim() || undefined,
      })
      onSaved(saved)
      setSavedCount(n => n + 1)
      if (addAnother) reset()
      else onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the question')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      title="Write a question"
      intro="Questions you write are approved straight away and ready to add to a test."
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary flex-1" disabled={saving} onClick={() => void save(true)}>Save and add another</button>
          <button className="btn-primary flex-1" disabled={saving || !text.trim()} onClick={() => void save(false)}>{saving ? 'Saving…' : 'Save question'}</button>
        </>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}
      {savedCount > 0 && <Notice kind="ok">{savedCount} saved. Keep going.</Notice>}
      <CoursePicker courses={courses} value={courseId} onChange={setCourseId} />
      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">Type</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => { setType(t.value); setAnswer('') }}
              aria-pressed={type === t.value}
              className={`rounded-xl border px-3 py-2 text-sm ${type === t.value ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-slate-200 text-slate-600'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="qtext" className="mb-1.5 block text-sm font-medium text-slate-700">Question</label>
        <textarea id="qtext" rows={3} value={text} onChange={e => setText(e.target.value)} className="input-base" />
      </div>

      {type === 'MCQ' && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Options: tick the correct one</legend>
          <div className="space-y-2">
            {options.map((opt, i) => {
              const key = OPTION_KEYS[i]!
              return (
                <div key={key} className="flex items-center gap-3">
                  <input type="radio" name="correct" aria-label={`Option ${key} is correct`} checked={answer === key} onChange={() => setAnswer(key)} />
                  <span className="w-5 font-mono text-sm text-slate-500">{key}</span>
                  <input value={opt} onChange={e => setOptions(o => o.map((v, j) => (j === i ? e.target.value : v)))} className="input-base" aria-label={`Option ${key}`} />
                </div>
              )
            })}
          </div>
          {options.length < 6 && (
            <button type="button" className="mt-2 text-xs font-medium text-violet-700" onClick={() => setOptions(o => [...o, ''])}>
              + Add option
            </button>
          )}
        </fieldset>
      )}
      {type === 'TRUE_FALSE' && (
        <fieldset className="flex gap-3">
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Correct answer</legend>
          {['True', 'False'].map(v => (
            <label key={v} className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${answer === v ? 'border-violet-300 bg-violet-50' : 'border-slate-200'}`}>
              <input type="radio" name="tf" checked={answer === v} onChange={() => setAnswer(v)} /> {v}
            </label>
          ))}
        </fieldset>
      )}
      {(type === 'SHORT_ANSWER' || type === 'THEORY') && (
        <div>
          <label htmlFor="model" className="mb-1.5 block text-sm font-medium text-slate-700">
            {type === 'THEORY' ? 'Model answer or marking guide' : 'Expected answer'}
          </label>
          <textarea id="model" rows={type === 'THEORY' ? 4 : 2} value={answer} onChange={e => setAnswer(e.target.value)} className="input-base" />
          <p className="mt-1.5 text-xs text-slate-500">You mark written answers yourself after students submit.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <div>
          <label htmlFor="difficulty" className="mb-1.5 block text-sm font-medium text-slate-700">Difficulty</label>
          <select id="difficulty" value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)} className="input-base">
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>
        <div>
          <label htmlFor="explanation" className="mb-1.5 block text-sm font-medium text-slate-700">Explanation (optional)</label>
          <input id="explanation" value={explanation} onChange={e => setExplanation(e.target.value)} className="input-base" placeholder="Shown to students after the test, if you allow review" />
        </div>
      </div>
    </Dialog>
  )
}

export function ImportPaperDialog({ courses, defaultCourseId, onClose, onImported }: {
  courses: Course[]
  defaultCourseId: string
  onClose: () => void
  onImported: (questions: unknown[]) => void
}) {
  const api = useApi()
  const [courseId, setCourseId] = useState(defaultCourseId)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const rows = text.trim() ? parseQuestionPaper(text) : []
  const problems = rows.filter(r => r.problem)
  const ready = rows.filter(r => r.question).map(r => r.question!) as DraftQuestion[]

  async function readFile(file: File) {
    if (file.size > 2_000_000) return setError('That file is too large. Keep it under 2 MB.')
    setText(await file.text())
  }

  async function importAll() {
    setError(null)
    if (!courseId) return setError('Choose a class.')
    setSaving(true)
    try {
      const res = await api.post<{ count: number; questions: unknown[] }>('/questions/bulk', { courseId, questions: ready })
      onImported(res.questions)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import the paper')
      setSaving(false)
    }
  }

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`

  return (
    <Dialog
      title="Import a question paper"
      intro="Upload a CSV, or paste rows copied from Excel or Google Sheets. Nothing is saved until every row is valid."
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" disabled={saving || ready.length === 0 || problems.length > 0 || ready.length > 200} onClick={() => void importAll()}>
            {saving ? 'Importing…' : `Import ${ready.length || ''} question${ready.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}
      <CoursePicker courses={courses} value={courseId} onChange={setCourseId} />
      <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900">
        <p className="font-medium">Columns: type, question, A–E (options), answer, difficulty, explanation</p>
        <p className="mt-1 text-xs text-violet-800">
          Types: MCQ, TRUE_FALSE, SHORT_ANSWER, THEORY. For MCQ the answer is the option letter. Difficulty is EASY, MEDIUM or HARD
          (MEDIUM if blank).
        </p>
        <a href={templateHref} download="kwikeval-question-template.csv" className="mt-3 inline-flex text-xs font-semibold text-violet-700 underline">
          Download the template
        </a>
      </div>
      <div>
        <label htmlFor="file" className="mb-1.5 block text-sm font-medium text-slate-700">CSV file</label>
        <input id="file" type="file" accept=".csv,text/csv,text/plain" onChange={e => e.target.files?.[0] && void readFile(e.target.files[0])} />
      </div>
      <div>
        <label htmlFor="paste" className="mb-1.5 block text-sm font-medium text-slate-700">…or paste rows</label>
        <textarea id="paste" rows={6} value={text} onChange={e => setText(e.target.value)} className="input-base font-mono !text-xs" placeholder={TEMPLATE_CSV.split('\n').slice(0, 2).join('\n')} />
      </div>
      {rows.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700">
            {ready.length} ready{problems.length > 0 && <span className="text-red-700"> · {problems.length} to fix</span>}
            {ready.length > 200 && <span className="text-red-700"> · import at most 200 at a time</span>}
          </p>
          <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-100 text-xs">
            {rows.map(r => (
              <li key={r.line} className={`flex gap-3 px-3 py-2 ${r.problem ? 'bg-red-50 text-red-800' : 'text-slate-700'}`}>
                <span className="w-12 shrink-0 text-slate-500">Row {r.line}</span>
                <span className="min-w-0 flex-1 truncate">{r.problem ?? `${r.question!.questionType} · ${r.question!.questionText}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  )
}
