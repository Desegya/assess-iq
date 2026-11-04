'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/product/PageHeader'
import { Icon } from '@/components/product/Icon'
import { useApi } from '@/hooks/use-api'
import { getSubjectColor } from '@/lib/subject-color'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

interface Session {
  id: string
  startTime: string | null
  endTime: string | null
  estimatedMinutes: number
  status: string
  kind: 'LEARN' | 'REVIEW' | 'REVISION'
  note: string | null
  topic: { id: string; name: string } | null
  course: { id: string; title: string }
}

interface OverdueSession {
  id: string
  studyPlanId: string
  course: { id: string; title: string }
}

const KIND_LABEL = { LEARN: 'Learn', REVIEW: 'Review', REVISION: 'Final revision' } as const

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
  const [overdue, setOverdue] = useState<OverdueSession[]>([])
  const [saving, setSaving] = useState<string[]>([])
  const [sessionErrors, setSessionErrors] = useState<Record<string, string>>({})

  const [failedSession, setFailedSession] = useState<string | null>(null)
  const completionErrorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (failedSession && sessionErrors[failedSession]) completionErrorRef.current?.focus()
  }, [failedSession, sessionErrors])

  function load() {
    api
      .get<Session[]>(
        `/study/sessions/today?timeZone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`,
      )
      .then(setSessions)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load today’s sessions'),
      )
    api
      .get<OverdueSession[]>(
        `/study/sessions/overdue?timeZone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`,
      )
      .then(setOverdue)
      .catch(() => undefined)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleComplete(sessionId: string) {
    setSessionErrors((current) => ({ ...current, [sessionId]: '' }))
    setSaving((current) => [...current, sessionId])
    try {
      await api.post(`/study/sessions/${sessionId}/complete`, {
        confidenceRating: confidence[sessionId] ?? undefined,
      })
      setSessions(
        (current) =>
          current?.map((session) =>
            session.id === sessionId ? { ...session, status: 'COMPLETED' } : session,
          ) ?? null,
      )
    } catch (err) {
      setFailedSession(sessionId)
      setSessionErrors((current) => ({
        ...current,
        [sessionId]: err instanceof Error ? err.message : 'Could not save this session. Try again.',
      }))
    } finally {
      setSaving((current) => current.filter((id) => id !== sessionId))
    }
  }

  return (
    <div>
      <PageHeader
        title="Today"
        description="A little focus, one session at a time. Here’s your study plan for today."
        eyebrow="Your daily plan"
        icon="calendar"
      />

      {sessions && sessions.length > 0 && (
        <div role="status" className="card mb-4 p-4 text-sm text-slate-700">
          <p className="font-semibold">
            {sessions.filter((s) => s.status === 'COMPLETED').length} of {sessions.length} tasks
            complete today
          </p>
          <p className="mt-1 text-slate-500">
            {new Set(sessions.map((s) => s.course.id)).size} courses · About{' '}
            {sessions
              .filter((s) => s.status !== 'COMPLETED')
              .reduce((sum, s) => sum + s.estimatedMinutes, 0)}{' '}
            min remaining
          </p>
          {sessions.some((s) => !s.startTime) && (
            <p className="mt-1 text-slate-500">
              Study the “Anytime today” tasks whenever you have space. Mark them complete when you
              finish; opening a lesson alone does not mark it done.
            </p>
          )}
        </div>
      )}

      {overdue.length > 0 && (
        <details data-focus-distraction className="card mb-4 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-amber-800">
            Unfinished from earlier days ({overdue.length}
            {overdue.length === 50 ? '+' : ''})
          </summary>
          <p className="mt-2 text-sm text-slate-500">
            These stay separate from today’s workload. Review a course plan to mark work done or use
            “Update my plan” to spread the remaining work over future days.
          </p>
          <ul className="mt-3 space-y-2">
            {Array.from(new Map(overdue.map((s) => [s.course.id, s.course])).values()).map(
              (course) => (
                <li key={course.id}>
                  <Link
                    className="text-sm font-semibold text-violet-700"
                    href={`/courses/${course.id}/plan`}
                  >
                    Review {course.title} plan →
                  </Link>
                </li>
              ),
            )}
          </ul>
        </details>
      )}

      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
        >
          {error}
        </div>
      )}
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
        {sessions?.map((s) => (
          <div
            key={s.id}
            className="card card-accent p-6"
            style={{ ['--accent-color' as string]: getSubjectColor(s.course.id).hex }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-semibold ${getSubjectColor(s.course.id).text}`}>
                  {s.course.title}
                </p>
                <h2 className="font-heading font-bold text-slate-900 mt-0.5">
                  {s.topic?.name ?? (s.kind === 'LEARN' ? 'Course study' : 'Revision')}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {KIND_LABEL[s.kind]} ·{' '}
                  {s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : 'Anytime today'} ·{' '}
                  {s.estimatedMinutes} min
                  {s.note && <span className="text-amber-700"> · {s.note}</span>}
                </p>
              </div>
              <span
                className={`badge flex-shrink-0 ${
                  s.status === 'COMPLETED'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {s.status.replace('_', ' ').toLowerCase()}
              </span>
            </div>

            {s.status === 'NOT_STARTED' && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                <select
                  value={confidence[s.id] ?? ''}
                  onChange={(e) => setConfidence((c) => ({ ...c, [s.id]: Number(e.target.value) }))}
                  aria-label="How well do you understand this topic?"
                  className="input-base py-2 w-full sm:flex-1 sm:min-w-[220px]"
                >
                  <option value="">How well do you understand it?</option>
                  {CONFIDENCE_LABELS.map((label, i) => (
                    <option key={i} value={i + 1}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleComplete(s.id)}
                  disabled={saving.includes(s.id)}
                  className="btn-primary"
                >
                  <Icon name="check" />
                  {saving.includes(s.id) ? 'Saving…' : 'Mark complete'}
                </button>
                {!s.topic && (
                  <Link href={`/courses/${s.course.id}`} className="btn-secondary">
                    Open course & choose a topic
                  </Link>
                )}
                {s.topic && (
                  <>
                    <Link href={`/topics/${s.topic.id}/learn`} className="btn-secondary">
                      <Icon name="book" />
                      {s.kind === 'LEARN' ? 'Open lesson' : 'Revise lesson'}
                    </Link>
                    <Link href={`/topics/${s.topic.id}/quiz`} className="btn-secondary">
                      <Icon name="target" />
                      Take a quiz
                    </Link>
                  </>
                )}
              </div>
            )}
            {sessionErrors[s.id] && (
              <p
                ref={failedSession === s.id ? completionErrorRef : undefined}
                tabIndex={-1}
                role="alert"
                className="mt-3 text-sm text-red-700"
              >
                {sessionErrors[s.id]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
