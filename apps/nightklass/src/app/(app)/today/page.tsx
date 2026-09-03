'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
import { getSubjectColor } from '@/lib/subject-color'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

interface Session {
  id: string
  startTime: string
  endTime: string
  estimatedMinutes: number
  status: string
  topic: { id: string; name: string } | null
  course: { id: string; title: string }
}

const CONFIDENCE_LABELS = [
  '1 — I do not understand it',
  '2 — I understand a little',
  '3 — I understand most of it',
  '4 — I understand it well',
  '5 — I can explain it to someone else',
]

export default function TodayPage() {
  const api = useApi()
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confidence, setConfidence] = useState<Record<string, number>>({})

  function load() {
    api
      .get<Session[]>('/study/sessions/today')
      .then(setSessions)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load today’s sessions'))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleComplete(sessionId: string) {
    await api
      .post(`/study/sessions/${sessionId}/complete`, { confidenceRating: confidence[sessionId] ?? undefined })
      .catch(() => undefined)
    load()
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-slate-900 mb-1">Today</h1>
      <p className="text-slate-500 text-sm mb-6">Your scheduled study sessions for today.</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
      {sessions === null && !error && (
        <div className="space-y-4">
          <div className="card p-6 space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      )}

      {sessions?.length === 0 && (
        <EmptyState
          illustration="empty"
          title="Nothing scheduled today"
          subtitle="Generate a study plan from one of your courses to see tasks here."
        />
      )}

      <div className="space-y-4">
        {sessions?.map(s => (
          <div key={s.id} className="card card-accent p-6" style={{ ['--accent-color' as string]: getSubjectColor(s.course.id).hex }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-semibold ${getSubjectColor(s.course.id).text}`}>{s.course.title}</p>
                <h2 className="font-heading font-bold text-slate-900 mt-0.5">{s.topic?.name ?? 'Revision / buffer'}</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {s.startTime}–{s.endTime} · {s.estimatedMinutes} min
                </p>
              </div>
              <span
                className={`badge flex-shrink-0 ${
                  s.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {s.status.replace('_', ' ').toLowerCase()}
              </span>
            </div>

            {s.status === 'NOT_STARTED' && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                <select
                  value={confidence[s.id] ?? ''}
                  onChange={e => setConfidence(c => ({ ...c, [s.id]: Number(e.target.value) }))}
                  className="input-base py-2 flex-1 min-w-[220px]"
                >
                  <option value="">How well do you understand it?</option>
                  {CONFIDENCE_LABELS.map((label, i) => (
                    <option key={i} value={i + 1}>
                      {label}
                    </option>
                  ))}
                </select>
                <button onClick={() => handleComplete(s.id)} className="btn-primary">
                  Mark complete
                </button>
                {s.topic && (
                  <Link href={`/topics/${s.topic.id}/quiz`} className="btn-secondary">
                    Take a self-quiz
                  </Link>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
