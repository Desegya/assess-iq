'use client'
import { useRef, useState } from 'react'
import { adminRequest, useAdminData } from './admin-api'
interface Entry {
  subject: string
  paperCode: string
  title: string
  date: string
  startTime?: string
  endTime?: string
  notes?: string
}
interface Calendar {
  id?: string
  exam: string
  year: number
  series: string
  version: number
  title: string
  startDate: string
  endDate?: string | null
  sourceNote: string
  entries: Entry[]
  revision?: number
  status?: string
  fileName?: string | null
  extractedText?: string | null
}
const empty = (): Calendar => ({
  exam: 'JAMB',
  year: new Date().getFullYear() + 1,
  series: 'GENERAL',
  version: 1,
  title: '',
  startDate: '',
  endDate: '',
  sourceNote: '',
  entries: [],
})
function clean(c: Calendar): Calendar {
  return {
    id: c.id,
    exam: c.exam,
    year: c.year,
    series: c.series,
    version: c.version,
    title: c.title,
    startDate: c.startDate,
    endDate: c.endDate ?? '',
    sourceNote: c.sourceNote,
    entries: c.entries,
    revision: c.revision,
    status: c.status,
    fileName: c.fileName,
    extractedText: c.extractedText,
  }
}
export function AdminExamCalendars() {
  const publishOnSave = useRef(false)
  const data = useAdminData<Calendar[]>('exam-content/calendars')
  const [form, setForm] = useState<Calendar | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [sourceLink, setSourceLink] = useState('')
  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await fn()
      data.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update calendar')
    } finally {
      setBusy(false)
    }
  }
  function field(key: string, value: unknown) {
    setForm((old) => (old ? { ...old, [key]: value } : old))
  }
  function row(index: number, key: string, value: string) {
    setForm((old) =>
      old
        ? { ...old, entries: old.entries.map((e, i) => (i === index ? { ...e, [key]: value } : e)) }
        : old,
    )
  }
  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-lg font-semibold">Exam dates & WAEC timetables</h2>
      <p className="text-sm text-slate-600">
        Publish the start/end window for JAMB or WAEC. For WAEC, attach the original PDF or import a
        CSV, review the subject/paper rows and publish the draft. All times are Nigeria time
        (Africa/Lagos). JAMB dates are the general exam window, not personal examination-slip
        appointments.
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
          setForm(empty())
          setFile(null)
          setSourceLink('')
        }}
      >
        New exam calendar
      </button>
      {data.data?.map((c) => (
        <article className="space-y-2 rounded-xl border p-4" key={c.id}>
          <h3 className="font-semibold">
            {c.title} · {c.exam} {c.year} · {c.series.replaceAll('_', ' ')} · v{c.version}
          </h3>
          <p className="text-sm">
            {c.startDate}
            {c.endDate ? ` to ${c.endDate}` : ''} · {c.status} · {c.entries.length} paper rows
            {c.fileName ? ` · ${c.fileName}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                const copy = c.status !== 'DRAFT'
                setForm({
                  ...clean(c),
                  ...(copy
                    ? {
                        id: undefined,
                        revision: undefined,
                        status: 'DRAFT',
                        version: c.version + 1,
                        fileName: null,
                        extractedText: null,
                      }
                    : {}),
                })
                setFile(null)
                setSourceLink('')
              }}
            >
              {c.status === 'DRAFT' ? 'Edit calendar draft' : 'Copy into new calendar version'}
            </button>
            {c.status === 'DRAFT' && (
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await adminRequest(`exam-content/calendars/${c.id}/state`, {
                      method: 'POST',
                      body: JSON.stringify({ status: 'APPROVED', expectedRevision: c.revision }),
                    })
                    setMessage('Reviewed exam dates and timetable published.')
                  })
                }
              >
                Publish calendar
              </button>
            )}
            {c.status === 'APPROVED' && (
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await adminRequest(`exam-content/calendars/${c.id}/state`, {
                      method: 'POST',
                      body: JSON.stringify({ status: 'ARCHIVED', expectedRevision: c.revision }),
                    })
                    setMessage('Calendar archived. Existing personal study plans are preserved.')
                  })
                }
              >
                Archive calendar
              </button>
            )}
            {c.fileName && (
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const result = await adminRequest<{ url: string }>(
                      `exam-content/calendars/${c.id}/file`,
                    )
                    setSourceLink(result.url)
                    setMessage('Original timetable is ready to open below.')
                  })
                }
              >
                Get original timetable
              </button>
            )}
          </div>
        </article>
      ))}
      {sourceLink && (
        <a href={sourceLink} className="text-violet-700 underline" target="_blank" rel="noreferrer">
          Open uploaded timetable
        </a>
      )}
      {form && (
        <form
          className="space-y-4 rounded-xl border p-4"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              const {
                id,
                exam,
                year,
                series,
                version,
                title,
                startDate,
                endDate,
                sourceNote,
                entries,
                revision,
              } = form
              const saved = await adminRequest<Calendar>('exam-content/calendars', {
                method: 'POST',
                body: JSON.stringify({
                  id,
                  exam,
                  year,
                  series,
                  // New calendars get the next version and a generated title on the server.
                  ...(id ? { version } : {}),
                  ...(title.trim() ? { title } : {}),
                  startDate,
                  endDate: endDate || undefined,
                  ...(sourceNote.trim() ? { sourceNote } : {}),
                  publish: publishOnSave.current,
                  entries: entries.map((e) => ({
                    ...e,
                    startTime: e.startTime || undefined,
                    endTime: e.endTime || undefined,
                  })),
                  expectedRevision: revision ?? 0,
                }),
              })
              setForm(clean(saved))
              setMessage(
                publishOnSave.current
                  ? 'Dates published. Learners with this exam goal now see them.'
                  : 'Calendar saved as a draft. Review dates and paper rows before publishing.',
              )
              publishOnSave.current = false
            })
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                Examination
                <select
                  className="input-base mt-1"
                  value={form.exam}
                  onChange={(e) =>
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            exam: e.target.value,
                            series: e.target.value === 'JAMB' ? 'GENERAL' : 'SCHOOL',
                            entries: [],
                          }
                        : f,
                    )
                  }
                >
                  <option>JAMB</option>
                  <option>WAEC</option>
                </select>
              </label>
              <label className="text-sm">
                Exam year
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
                Exam series
                <select
                  className="input-base mt-1"
                  value={form.series}
                  onChange={(e) => field('series', e.target.value)}
                >
                  {form.exam === 'JAMB' ? (
                    <option value="GENERAL">General UTME window</option>
                  ) : (
                    <>
                      <option value="SCHOOL">School candidates</option>
                      <option value="PRIVATE_FIRST">Private, first series</option>
                      <option value="PRIVATE_SECOND">Private, second series</option>
                    </>
                  )}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                Exam starts
                <input
                  type="date"
                  className="input-base mt-1"
                  required
                  value={form.startDate}
                  onChange={(e) => field('startDate', e.target.value)}
                />
              </label>
              <label className="text-sm">
                Exam ends (optional)
                <input
                  type="date"
                  className="input-base mt-1"
                  value={form.endDate ?? ''}
                  onChange={(e) => field('endDate', e.target.value)}
                />
              </label>
            </div>
            <details className="rounded-xl border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                More details (optional)
              </summary>
              <div className="mt-3 space-y-3">
                <label className="block text-sm">
                  Calendar title
                  <input
                    className="input-base mt-1"
                    maxLength={150}
                    placeholder="Generated automatically if left blank"
                    value={form.title}
                    onChange={(e) => field('title', e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Calendar version
                  <input
                    type="number"
                    className="input-base mt-1"
                    min={1}
                    max={1000}
                    value={form.version}
                    onChange={(e) => field('version', Number(e.target.value))}
                  />
                </label>
                <label className="block text-sm">
                  Source and date verification note
                  <input
                    className="input-base mt-1"
                    maxLength={2000}
                    placeholder="e.g. Checked against the official WAEC timetable published on …"
                    value={form.sourceNote}
                    onChange={(e) => field('sourceNote', e.target.value)}
                  />
                </label>
              </div>
            </details>
            {form.exam === 'WAEC' && (
              <>
                <div className="space-y-3 rounded-xl border p-4">
                  <h3 className="font-semibold">Upload original WAEC timetable</h3>
                  <p className="text-sm text-slate-500">
                    Save the draft first. PDF uploads automatically extract and save paper dates as
                    draft rows. Review them against the original before publishing. Scanned or
                    unreadable PDFs may need manual entry or CSV. CSV imports rows automatically,
                    using headers subject,paperCode,title,date,startTime,endTime,notes and dates as
                    YYYY-MM-DD. Unknown times should be blank.
                  </p>
                  <input
                    type="file"
                    aria-label="WAEC timetable PDF or CSV"
                    accept=".pdf,.csv"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={!form.id || !file}
                    onClick={() =>
                      void run(async () => {
                        if (!file || !form.id) return
                        const body = new FormData()
                        body.set('file', file)
                        body.set('expectedRevision', String(form.revision))
                        const saved = await adminRequest<
                          Calendar & { importedRows: number; extractionWarning?: string }
                        >(`exam-content/calendars/${form.id}/upload`, { method: 'POST', body })
                        setForm(clean(saved))
                        setMessage(
                          saved.extractionWarning
                            ? `Original saved. ${saved.extractionWarning}`
                            : saved.importedRows
                              ? `${saved.importedRows} paper rows imported. Review before publishing.`
                              : 'Original PDF uploaded. Review it and enter the paper rows before publishing.',
                        )
                      })
                    }
                  >
                    Upload timetable
                  </button>
                  {form.fileName && <p className="text-sm">Uploaded: {form.fileName}</p>}
                  {form.extractedText && (
                    <details>
                      <summary className="cursor-pointer text-sm">
                        Preview extracted source text
                      </summary>
                      <p className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-sm">
                        {form.extractedText}
                      </p>
                    </details>
                  )}
                </div>
                {form.entries.map((entry, i) => (
                  <fieldset className="space-y-3 rounded-xl border p-4" key={i}>
                    <legend className="text-sm font-medium">Paper row {i + 1}</legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {(['subject', 'paperCode', 'title'] as const).map((key) => (
                        <label className="text-sm" key={key}>
                          {
                            {
                              subject: 'Paper subject',
                              paperCode: 'Paper code',
                              title: 'Paper title',
                            }[key]
                          }
                          <input
                            required
                            className="input-base mt-1"
                            maxLength={key === 'subject' ? 100 : key === 'paperCode' ? 40 : 150}
                            value={entry[key]}
                            onChange={(e) => row(i, key, e.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="text-sm">
                        Paper date
                        <input
                          type="date"
                          required
                          className="input-base mt-1"
                          value={entry.date}
                          onChange={(e) => row(i, 'date', e.target.value)}
                        />
                      </label>
                      <label className="text-sm">
                        Start time, Nigeria (optional)
                        <input
                          type="time"
                          className="input-base mt-1"
                          value={entry.startTime ?? ''}
                          onChange={(e) => row(i, 'startTime', e.target.value)}
                        />
                      </label>
                      <label className="text-sm">
                        End time, Nigeria (optional)
                        <input
                          type="time"
                          className="input-base mt-1"
                          value={entry.endTime ?? ''}
                          onChange={(e) => row(i, 'endTime', e.target.value)}
                        />
                      </label>
                    </div>
                    <label className="block text-sm">
                      Paper notes (optional)
                      <input
                        className="input-base mt-1"
                        maxLength={500}
                        value={entry.notes ?? ''}
                        onChange={(e) => row(i, 'notes', e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        field(
                          'entries',
                          form.entries.filter((_, n) => n !== i),
                        )
                      }
                    >
                      Remove paper row
                    </button>
                  </fieldset>
                ))}
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={form.entries.length >= 500}
                  onClick={() =>
                    field('entries', [
                      ...form.entries,
                      { subject: '', paperCode: '', title: '', date: form.startDate },
                    ])
                  }
                >
                  Add paper row
                </button>
              </>
            )}
            <div className="flex gap-3">
              <button
                className="btn-primary"
                onClick={() => {
                  publishOnSave.current = true
                }}
              >
                Save &amp; publish dates
              </button>
              <button className="btn-secondary">Save as draft</button>
              <button type="button" className="btn-secondary" onClick={() => setForm(null)}>
                Close calendar editor
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  )
}
