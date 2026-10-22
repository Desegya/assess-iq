'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
interface CalendarData {
  calendar: {
    title: string
    startDate: string
    endDate: string | null
    daysUntilStart: number
    version: number
    fileUrl: string | null
    fileName: string | null
    sourceNote: string
  } | null
  papers: {
    subject: string
    paperCode: string
    title: string
    date: string
    startTime?: string
    endTime?: string
    notes?: string
  }[]
  deadlines: { courseId: string; subject: string; date: string | null; source: string }[]
  note: string
}
export function ExamCalendarCard({ goalId }: { goalId: string }) {
  const api = useApi(),
    [data, setData] = useState<CalendarData | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [message, setMessage] = useState('')
  useEffect(() => {
    let current = true
    api
      .get<CalendarData>(`/exam-preparation/goals/${goalId}/calendar`)
      .then((v) => {
        if (current) setData(v)
      })
      .catch((err) => {
        if (current) setError(err instanceof Error ? err.message : 'Could not load exam dates')
      })
    return () => {
      current = false
    }
  }, [api, goalId])
  async function plan(courseId: string) {
    setBusy(courseId)
    setError('')
    setMessage('')
    try {
      await api.post('/study/plans/generate', { goalId, courseId })
      setMessage(
        'Study plan created using the published deadline. Open the subject to view your plan.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create study plan')
    } finally {
      setBusy('')
    }
  }
  return (
    <section
      className="mt-4 space-y-3 rounded-xl border border-violet-100 bg-violet-50/30 p-4"
      aria-label="Published exam dates"
    >
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-green-800">
          {message}
        </p>
      )}
      {data?.calendar ? (
        <>
          <h3 className="font-semibold">{data.calendar.title}</h3>
          <p className="text-sm">
            Exam window: {data.calendar.startDate}
            {data.calendar.endDate ? ` to ${data.calendar.endDate}` : ''} ·{' '}
            {data.calendar.daysUntilStart >= 0
              ? `Starts in ${data.calendar.daysUntilStart} days`
              : `Started ${-data.calendar.daysUntilStart} days ago`}
          </p>
          <p className="text-xs text-slate-600">{data.note}</p>
          <p className="text-xs text-slate-500">
            Source: {data.calendar.sourceNote} · version {data.calendar.version}
          </p>
          {data.calendar.fileUrl && (
            <a
              className="inline-flex min-h-11 items-center text-sm font-medium text-violet-700 underline"
              href={data.calendar.fileUrl}
              target="_blank"
              rel="noreferrer"
            >
              View original timetable
            </a>
          )}
          {data.papers.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold">
                Your subject paper dates ({data.papers.length})
              </summary>
              <div className="mt-3 space-y-3">
                {data.papers.map((p, i) => (
                  <article className="rounded-lg border bg-white p-3 text-sm" key={i}>
                    <p className="font-medium">
                      {p.subject} · {p.paperCode} · {p.title}
                    </p>
                    <p>
                      {p.date} ·{' '}
                      {p.startTime
                        ? `${p.startTime}${p.endTime ? `–${p.endTime}` : ''} Nigeria time`
                        : 'Time to be confirmed'}
                    </p>
                    {p.notes && <p className="mt-1 text-slate-600">{p.notes}</p>}
                  </article>
                ))}
              </div>
            </details>
          )}
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Plan study around published dates
            </summary>
            <p className="mt-2 text-xs text-slate-500">
              Add topics and study availability in your subject first. Choosing a published deadline
              creates a new plan; your completed sessions are preserved. Date changes do not
              silently replace your personal plan.
            </p>
            <div className="mt-3 space-y-2">
              {data.deadlines.map((d) => (
                <div className="flex flex-wrap items-center gap-2 text-sm" key={d.courseId}>
                  <span>
                    {d.subject}: {d.date ?? 'No future published date'}
                    {d.date && d.source === 'EXAM_WINDOW' ? ' (exam-window start)' : ''}
                  </span>
                  {d.date && (
                    <button
                      className="btn-secondary"
                      disabled={!!busy}
                      onClick={() => plan(d.courseId)}
                    >
                      {busy === d.courseId ? 'Planning…' : 'Use published deadline'}
                    </button>
                  )}
                  <Link className="text-violet-700 underline" href={`/courses/${d.courseId}`}>
                    Subject & availability
                  </Link>
                </div>
              ))}
            </div>
          </details>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          {data?.note ??
            (!error ? 'Loading published exam dates…' : 'Exam dates could not be loaded.')}
        </p>
      )}
    </section>
  )
}
