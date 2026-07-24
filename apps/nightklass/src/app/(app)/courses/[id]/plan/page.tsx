'use client'

import { useEffect, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'

interface Session {
  id: string
  scheduledDate: string
  startTime: string
  endTime: string
  estimatedMinutes: number
  status: string
  topic: { id: string; name: string } | null
}

interface StudyPlan {
  id: string
  examDate: string
  sessions: Session[]
}

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const api = useApi()

  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [redistributing, setRedistributing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  function load() {
    api
      .get<StudyPlan>(`/study/plans/current?courseId=${id}`)
      .then(setPlan)
      .catch(err => setError(err instanceof Error ? err.message : 'No active study plan for this course'))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleComplete(sessionId: string) {
    await api.post(`/study/sessions/${sessionId}/complete`, {}).catch(() => undefined)
    load()
  }

  async function handleRedistribute() {
    if (!plan) return
    setRedistributing(true)
    try {
      const result = await api.post<{ message: string }>(`/study/plans/${plan.id}/redistribute`, {})
      setNotice(result.message)
      load()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to redistribute')
    } finally {
      setRedistributing(false)
    }
  }

  if (error) {
    return (
      <div>
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
        <Link href={`/courses/${id}`} className="text-indigo-600 text-sm font-semibold">
          ← Back to course
        </Link>
      </div>
    )
  }
  if (!plan) return <p className="text-slate-500 text-sm">Loading…</p>

  const missedCount = plan.sessions.filter(s => s.status === 'MISSED').length

  const byDate = new Map<string, Session[]>()
  for (const s of plan.sessions) {
    const key = s.scheduledDate.slice(0, 10)
    byDate.set(key, [...(byDate.get(key) ?? []), s])
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Study plan</h1>
          <p className="text-slate-500 text-sm mt-1">Exam date: {new Date(plan.examDate).toDateString()}</p>
        </div>
        {missedCount > 0 && (
          <button onClick={handleRedistribute} disabled={redistributing} className="btn-secondary">
            {redistributing ? 'Redistributing…' : `Redistribute ${missedCount} missed session(s)`}
          </button>
        )}
      </div>

      {notice && <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm rounded-xl px-4 py-3 mb-6">{notice}</div>}

      <div className="space-y-4">
        {[...byDate.entries()].map(([date, sessions]) => (
          <div key={date} className="card p-5">
            <p className="text-sm font-semibold text-slate-700 mb-3">
              {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <ul className="space-y-2">
              {sessions.map(s => (
                <li key={s.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.topic?.name ?? 'Revision / buffer'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {s.startTime}–{s.endTime} · {s.estimatedMinutes} min
                    </p>
                  </div>
                  <span
                    className={`badge ${
                      s.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : s.status === 'MISSED'
                          ? 'bg-red-50 text-red-700'
                          : s.status === 'RESCHEDULED'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {s.status.replace('_', ' ').toLowerCase()}
                  </span>
                  {s.status === 'NOT_STARTED' && (
                    <button onClick={() => handleComplete(s.id)} className="text-xs text-indigo-600 font-semibold ml-3">
                      Mark complete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
