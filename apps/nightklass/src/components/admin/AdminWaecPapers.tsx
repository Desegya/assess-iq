'use client'
import { useState } from 'react'
import { adminRequest, useAdminData } from './admin-api'
interface Section {
  id: string
  title: string
  questionType: string
  count: number
  choose: number
  marks: number
  topic?: string
}
interface Paper {
  id?: string
  year: number
  series: string
  subject: string
  paperCode: string
  title: string
  durationMinutes: number
  instructions: string
  sourceNote: string
  status: string
  sections: Section[]
  revision?: number
}
const empty = (): Paper => ({
  year: new Date().getFullYear() + 1,
  series: 'SCHOOL',
  subject: '',
  paperCode: '',
  title: '',
  durationMinutes: 60,
  instructions: '',
  sourceNote: '',
  status: 'DRAFT',
  sections: [
    {
      id: crypto.randomUUID(),
      title: 'Section A',
      questionType: 'MCQ',
      count: 10,
      choose: 10,
      marks: 1,
    },
  ],
})
export function AdminWaecPapers() {
  const papers = useAdminData<Paper[]>('exam-content/waec-papers')
  const [form, setForm] = useState<Paper | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  function field(name: string, value: unknown) {
    setForm((old) => (old ? { ...old, [name]: value } : old))
  }
  function section(index: number, name: string, value: unknown) {
    setForm((old) =>
      old
        ? {
            ...old,
            sections: old.sections.map((s, i) => (i === index ? { ...s, [name]: value } : s)),
          }
        : old,
    )
  }
  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-lg font-semibold">WAEC paper specifications</h2>
      <p className="text-sm text-slate-600">
        Configure each subject, year, series and paper separately using its verified instructions.
        Sections select reviewed questions matching type, marks and optional exact topic. For
        multipart questions, put labelled subparts in the question and model answer, with the
        combined marks and marking points. These templates cover text-based practice; do not publish
        practical or oral formats that require unsupported interactions.
      </p>
      {(error || papers.error) && (
        <p role="alert" className="text-red-700">
          {error || papers.error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={busy} onClick={() => setForm(empty())}>
          New paper
        </button>
        {papers.data?.map((p) => (
          <button
            className="btn-secondary"
            key={p.id}
            disabled={busy}
            onClick={() =>
              setForm({
                id: p.id,
                year: p.year,
                series: p.series,
                subject: p.subject,
                paperCode: p.paperCode,
                title: p.title,
                durationMinutes: p.durationMinutes,
                instructions: p.instructions,
                sourceNote: p.sourceNote,
                status: p.status,
                sections: p.sections,
                revision: p.revision,
              })
            }
          >
            {p.subject} · {p.year} · {p.paperCode} · {p.status}
          </button>
        ))}
      </div>
      {form && (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError('')
            setMessage('')
            try {
              const { revision, ...data } = form
              const saved = await adminRequest<Paper>('exam-content/waec-papers', {
                method: 'POST',
                body: JSON.stringify({ ...data, expectedRevision: revision ?? 0 }),
              })
              setForm({
                id: saved.id,
                year: saved.year,
                series: saved.series,
                subject: saved.subject,
                paperCode: saved.paperCode,
                title: saved.title,
                durationMinutes: saved.durationMinutes,
                instructions: saved.instructions,
                sourceNote: saved.sourceNote,
                status: saved.status,
                sections: saved.sections,
                revision: saved.revision,
              })
              papers.reload()
              setMessage('WAEC paper saved. Started attempts retain their frozen specification.')
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not save paper')
            } finally {
              setBusy(false)
            }
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                Subject
                <input
                  className="input-base mt-1"
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.subject}
                  onChange={(e) => field('subject', e.target.value)}
                />
              </label>
              <label className="text-sm">
                Year
                <input
                  type="number"
                  className="input-base mt-1"
                  min={2026}
                  max={2100}
                  value={form.year}
                  onChange={(e) => field('year', Number(e.target.value))}
                />
              </label>
              <label className="text-sm">
                Series
                <select
                  className="input-base mt-1"
                  value={form.series}
                  onChange={(e) => field('series', e.target.value)}
                >
                  <option value="SCHOOL">School candidates</option>
                  <option value="PRIVATE_FIRST">Private candidates, first series</option>
                  <option value="PRIVATE_SECOND">Private candidates, second series</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                Paper code
                <input
                  className="input-base mt-1"
                  required
                  maxLength={40}
                  value={form.paperCode}
                  onChange={(e) => field('paperCode', e.target.value)}
                />
              </label>
              <label className="text-sm">
                Title
                <input
                  className="input-base mt-1"
                  required
                  minLength={5}
                  maxLength={150}
                  value={form.title}
                  onChange={(e) => field('title', e.target.value)}
                />
              </label>
              <label className="text-sm">
                Minutes
                <input
                  className="input-base mt-1"
                  type="number"
                  min={1}
                  max={300}
                  value={form.durationMinutes}
                  onChange={(e) => field('durationMinutes', Number(e.target.value))}
                />
              </label>
            </div>
            <label className="block text-sm">
              Paper instructions
              <textarea
                className="input-base mt-1"
                required
                minLength={20}
                maxLength={10000}
                value={form.instructions}
                onChange={(e) => field('instructions', e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Source and rule verification note
              <input
                className="input-base mt-1"
                required
                minLength={10}
                maxLength={1000}
                value={form.sourceNote}
                onChange={(e) => field('sourceNote', e.target.value)}
              />
            </label>
            {form.sections.map((s, i) => (
              <div key={s.id} className="space-y-3 rounded-xl border p-4">
                <label className="block text-sm">
                  Section title
                  <input
                    className="input-base mt-1"
                    required
                    minLength={2}
                    value={s.title}
                    onChange={(e) => section(i, 'title', e.target.value)}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="text-sm">
                    Type
                    <select
                      className="input-base mt-1"
                      value={s.questionType}
                      onChange={(e) => section(i, 'questionType', e.target.value)}
                    >
                      <option>MCQ</option>
                      <option>SHORT_ANSWER</option>
                      <option>THEORY</option>
                    </select>
                  </label>
                  {(['count', 'choose', 'marks'] as const).map((key) => (
                    <label className="text-sm" key={key}>
                      {
                        {
                          count: 'Questions shown',
                          choose: 'Questions to answer',
                          marks: 'Marks per question',
                        }[key]
                      }
                      <input
                        className="input-base mt-1"
                        type="number"
                        min={1}
                        max={100}
                        value={s[key]}
                        onChange={(e) => section(i, key, Number(e.target.value))}
                      />
                    </label>
                  ))}
                </div>
                <label className="block text-sm">
                  Exact bank topic (optional)
                  <input
                    className="input-base mt-1"
                    maxLength={150}
                    value={s.topic ?? ''}
                    onChange={(e) => section(i, 'topic', e.target.value)}
                  />
                </label>
                <p className="text-xs text-slate-500">
                  {s.choose === s.count
                    ? 'All questions compulsory'
                    : `Answer ${s.choose} of ${s.count}`}{' '}
                  · {s.choose * s.marks} marks
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={form.sections.length === 1}
                  onClick={() =>
                    field(
                      'sections',
                      form.sections.filter((_, n) => n !== i),
                    )
                  }
                >
                  Remove section
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              disabled={form.sections.length >= 10}
              onClick={() =>
                field('sections', [
                  ...form.sections,
                  {
                    id: crypto.randomUUID(),
                    title: `Section ${form.sections.length + 1}`,
                    questionType: 'THEORY',
                    count: 3,
                    choose: 2,
                    marks: 10,
                  },
                ])
              }
            >
              Add section
            </button>
            <label className="block text-sm">
              Visibility
              <select
                className="input-base mt-1"
                value={form.status}
                onChange={(e) => field('status', e.target.value)}
              >
                <option value="DRAFT">Draft</option>
                <option value="APPROVED">Reviewed and published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
            <button className="btn-primary">Save paper</button>
          </fieldset>
        </form>
      )}
    </section>
  )
}
