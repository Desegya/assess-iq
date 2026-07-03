'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Assessment {
  id: string
  title: string
  description?: string
  durationMinutes: number
  status: string
  totalQuestions: number
  startTime?: string
  endTime?: string
  settings?: { maxAttempts?: number }
  course: { id: string; title: string }
  createdBy: { id: string; name: string }
  _count: { questions: number }
}

interface Attempt {
  id: string
  assessmentId: string
  status: string
  score?: number
  percentageScore?: number
  submittedAt?: string
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
      bg-[length:200%_100%] animate-shimmer rounded-lg ${className ?? ''}`} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentAssessmentsPage() {
  const router   = useRouter()
  const api      = useApi()
  const apiRef   = useRef(api)
  apiRef.current = api

  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [attempts,    setAttempts]    = useState<Attempt[]>([])
  const [loading,     setLoading]     = useState(true)
  const [starting,    setStarting]    = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      apiRef.current.get<Assessment[]>('/assessments').catch(() => []),
      apiRef.current.get<Attempt[]>('/attempts/my').catch(() => []),
    ]).then(([ass, att]) => {
      setAssessments(ass); setAttempts(att)
    }).finally(() => setLoading(false))
  }, [])

  // Group all attempts by assessmentId (API returns newest first)
  const attemptsByAssessment = new Map<string, Attempt[]>()
  for (const a of attempts) {
    const bucket = attemptsByAssessment.get(a.assessmentId) ?? []
    bucket.push(a)
    attemptsByAssessment.set(a.assessmentId, bucket)
  }

  function getWindowStatus(a: Assessment): 'not-open' | 'open' | 'closed' {
    const now = Date.now()
    if (a.startTime && now < new Date(a.startTime).getTime()) return 'not-open'
    if (a.endTime   && now > new Date(a.endTime).getTime())   return 'closed'
    return 'open'
  }

  async function handleStart(assessmentId: string) {
    setStarting(assessmentId)
    try {
      const result = await api.post<{ id: string }>('/attempts', { assessmentId })
      router.push(`/student/assessments/${assessmentId}/take?attemptId=${result.id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not start assessment')
      setStarting(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-slate-900">My Assessments</h1>
        <p className="text-slate-500 text-sm mt-1">Available tests from your teachers</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 flex gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
                <div className="flex gap-3 pt-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-9 w-20 rounded-lg self-start flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="font-heading font-semibold text-slate-700 text-lg">No assessments available yet</p>
          <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
            Check back later — your teacher will publish tests here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a, idx) => {
            const allAttempts      = attemptsByAssessment.get(a.id) ?? []
            const inProgress       = allAttempts.find(x => x.status === 'IN_PROGRESS')
            const completed        = allAttempts.filter(x =>
              x.status === 'SUBMITTED' || x.status === 'GRADED' || x.status === 'AUTO_SUBMITTED'
            )
            const latestCompleted  = completed[0]
            const maxAttempts      = a.settings?.maxAttempts ?? 1
            const isSubmitted      = completed.length > 0 && !inProgress
            const isInProgress     = !!inProgress
            const attempt          = inProgress ?? latestCompleted   // for score display
            const canRetake        = completed.length > 0 && completed.length < maxAttempts && !inProgress
            const windowStatus     = getWindowStatus(a)
            const isLocked         = !isSubmitted && !isInProgress && !canRetake && windowStatus !== 'open'

            return (
              <div
                key={a.id}
                className={`bg-white rounded-2xl border shadow-card transition-all duration-200 p-5 animate-slide-up ${
                  isLocked ? 'border-slate-200 opacity-75' : 'border-slate-200 hover:shadow-card-hover'
                }`}
                style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs text-slate-400 font-medium">{a.course.title}</span>
                      {isSubmitted && (
                        <span className="text-xs font-semibold bg-emerald-100 text-emerald-700
                                         px-2 py-0.5 rounded-full">
                          Completed
                        </span>
                      )}
                      {isInProgress && (
                        <span className="text-xs font-semibold bg-amber-100 text-amber-700
                                         px-2 py-0.5 rounded-full">
                          In Progress
                        </span>
                      )}
                      {windowStatus === 'not-open' && !isSubmitted && !isInProgress && (
                        <span className="text-xs font-semibold bg-blue-100 text-blue-700
                                         px-2 py-0.5 rounded-full">
                          Not yet open
                        </span>
                      )}
                      {windowStatus === 'closed' && !isSubmitted && !isInProgress && (
                        <span className="text-xs font-semibold bg-slate-100 text-slate-500
                                         px-2 py-0.5 rounded-full">
                          Closed
                        </span>
                      )}
                    </div>
                    <h2 className="font-heading text-base font-bold text-slate-900">{a.title}</h2>
                    {a.description && (
                      <p className="text-sm text-slate-500 mt-0.5 truncate">{a.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" strokeWidth="1.8"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 6v6l4 2"/>
                        </svg>
                        {a.durationMinutes} min
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
                        </svg>
                        {a._count.questions} questions
                      </span>
                      {a.startTime && windowStatus === 'not-open' && (
                        <span className="font-medium text-blue-600">
                          Opens {new Date(a.startTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {a.endTime && windowStatus === 'closed' && (
                        <span>Closed {new Date(a.endTime).toLocaleDateString()}</span>
                      )}
                      {a.endTime && windowStatus === 'open' && (
                        <span className="font-medium text-amber-600">
                          Closes {new Date(a.endTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {latestCompleted?.percentageScore != null && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              latestCompleted.percentageScore! >= 70 ? 'bg-emerald-500' :
                              latestCompleted.percentageScore! >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${latestCompleted.percentageScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700">
                          {Math.round(latestCompleted.percentageScore!)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    {isInProgress ? (
                      <button
                        onClick={() => void handleStart(a.id)}
                        disabled={starting === a.id}
                        className="bg-amber-500 hover:bg-amber-600 active:scale-[0.97] disabled:opacity-60
                                   text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all"
                      >
                        {starting === a.id ? 'Loading…' : 'Resume →'}
                      </button>
                    ) : isSubmitted ? (
                      <>
                        <button
                          onClick={() => router.push(`/student/results/${latestCompleted!.id}`)}
                          className="text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors"
                        >
                          View results →
                        </button>
                        {canRetake && windowStatus === 'open' && (
                          <button
                            onClick={() => void handleStart(a.id)}
                            disabled={starting === a.id}
                            className="bg-violet-600 hover:bg-violet-700 active:scale-[0.97] disabled:opacity-60
                                       text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-sm"
                          >
                            {starting === a.id ? '…' : `Retake (${completed.length}/${maxAttempts})`}
                          </button>
                        )}
                        {canRetake && windowStatus !== 'open' && (
                          <span className="text-xs text-slate-400 font-medium">
                            {completed.length}/{maxAttempts} attempts
                          </span>
                        )}
                      </>
                    ) : windowStatus === 'not-open' ? (
                      <div className="text-center">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center mx-auto">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      </div>
                    ) : windowStatus === 'closed' ? (
                      <span className="text-xs font-medium text-slate-400">Ended</span>
                    ) : (
                      <button
                        onClick={() => void handleStart(a.id)}
                        disabled={starting === a.id}
                        className="bg-violet-600 hover:bg-violet-700 active:scale-[0.97] disabled:opacity-60
                                   text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
                      >
                        {starting === a.id ? 'Loading…' : 'Start Test →'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
