'use client'

import { MathText } from '@/components/product/MathText'
import { AdminExamCalendars } from './AdminExamCalendars'
import { AdminExamSyllabuses, type Syllabus } from './AdminExamSyllabuses'
import { AdminWaecPapers } from './AdminWaecPapers'
import { AdminMockTemplates } from './AdminMockTemplates'
import { useEffect, useRef, useState } from 'react'
import { ADMIN_EXAM_SUBJECTS } from '@/lib/exam-subjects'
import { adminRequest, useAdminData } from './admin-api'

type Material = {
  id: string
  title: string
  subject: string
  topic: string
  status: string
  sourceNote: string
  classLevel?: string | null
}
type Question = {
  objectiveLinks?: { objectiveId: string }[]
  id: string
  exam: string
  subject: string
  topic: string
  status: string
  revision: number
  questionText: string
  questionType: string
  options?: { key: string; text: string }[]
  correctAnswer: string
  explanation: string
  marks: number
  difficulty: string
  isAiGenerated: boolean
}
const OTHER_SUBJECT = '__other__'

interface GenerationJob {
  id: string
  status: string
  attempts: number
  error: string | null
  payload: { subject: string; topic?: string; count: number } & Record<string, unknown>
  result: { saved: number; rejected: number; duplicates: number } | null
}
const JOB_LABEL: Record<string, string> = {
  QUEUED: 'Waiting',
  RUNNING: 'Generating',
  SUCCEEDED: 'Done',
  FAILED: 'Failed',
}

