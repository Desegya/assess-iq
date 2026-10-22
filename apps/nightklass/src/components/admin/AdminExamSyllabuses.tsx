'use client'
import { useState } from 'react'
import { adminRequest, useAdminData } from './admin-api'
export interface Syllabus {
  id: string
  exam: string
  year: number
  subject: string
  subjectKey: string
  version: number
  title: string
  provenance: string
  sourceUrl: string | null
  sourceNote: string
  status: string
  revision: number
  objectives: { id: string; code: string; title: string; description: string }[]
}
const initial = () => ({
  exam: 'JAMB',
  year: new Date().getFullYear() + 1,
  subject: '',
  version: 1,
  title: '',
  provenance: 'CURATED',
  sourceUrl: '',
  sourceNote: '',
})
export function AdminExamSyllabuses({ onChange }: { onChange?: () => void }) {
  const data = useAdminData<Syllabus[]>('exam-content/syllabuses')
  const [form, setForm] = useState(initial)
  const [editing, setEditing] = useState<{ id: string; revision: number } | null>(null)
  const [rows, setRows] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await fn()
      data.reload()
      onChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save syllabus')
    } finally {
      setBusy(false)
    }
  }
  function load(s: Syllabus, copy = false) {
    setVisible(true)
    setEditing(copy ? null : { id: s.id, revision: s.revision })
    setForm({
      exam: s.exam,
      year: s.year,
      subject: s.subject,
      version: s.version + (copy ? 1 : 0),
      title: s.title,
      provenance: s.provenance,
      sourceUrl: s.sourceUrl ?? '',
      sourceNote: s.sourceNote,
    })
    setRows(
      s.objectives
        .map((o) => [o.code, o.title, o.description.replaceAll('\n', ' ')].join(' | '))
        .join('\n'),
    )
  }
  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-lg font-semibold">Syllabuses and learning objectives</h2>
      <p className="text-sm text-slate-600">
        Record the applicable exam year and source. Mark a syllabus official only after checking its
        source; teacher-authored structures should be curated. Publishing a new version archives the
        previous current version while preserving its history.
      </p>
      {(error || data.error) && (
        <p role="alert" className="text-red-700">
          {error || data.error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <button
        className="btn-secondary"
        disabled={busy}
        onClick={() => {
          setEditing(null)
          setForm(initial())
          setRows('')
          setVisible(true)
        }}
      >
        New syllabus
      </button>
      <div className="space-y-3">
        {data.data?.map((s) => (
          <article className="rounded-xl border p-4" key={s.id}>
            <p className="font-medium">
              {s.exam} · {s.subject} · {s.year} · v{s.version} · {s.status}
            </p>
            <p className="mt-1 text-sm">
              {s.objectives.length} objectives ·{' '}
              {s.provenance === 'OFFICIAL'
                ? 'Official source verified by publisher'
                : 'Teacher-curated'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() => load(s, s.status !== 'DRAFT')}
              >
                {s.status === 'DRAFT' ? 'Edit draft' : 'Copy into new version'}
              </button>
              {s.status === 'DRAFT' && (
                <button
                  className="btn-primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await adminRequest(`exam-content/syllabuses/${s.id}/state`, {
                        method: 'POST',
                        body: JSON.stringify({ status: 'APPROVED', expectedRevision: s.revision }),
                      })
                      setMessage('Reviewed syllabus published.')
                    })
                  }
                >
                  Publish syllabus
                </button>
              )}
              {s.status === 'APPROVED' && (
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await adminRequest(`exam-content/syllabuses/${s.id}/state`, {
                        method: 'POST',
                        body: JSON.stringify({ status: 'ARCHIVED', expectedRevision: s.revision }),
                      })
                      setMessage('Syllabus archived. Previous learning is preserved.')
                    })
                  }
                >
                  Archive
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {visible && (
        <form
          className="space-y-4 rounded-xl border p-4"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              const objectives = rows
                .split('\n')
                .filter((line) => line.trim())
                .map((line) => {
                  const [code, title, ...description] = line.split('|').map((s) => s.trim())
                  return { code, title, description: description.join(' | ') }
                })
              const saved = await adminRequest<Syllabus>('exam-content/syllabuses', {
                method: 'POST',
                body: JSON.stringify({
                  ...form,
                  ...(form.sourceUrl ? {} : { sourceUrl: undefined }),
                  ...(editing ? { id: editing.id } : {}),
                  expectedRevision: editing?.revision ?? 0,
                  objectives,
                }),
              })
              setEditing({ id: saved.id, revision: saved.revision })
              setMessage('Syllabus saved as a draft. Review before publishing.')
            })
          }}
        >
          <fieldset disabled={busy} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                Exam
                <select
                  className="input-base mt-1"
                  value={form.exam}
                  onChange={(e) => setForm((f) => ({ ...f, exam: e.target.value }))}
                >
                  <option>JAMB</option>
                  <option>WAEC</option>
                </select>
              </label>
              <label className="text-sm">
                Year
                <input
                  type="number"
                  min={2026}
                  max={2100}
                  className="input-base mt-1"
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                />
              </label>
              <label className="text-sm">
                Subject
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  className="input-base mt-1"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </label>
            </div>
            <label className="block text-sm">
              Title
              <input
                required
                minLength={5}
                maxLength={150}
                className="input-base mt-1"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Version
                <input
                  type="number"
                  min={1}
                  max={1000}
                  className="input-base mt-1"
                  value={form.version}
                  onChange={(e) => setForm((f) => ({ ...f, version: Number(e.target.value) }))}
                />
              </label>
              <label className="text-sm">
                Source classification
                <select
                  className="input-base mt-1"
                  value={form.provenance}
                  onChange={(e) => setForm((f) => ({ ...f, provenance: e.target.value }))}
                >
                  <option value="CURATED">Teacher-curated</option>
                  <option value="OFFICIAL">Official, verified source</option>
                </select>
              </label>
            </div>
            <label className="block text-sm">
              Source URL {form.provenance === 'OFFICIAL' ? '(required)' : '(optional)'}
              <input
                type="url"
                required={form.provenance === 'OFFICIAL'}
                maxLength={2000}
                className="input-base mt-1"
                value={form.sourceUrl}
                onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              Source, applicability and verification note
              <input
                required
                minLength={10}
                maxLength={2000}
                className="input-base mt-1"
                value={form.sourceNote}
                onChange={(e) => setForm((f) => ({ ...f, sourceNote: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              Objectives: one per line as code | topic title | what the student should learn
              <textarea
                required
                className="input-base mt-1 min-h-52"
                value={rows}
                onChange={(e) => setRows(e.target.value)}
                placeholder={
                  'GOV-01 | Democracy | Explain democratic government and accountability.\nGOV-02 | Citizenship | Describe the rights and responsibilities of citizens.'
                }
              />
            </label>
            <button className="btn-primary">Save syllabus draft</button>
            <button type="button" className="btn-secondary ml-3" onClick={() => setVisible(false)}>
              Close editor
            </button>
          </fieldset>
        </form>
      )}
    </section>
  )
}
