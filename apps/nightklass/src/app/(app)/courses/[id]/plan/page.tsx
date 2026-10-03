'use client'

import { useEffect, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
import { Skeleton } from '@/components/ui/Skeleton'

type Kind = 'LEARN' | 'REVIEW' | 'REVISION'

interface Session {
  id: string
  scheduledDate: string
  startTime: string
  endTime: string
  estimatedMinutes: number
  status: string
  kind: Kind
  weekNumber: number | null
  note: string | null
  topic: { id: string; name: string } | null
}

interface StudyPlan {
  id: string
  examDate: string
  startDate: string
  planType: 'EXAM_DATE' | 'DURATION'
  weeks: number | null
  changeLog: { at: string; reason: string }[]
  missedCount: number
  outlineChanged: boolean
  sessions: Session[]
}

const KIND_BADGE: Record<Kind, { label: string; className: string }> = {
  LEARN: { label: 'Learn', className: 'bg-blue-50 text-blue-700' },
  REVIEW: { label: 'Review', className: 'bg-amber-50 text-amber-700' },
  REVISION: { label: 'Final revision', className: 'bg-violet-50 text-violet-700' },
}

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  MISSED: 'bg-red-50 text-red-700',
  RESCHEDULED: 'bg-amber-50 text-amber-700',
}

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const api = useApi()

  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adapting, setAdapting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showPast, setShowPast] = useState(false)

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

  async function handleAdapt() {
    if (!plan) return
    setAdapting(true)
    try {
      setPlan(await api.post<StudyPlan>(`/study/plans/${plan.id}/adapt`, {}))
      setShowHistory(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update the plan')
    } finally {
      setAdapting(false)
    }
  }

  if (error) {
    return (
      <div>
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
        <Link href={`/courses/${id}`} className="text-blue-600 text-sm font-semibold">
          ← Back to course
        </Link>
      </div>
    )
  }
  if (!plan)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )

  const today = new Date().toISOString().slice(0, 10)
  const visible = plan.sessions.filter(s => showPast || s.scheduledDate.slice(0, 10) >= today || s.status === 'NOT_STARTED')
  const hiddenPast = plan.sessions.length - visible.length

  // Group into weeks, then days
  const weeks = new Map<number, Session[]>()
  for (const s of visible) {
    const w = s.weekNumber ?? 1
    weeks.set(w, [...(weeks.get(w) ?? []), s])
  }

  const done = plan.sessions.filter(s => s.status === 'COMPLETED').length
  const total = plan.sessions.filter(s => s.status !== 'MISSED' && s.status !== 'RESCHEDULED').length
  const daysLeft = Math.max(0, Math.ceil((new Date(plan.examDate).getTime() - Date.now()) / 86400000))
  const history = [...(plan.changeLog ?? [])].reverse()

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/courses/${id}`} className="text-sm text-blue-600 font-semibold">
          ← Back to course
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap mt-2">
          <div>
            <h1 className="font-heading text-2xl font-bold text-slate-900">Study plan</h1>
            <p className="text-slate-500 text-sm mt-1">
              {plan.planType === 'DURATION' && plan.weeks ? `${plan.weeks}-week plan, ends` : 'Exam'}{' '}
              {new Date(plan.examDate).toDateString()} · {daysLeft} day{daysLeft === 1 ? '' : 's'} left · {done}/{total} sessions done
            </p>
          </div>
          <button onClick={handleAdapt} disabled={adapting} className="btn-secondary">
            {adapting ? 'Updating…' : 'Update my plan'}
          </button>
        </div>
      </div>

      {(plan.missedCount > 0 || plan.outlineChanged) && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-amber-800">
            {plan.missedCount > 0 &&
              `You missed ${plan.missedCount} session${plan.missedCount === 1 ? '' : 's'}. `}
            {plan.outlineChanged && 'Your course outline changed since this plan was made. '}
            Nightklass can rework the rest of your plan around it.
          </p>
          <button onClick={handleAdapt} disabled={adapting} className="btn-primary !py-2 !px-3 text-sm">
            {adapting ? 'Updating…' : 'Rework my plan'}
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(v => !v)} className="text-xs font-semibold text-slate-500 hover:text-blue-600">
            {showHistory ? 'Hide' : 'What changed'} ({history.length})
          </button>
          {showHistory && (
            <ul className="mt-2 rounded-xl border border-slate-200 p-4 space-y-1.5">
              {history.map((h, i) => (
                <li key={i} className="flex justify-between gap-3 text-xs">
                  <span className="text-slate-700">{h.reason}</span>
                  <span className="text-slate-400 flex-shrink-0">{new Date(h.at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hiddenPast > 0 && (
        <button onClick={() => setShowPast(v => !v)} className="text-xs font-semibold text-slate-500 hover:text-blue-600">
          {showPast ? 'Hide past sessions' : `Show ${hiddenPast} past session${hiddenPast === 1 ? '' : 's'}`}
        </button>
      )}

      {[...weeks.entries()].map(([week, sessions]) => {
        const topicNames = [...new Set(sessions.filter(s => s.kind === 'LEARN' && s.topic).map(s => s.topic!.name))]
        const weekDone = sessions.filter(s => s.status === 'COMPLETED').length
        const byDate = new Map<string, Session[]>()
        for (const s of sessions) {
          const key = s.scheduledDate.slice(0, 10)
          byDate.set(key, [...(byDate.get(key) ?? []), s])
        }
        return (
          <section key={week} className="card p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
              <h2 className="font-heading font-bold text-slate-900">Week {week}</h2>
              <span className="text-xs font-semibold text-slate-500">
                {weekDone}/{sessions.length} done
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {topicNames.length > 0
                ? `Target: ${topicNames.join(', ')}`
                : sessions.some(s => s.kind === 'REVISION')
                  ? 'Target: final revision before the exam'
                  : 'Target: review earlier topics'}
            </p>
            <div className="space-y-4">
              {[...byDate.entries()].map(([date, daySessions]) => (
                <div key={date}>
                  <p className={`text-xs font-semibold mb-1.5 ${date === today ? 'text-blue-600' : 'text-slate-500'}`}>
                    {date === today ? 'Today · ' : ''}
                    {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                  <ul className="space-y-2">
                    {daySessions.map(s => (
                      <li key={s.id} className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`badge !text-[10px] ${KIND_BADGE[s.kind].className}`}>{KIND_BADGE[s.kind].label}</span>
                            <p className="text-sm font-medium text-slate-800">{s.topic?.name ?? 'Revision'}</p>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {s.startTime}–{s.endTime} · {s.estimatedMinutes} min
                            {s.note && <span className="text-amber-700"> · {s.note}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {s.status === 'NOT_STARTED' ? (
                            <>
                              {s.topic && (
                                <>
                                  <Link href={`/topics/${s.topic.id}/learn`} className="text-xs text-blue-600 font-semibold">
                                    {s.kind === 'LEARN' ? 'Learn' : 'Revise'}
                                  </Link>
                                  <Link href={`/topics/${s.topic.id}/quiz`} className="text-xs text-blue-600 font-semibold">
                                    Quiz
                                  </Link>
                                </>
                              )}
                              <button onClick={() => handleComplete(s.id)} className="text-xs text-slate-500 font-semibold hover:text-emerald-700">
                                Done
                              </button>
                            </>
                          ) : (
                            <span className={`badge ${STATUS_BADGE[s.status] ?? 'bg-slate-100 text-slate-600'}`}>
                              {s.status.replace('_', ' ').toLowerCase()}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