/** One summary for a generate request, however many 10-question batches it became. */
function GenerationProgress({
  jobs,
  onReview,
  onRetry,
}: {
  jobs: GenerationJob[]
  onReview: () => void
  onRetry: () => void
}) {
  const asked = jobs.reduce((n, j) => n + (j.payload.count ?? 0), 0)
  const saved = jobs.reduce((n, j) => n + (j.result?.saved ?? 0), 0)
  const failed = jobs.filter((j) => j.status === 'FAILED')
  const done = jobs.filter((j) => j.status === 'SUCCEEDED' || j.status === 'FAILED').length
  const complete = done === jobs.length
  const skipped = jobs.reduce(
    (n, j) => n + (j.result ? j.result.duplicates + j.result.rejected : 0),
    0,
  )
  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-3 rounded-xl border border-violet-200 bg-violet-50 p-4"
    >
      <p className="font-medium">
        {complete
          ? `${saved} of ${asked} questions ready to review`
          : `Generating ${asked} questions… ${saved} ready so far`}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-violet-100" aria-hidden>
        <div
          className="h-full bg-violet-600 transition-all"
          style={{ width: `${Math.round((done / jobs.length) * 100)}%` }}
        />
      </div>
      {complete && (skipped > 0 || failed.length > 0) && (
        <p className="text-sm text-slate-600">
          {skipped > 0 && `${skipped} skipped as duplicates or unusable. `}
          {failed.length > 0 && `${failed.length} batch${failed.length === 1 ? '' : 'es'} failed.`}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {saved > 0 && (
          <button type="button" className="btn-primary" onClick={onReview}>
            Review drafts
          </button>
        )}
        {complete && failed.length > 0 && (
          <button type="button" className="btn-secondary" onClick={onRetry}>
            Retry failed
          </button>
        )}
      </div>
    </div>
  )
}

export function AdminExamContent() {
  const [exam, setExam] = useState('JAMB')
  const [subject, setSubject] = useState('')
  // A subject outside the standard list is typed in instead of chosen.
  const [customSubject, setCustomSubject] = useState(false)
  const [topic, setTopic] = useState('')
  const [title, setTitle] = useState('')
  const [sourceNote, setSourceNote] = useState('')
  const [body, setBody] = useState('')
  // Several files can be uploaded at once; each becomes its own draft note.
  const [files, setFiles] = useState<File[]>([])
  const [notesClass, setNotesClass] = useState('')
  const [uploadProgress, setUploadProgress] = useState<{
    done: number
    total: number
    failed: { name: string; reason: string }[]
  } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // Teaching-notes scope, defaulting to whatever the generation card has selected.
  const [notesExam, setNotesExam] = useState('')
  const [notesSubject, setNotesSubject] = useState('')
  const [notesCustom, setNotesCustom] = useState(false)
  const [notesTopic, setNotesTopic] = useState('')
  const [objectiveIds, setObjectiveIds] = useState<string[]>([])
  const syllabusData = useAdminData<Syllabus[]>('exam-content/syllabuses')
  const matchingObjectives =
    syllabusData.data
      ?.filter(
        (s) =>
          s.exam === exam &&
          s.subject.trim().toLowerCase() === subject.trim().toLowerCase() &&
          s.status !== 'ARCHIVED',
      )
      .flatMap((s) => s.objectives.map((o) => ({ ...o, version: s.version, year: s.year }))) ?? []
  const [materialId, setMaterialId] = useState('')
  const [count, setCount] = useState(5)
  const [difficulty, setDifficulty] = useState('MEDIUM')
  const [questionType, setQuestionType] = useState('MCQ')
  const [preview, setPreview] = useState<{ title: string; body: string } | null>(null)
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<Question | null>(null)
  const [editJson, setEditJson] = useState('')
  const [manual, setManual] = useState(false)
  const draft = editJson ? JSON.parse(editJson) : null
  function updateDraft(field: string, value: unknown) {
    setEditJson(JSON.stringify({ ...draft, [field]: value }))
  }
  const query = new URLSearchParams({
    exam,
    ...(subject.trim() ? { subject: subject.trim() } : {}),
  })
  const materials = useAdminData<{ items: Material[]; total: number }>(
    `exam-content/materials?${query}`,
  )
  const [statusFilter, setStatusFilter] = useState('')
  const questions = useAdminData<{ items: Question[]; total: number }>(
    `exam-content/questions?${query}&page=${page}${statusFilter ? `&status=${statusFilter}` : ''}`,
  )
  const jobs = useAdminData<GenerationJob[]>('exam-content/generation-jobs')
  // Jobs queued by the latest "Generate" click, summarised as one progress card.
  const [runIds, setRunIds] = useState<string[]>([])
  const runJobs = (jobs.data ?? []).filter((j) => runIds.includes(j.id))
  const active = (jobs.data ?? []).some((j) => j.status === 'QUEUED' || j.status === 'RUNNING')
  const finished = runJobs.filter((j) => j.status === 'SUCCEEDED' || j.status === 'FAILED').length
  // Poll only while something is generating, and refresh the bank as batches land.
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => jobs.reload(), 4000)
    return () => clearInterval(timer)
  }, [active, jobs.reload])
  useEffect(() => {
    if (finished) questions.reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])
  // Feedback appears pinned to the bottom of the screen, wherever the teacher has scrolled.
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 6000)
    return () => clearTimeout(timer)
  }, [message])
  async function run(work: () => Promise<string>) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      setMessage(await work())
      materials.reload()
      questions.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }
  const notesExamValue = notesExam || exam
  const notesSubjectValue = notesCustom ? notesSubject : notesSubject || subject
  const notesTopicValue = notesTopic.trim() || topic.trim() || 'General notes'
  const notesMissing = [
    ...(notesSubjectValue.trim().length < 2 ? ['a subject'] : []),
    ...(!files.length && body.trim().length < 20
      ? ['files to upload or at least 20 characters of notes']
      : []),
  ]
  function edit(q: Question) {
    setEditing(q)
    setManual(false)
    const {
      exam,
      subject,
      topic,
      questionText,
      questionType,
      options,
      correctAnswer,
      explanation,
      marks,
      difficulty,
    } = q
    setEditJson(
      JSON.stringify(
        {
          objectiveIds: q.objectiveLinks?.map((l) => l.objectiveId) ?? [],
          exam,
          subject,
          topic,
          questionText,
          questionType,
          options,
          correctAnswer,
          explanation,
          marks,
          difficulty,
        },
        null,
        2,
      ),
    )
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">WAEC / JAMB content</h1>
      <p className="text-sm text-slate-600">
        Pick a subject, generate questions, skim them and approve. Notes, syllabuses, dates and mock
        settings are optional and live further down.
      </p>
      {(error || materials.error || questions.error || message) && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl">
          <div
            role={error || materials.error || questions.error ? 'alert' : 'status'}
            className={`flex items-start gap-3 rounded-xl p-4 text-sm shadow-lg ${error || materials.error || questions.error ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}
          >
            <p className="flex-1">{error || materials.error || questions.error || message}</p>
            <button
              className="text-white/80 hover:text-white"
              aria-label="Dismiss"
              onClick={() => {
                setError('')
                setMessage('')
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <section className="card space-y-4 border-violet-200 p-5">
        <h2 className="text-lg font-semibold">Generate questions with AI</h2>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            Exam
            <select
              className="input-base mt-2"
              value={exam}
              onChange={(e) => {
                setExam(e.target.value)
                setPage(1)
                setMaterialId('')
                setObjectiveIds([])
                setQuestionType('MCQ')
              }}
            >
              <option>JAMB</option>
              <option>WAEC</option>
            </select>
          </label>
          <div className="text-sm">
            <label htmlFor="generation-subject">Subject</label>
            <select
              id="generation-subject"
              className="input-base mt-2"
              value={customSubject ? OTHER_SUBJECT : subject}
              onChange={(e) => {
                const other = e.target.value === OTHER_SUBJECT
                setCustomSubject(other)
                setSubject(other ? '' : e.target.value)
                setMaterialId('')
                setObjectiveIds([])
                setPage(1)
              }}
            >
              <option value="">Choose a subject</option>
              {ADMIN_EXAM_SUBJECTS.map((name) => (
                <option key={name}>{name}</option>
              ))}
              <option value={OTHER_SUBJECT}>Other subject…</option>
            </select>
          </div>
          {customSubject && (
            <label className="text-sm">
              Subject name
              <input
                className="input-base mt-2"
                maxLength={100}
                autoFocus
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value)
                  setMaterialId('')
                  setObjectiveIds([])
                  setPage(1)
                }}
                placeholder="Type the subject"
              />
            </label>
          )}
          <label className="text-sm">
            Topic (optional)
            <input
              className="input-base mt-2"
              maxLength={150}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Leave blank to cover the whole syllabus"
            />
          </label>
        </fieldset>
        {matchingObjectives.length > 0 && (
          <fieldset className="card space-y-3 p-5" disabled={busy}>
            <legend className="font-semibold">
              Link generated or new questions to syllabus objectives
            </legend>
            {matchingObjectives.map((o) => (
              <label className="flex gap-2 text-sm" key={o.id}>
                <input
                  type="checkbox"
                  checked={objectiveIds.includes(o.id)}
                  onChange={() =>
                    setObjectiveIds((old) =>
                      old.includes(o.id) ? old.filter((id) => id !== o.id) : [...old, o.id],
                    )
                  }
                />
                {o.code} · {o.title} · {o.year} v{o.version}
              </label>
            ))}
          </fieldset>
        )}
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              // The server generates up to 10 questions per batch; larger requests become several batches.
              const batches = Math.ceil(count / 10)
              const ids: string[] = []
              for (let i = 0; i < batches; i++) {
                const job = await adminRequest<{ id: string }>('exam-content/generation-jobs', {
                  method: 'POST',
                  body: JSON.stringify({
                    exam,
                    subject,
                    ...(topic.trim() ? { topic: topic.trim() } : {}),
                    count: Math.min(10, count - i * 10),
                    difficulty,
                    questionType,
                    objectiveIds,
                    requestKey: crypto.randomUUID(),
                    ...(materialId ? { materialId } : {}),
                  }),
                })
                ids.push(job.id)
              }
              setRunIds(ids)
              jobs.reload()
              return `Generating ${count} questions. Progress is shown below; you can leave this page.`
            })
          }}
        >
          <p className="text-sm text-slate-600">
            {materialId
              ? 'Using your selected teaching notes as extra context.'
              : 'Notes are optional — the AI writes from the subject (and topic, if given).'}{' '}
            Questions are original practice items, not past papers, and stay as drafts until you
            approve them.
          </p>
          <fieldset disabled={busy} className="flex flex-wrap gap-4">
            <label className="text-sm">
              How many
              <input
                type="number"
                className="input-base mt-1"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
            <label className="text-sm">
              Difficulty
              <select
                className="input-base mt-1"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option>EASY</option>
                <option>MEDIUM</option>
                <option>HARD</option>
              </select>
            </label>
            <label className="text-sm">
              Question type
              <select
                className="input-base mt-1"
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
              >
                {(exam === 'JAMB' ? ['MCQ'] : ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'THEORY']).map(
                  (t) => (
                    <option key={t}>{t}</option>
                  ),
                )}
              </select>
            </label>
            {materialId && (
              <button type="button" className="btn-secondary" onClick={() => setMaterialId('')}>
                Stop using notes
              </button>
            )}
            <button className="btn-primary" disabled={subject.trim().length < 2 || count < 1}>
              {busy ? 'Working…' : 'Generate questions'}
            </button>
          </fieldset>
        </form>
        {runJobs.length > 0 && (
          <GenerationProgress
            jobs={runJobs}
            onReview={() => {
              setStatusFilter('DRAFT')
              setPage(1)
              document.getElementById('question-bank')?.scrollIntoView({ behavior: 'smooth' })
            }}
            onRetry={() =>
              void run(async () => {
                const failed = runJobs.filter((j) => j.status === 'FAILED')
                const ids = runIds.filter((id) => !failed.some((j) => j.id === id))
                for (const j of failed) {
                  const job = await adminRequest<{ id: string }>('exam-content/generation-jobs', {
                    method: 'POST',
                    body: JSON.stringify({ ...j.payload, requestKey: crypto.randomUUID() }),
                  })
                  ids.push(job.id)
                }
                setRunIds(ids)
                jobs.reload()
                return `Retrying ${failed.length} batch${failed.length === 1 ? '' : 'es'}.`
              })
            }
          />
        )}
        {(jobs.data?.length ?? 0) > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-600">Batch history</summary>
            <ul className="mt-2 space-y-1">
              {jobs.data!.slice(0, 15).map((job) => (
                <li key={job.id} className="flex flex-wrap gap-2 text-slate-600">
                  <span className="font-medium">{JOB_LABEL[job.status] ?? job.status}</span>
                  <span>
                    {job.payload.subject}
                    {job.payload.topic ? ` · ${job.payload.topic}` : ''} · {job.payload.count} asked
                  </span>
                  {job.result && <span>· {job.result.saved} saved</span>}
                  {job.error && job.status === 'FAILED' && (
                    <span className="text-red-700">· {job.error}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <section id="question-bank" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Question bank ({questions.data?.total ?? 0})</h2>
          <label className="text-sm">
            <span className="sr-only">Show</span>
            <select
              className="input-base"
              aria-label="Show questions"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All questions</option>
              <option value="DRAFT">Drafts to review</option>
              <option value="APPROVED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => {
              setEditing(null)
              setManual(true)
              setEditJson(
                JSON.stringify(
                  {
                    exam,
                    subject,
                    topic,
                    questionText: '',
                    questionType: 'MCQ',
                    options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: '' })),
                    correctAnswer: 'A',
                    explanation: '',
                    marks: 1,
                    difficulty: 'MEDIUM',
                  },
                  null,
                  2,
                ),
              )
            }}
          >
            Author a question
          </button>
        </div>
        {(() => {
          const drafts = questions.data?.items.filter((q) => q.status === 'DRAFT') ?? []
          if (!drafts.length) return null
          return (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm">
              <span>
                {drafts.length} draft{drafts.length === 1 ? '' : 's'} on this page. Skim them below,
                fix any that are wrong, then publish the rest at once.
              </span>
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const result = await adminRequest<{ changed: number }>(
                      'exam-content/questions/bulk-state',
                      {
                        method: 'POST',
                        body: JSON.stringify({ ids: drafts.map((q) => q.id), status: 'APPROVED' }),
                      },
                    )
                    return `${result.changed} question${result.changed === 1 ? '' : 's'} published to learners.`
                  })
                }
              >
                Approve all {drafts.length} drafts
              </button>
            </div>
          )
        })()}
        {questions.loading && <p>Loading questions…</p>}
        {questions.data?.items.map((q) => (
          <article key={q.id} className="card space-y-3 p-5">
            <p className="text-xs text-slate-500">
              {q.subject} / {q.topic} · {q.status} · revision {q.revision} ·{' '}
              {q.isAiGenerated ? 'AI-assisted' : 'Teacher-authored'}
            </p>
            <p className="font-medium">
              <MathText>{q.questionText}</MathText>
            </p>
            {q.options?.map((o) => (
              <p key={o.key}>
                {o.key}. <MathText>{o.text}</MathText>
              </p>
            ))}
            <p className="text-sm">
              <strong>Answer:</strong> <MathText>{q.correctAnswer}</MathText>
            </p>
            <p className="text-sm text-slate-600">
              <MathText>{q.explanation}</MathText>
            </p>
            <div className="flex gap-2">
              {q.status === 'DRAFT' && (
                <>
                  <button className="btn-secondary" disabled={busy} onClick={() => edit(q)}>
                    Edit draft
                  </button>
                  <button
                    className="btn-primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await adminRequest(`exam-content/questions/${q.id}/state`, {
                          method: 'POST',
                          body: JSON.stringify({
                            status: 'APPROVED',
                            expectedRevision: q.revision,
                          }),
                        })
                        return 'Reviewed question published.'
                      })
                    }
                  >
                    Approve & publish
                  </button>
                </>
              )}
              {q.status === 'APPROVED' && (
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const draft = await adminRequest<Question>(
                        `exam-content/questions/${q.id}/correction`,
                        {
                          method: 'POST',
                          body: JSON.stringify({
                            status: 'APPROVED',
                            expectedRevision: q.revision,
                          }),
                        },
                      )
                      edit(draft)
                      return 'Correction draft created. Publishing it will archive the previous version.'
                    })
                  }
                >
                  Create correction
                </button>
              )}
              {q.status !== 'ARCHIVED' && (
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await adminRequest(`exam-content/questions/${q.id}/state`, {
                        method: 'POST',
                        body: JSON.stringify({ status: 'ARCHIVED', expectedRevision: q.revision }),
                      })
                      return 'Question archived; existing practice history is preserved.'
                    })
                  }
                >
                  Archive
                </button>
              )}
            </div>
          </article>
        ))}
        <div className="flex items-center gap-3">
          <button
            className="btn-secondary"
            disabled={page === 1 || busy}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            className="btn-secondary"
            disabled={busy || page * 20 >= (questions.data?.total ?? 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </section>
      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">
          Teaching notes (optional — extra context for generation and shareable study material)
        </summary>
        <div className="mt-4 space-y-4">
          <form
            className="card space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => {
                const scope = {
                  exam: notesExamValue,
                  subject: notesSubjectValue,
                  topic: notesTopicValue,
                  sourceNote,
                  ...(notesClass ? { classLevel: notesClass } : {}),
                }
                if (!files.length) {
                  await adminRequest('exam-content/materials', {
                    method: 'POST',
                    body: JSON.stringify({ ...scope, ...(title.trim() ? { title } : {}), body }),
                  })
                  setBody('')
                  setTitle('')
                  return 'Notes saved as a draft. Publish when ready to share with learners.'
                }
                // One request per file, so a bad file is reported without stopping the rest.
                const failed: { name: string; reason: string }[] = []
                setUploadProgress({ done: 0, total: files.length, failed })
                for (const [i, f] of files.entries()) {
                  try {
                    if (f.size > 5 * 1024 * 1024) throw new Error('larger than 5 MB')
                    const data = new FormData()
                    data.set('file', f)
                    for (const [key, value] of Object.entries(scope)) data.set(key, value)
                    const name = f.name
                      .replace(/\.[^.]+$/, '')
                      .replace(/[_-]+/g, ' ')
                      .trim()
                    data.set(
                      'title',
                      (files.length === 1 && title.trim()) || name.slice(0, 150) || 'Notes',
                    )
                    await adminRequest('exam-content/upload', { method: 'POST', body: data })
                  } catch (err) {
                    failed.push({
                      name: f.name,
                      reason: err instanceof Error ? err.message : 'failed',
                    })
                  }
                  setUploadProgress({ done: i + 1, total: files.length, failed: [...failed] })
                }
                const saved = files.length - failed.length
                setFiles([])
                setTitle('')
                if (fileInput.current) fileInput.current.value = ''
                if (!failed.length) setUploadProgress(null)
                return failed.length
                  ? `${saved} of ${files.length} files saved as drafts; ${failed.length} could not be read (listed in the form).`
                  : `${saved} file${saved === 1 ? '' : 's'} saved as draft notes. Publish when ready to share with learners.`
              })
            }}
          >
            <h3 className="font-semibold">Add notes</h3>
            <fieldset disabled={busy} className="space-y-3">
              {/* The notes form has its own exam, subject and topic: the generation card's
                  fields are far above and its topic is optional. */}
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm">
                  Exam
                  <select
                    className="input-base mt-1"
                    value={notesExamValue}
                    onChange={(e) => setNotesExam(e.target.value)}
                  >
                    <option>JAMB</option>
                    <option>WAEC</option>
                  </select>
                </label>
                <div className="text-sm">
                  <label htmlFor="notes-subject">Subject</label>
                  <select
                    id="notes-subject"
                    className="input-base mt-1"
                    value={notesCustom ? OTHER_SUBJECT : notesSubjectValue}
                    onChange={(e) => {
                      const other = e.target.value === OTHER_SUBJECT
                      setNotesCustom(other)
                      setNotesSubject(other ? '' : e.target.value)
                    }}
                  >
                    <option value="">Choose a subject</option>
                    {ADMIN_EXAM_SUBJECTS.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                    {!notesCustom &&
                      notesSubjectValue &&
                      !ADMIN_EXAM_SUBJECTS.includes(notesSubjectValue) && (
                        <option>{notesSubjectValue}</option>
                      )}
                    <option value={OTHER_SUBJECT}>Other subject…</option>
                  </select>
                </div>
                <label className="block text-sm">
                  Topic (optional)
                  <input
                    className="input-base mt-1"
                    maxLength={150}
                    value={notesTopic}
                    onChange={(e) => setNotesTopic(e.target.value)}
                    placeholder="e.g. Separation of powers"
                  />
                </label>
              </div>
              {notesCustom && (
                <label className="block text-sm">
                  Subject name
                  <input
                    className="input-base mt-1"
                    maxLength={100}
                    autoFocus
                    value={notesSubject}
                    onChange={(e) => setNotesSubject(e.target.value)}
                  />
                </label>
              )}
              <label className="block text-sm">
                Class (optional)
                <select
                  className="input-base mt-1"
                  value={notesClass}
                  onChange={(e) => setNotesClass(e.target.value)}
                >
                  <option value="">Any class</option>
                  <option value="SS1">SS1</option>
                  <option value="SS2">SS2</option>
                  <option value="SS3">SS3</option>
                </select>
              </label>
              <label className="block text-sm">
                {files.length > 1
                  ? 'Title (not needed: each file uses its own name)'
                  : 'Title (optional)'}
                <input
                  disabled={files.length > 1}
                  maxLength={150}
                  className="input-base mt-1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Leave blank to name it after the file or subject"
                />
              </label>
              <label className="block text-sm">
                Source and permission to share (optional)
                <input
                  maxLength={1000}
                  className="input-base mt-1"
                  value={sourceNote}
                  onChange={(e) => setSourceNote(e.target.value)}
                  placeholder="e.g. My original teaching notes, approved for Nightklass students"
                />
              </label>
              <label className="block text-sm">
                Upload PDF, DOCX, PPTX or TXT files (up to 5 MB each; choose several at once)
                <input
                  className="mt-2 block w-full"
                  ref={fileInput}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.pptx,.txt"
                  onChange={(e) => {
                    setFiles(Array.from(e.target.files ?? []))
                    setUploadProgress(null)
                  }}
                />
              </label>
              {files.length > 1 && (
                <p className="text-sm text-slate-600">
                  {files.length} files selected. Each becomes its own draft note named after the
                  file.
                </p>
              )}
              {uploadProgress && (
                <div role="status" className="space-y-1 rounded-xl border bg-slate-50 p-3 text-sm">
                  <p>
                    {uploadProgress.done < uploadProgress.total
                      ? `Uploading ${uploadProgress.done + 1} of ${uploadProgress.total}…`
                      : `Finished: ${uploadProgress.total - uploadProgress.failed.length} of ${uploadProgress.total} saved.`}
                  </p>
                  {uploadProgress.failed.map((f) => (
                    <p key={f.name} className="text-red-700">
                      {f.name}: {f.reason}
                    </p>
                  ))}
                </div>
              )}
              <label className="block text-sm">
                Or paste notes
                <textarea
                  className="input-base mt-1 min-h-36"
                  required={!files.length}
                  minLength={20}
                  maxLength={50000}
                  value={body}
                  disabled={files.length > 0}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn-primary" disabled={notesMissing.length > 0}>
                  Save notes
                </button>
                {notesMissing.length > 0 && (
                  <p className="text-sm text-slate-500">Still needed: {notesMissing.join(', ')}</p>
                )}
              </div>
            </fieldset>
          </form>
          <section className="card space-y-3 p-5">
            <h2 className="text-lg font-semibold">Materials ({materials.data?.total ?? 0})</h2>
            {materials.loading && <p>Loading materials…</p>}
            {materials.data?.items.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div>
                  <p className="font-medium">
                    {m.title} · {m.status}
                  </p>
                  <p className="text-sm text-slate-500">
                    {m.subject} / {m.topic}
                    {m.classLevel ? ` · ${m.classLevel}` : ''} · {m.sourceNote}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        setPreview(await adminRequest(`exam-content/materials/${m.id}`))
                        return 'Material preview loaded below.'
                      })
                    }
                  >
                    Preview
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={busy || m.status === 'ARCHIVED'}
                    onClick={() => {
                      setMaterialId(m.id)
                      setTopic(m.topic)
                      setMessage(`Selected ${m.title} for generation.`)
                    }}
                  >
                    Use for generation
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await adminRequest(`exam-content/materials/${m.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({
                            status: m.status === 'APPROVED' ? 'ARCHIVED' : 'APPROVED',
                          }),
                        })
                        return 'Material visibility updated.'
                      })
                    }
                  >
                    {m.status === 'APPROVED' ? 'Archive' : 'Publish'}
                  </button>
                </div>
              </div>
            ))}
          </section>
          {preview && (
            <section className="card space-y-3 p-5">
              <h2 className="font-semibold">{preview.title}</h2>
              <p className="max-h-96 overflow-auto whitespace-pre-wrap text-sm">{preview.body}</p>
              <button className="btn-secondary" onClick={() => setPreview(null)}>
                Close preview
              </button>
            </section>
          )}
        </div>
      </details>
      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">Exam dates and timetables</summary>
        <div className="mt-4">
          <AdminExamCalendars />
        </div>
      </details>
      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">Syllabuses and objectives</summary>
        <div className="mt-4">
          <AdminExamSyllabuses onChange={syllabusData.reload} />
        </div>
      </details>
      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">
          JAMB mock settings and WAEC papers
        </summary>
        <div className="mt-4 space-y-6">
          <AdminMockTemplates />
          <AdminWaecPapers />
        </div>
      </details>
      {(editing || manual) && (
        <form
          className="card space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              const payload = JSON.parse(editJson)
              await adminRequest(
                editing ? `exam-content/questions/${editing.id}` : 'exam-content/questions',
                {
                  method: editing ? 'PATCH' : 'POST',
                  body: JSON.stringify({
                    ...payload,
                    ...(!editing ? { objectiveIds } : {}),
                    ...(editing ? { expectedRevision: editing.revision } : {}),
                  }),
                },
              )
              setEditing(null)
              setManual(false)
              return 'Draft saved.'
            })
          }}
        >
          <h2 className="font-semibold">{editing ? 'Edit question draft' : 'Author a question'}</h2>
          {draft && (
            <fieldset disabled={busy} className="space-y-4">
              {matchingObjectives.map((o) => (
                <label key={o.id} className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={(draft.objectiveIds ?? []).includes(o.id)}
                    onChange={() =>
                      updateDraft(
                        'objectiveIds',
                        (draft.objectiveIds ?? []).includes(o.id)
                          ? draft.objectiveIds.filter((id: string) => id !== o.id)
                          : [...(draft.objectiveIds ?? []), o.id],
                      )
                    }
                  />
                  {o.code} · {o.title}
                </label>
              ))}
              <label className="block text-sm">
                Question
                <textarea
                  required
                  className="input-base mt-1 min-h-28"
                  minLength={5}
                  maxLength={10000}
                  value={draft.questionText}
                  onChange={(e) => updateDraft('questionText', e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Question type
                <select
                  className="input-base mt-1"
                  value={draft.questionType}
                  onChange={(e) => updateDraft('questionType', e.target.value)}
                >
                  {(draft.exam === 'JAMB'
                    ? ['MCQ']
                    : ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'THEORY']
                  ).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              {draft.questionType === 'MCQ' &&
                ['A', 'B', 'C', 'D'].map((key) => (
                  <label key={key} className="block text-sm">
                    Option {key}
                    <input
                      required
                      className="input-base mt-1"
                      maxLength={2000}
                      value={
                        (draft.options ?? []).find((o: { key: string }) => o.key === key)?.text ??
                        ''
                      }
                      onChange={(e) =>
                        updateDraft(
                          'options',
                          ['A', 'B', 'C', 'D'].map((k) => ({
                            key: k,
                            text:
                              k === key
                                ? e.target.value
                                : ((draft.options ?? []).find((o: { key: string }) => o.key === k)
                                    ?.text ?? ''),
                          })),
                        )
                      }
                    />
                  </label>
                ))}
              <label className="block text-sm">
                {draft.questionType === 'MCQ' ? 'Correct option key (A–D)' : 'Model answer'}
                <textarea
                  required
                  className="input-base mt-1"
                  maxLength={10000}
                  value={draft.correctAnswer}
                  onChange={(e) => updateDraft('correctAnswer', e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Explanation / marking points
                <textarea
                  required
                  minLength={5}
                  maxLength={10000}
                  className="input-base mt-1 min-h-28"
                  value={draft.explanation}
                  onChange={(e) => updateDraft('explanation', e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Marks
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="input-base mt-1"
                  value={draft.marks}
                  onChange={(e) => updateDraft('marks', Number(e.target.value))}
                />
              </label>
            </fieldset>
          )}
          <button className="btn-primary" disabled={busy}>
            Save draft
          </button>
          <button
            type="button"
            className="btn-secondary ml-3"
            onClick={() => {
              setEditing(null)
              setManual(false)
            }}
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  )
}
