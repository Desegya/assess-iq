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

  const attemptMap = new Map(attempts.map(a => [a.assessmentId, a]))

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
            const attempt     = attemptMap.get(a.id)
            const isSubmitted = attempt?.status === 'SUBMITTED' ||
                                attempt?.status === 'GRADED' ||
                                attempt?.status === 'AUTO_SUBMITTED'
            const isInProgress = attempt?.status === 'IN_PROGRESS'

            return (
              <div
                key={a.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-card
                           hover:shadow-card-hover transition-all duration-200 p-5 animate-slide-up"
                style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
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
                    </div>
                    <h2 className="font-heading text-base font-bold text-slate-900">{a.title}</h2>
                    {a.description && (
                      <p className="text-sm text-slate-500 mt-0.5 truncate">{a.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
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
                      {a.startTime && (
                        <span>Opens {new Date(a.startTime).toLocaleDateString()}</span>
                      )}
                    </div>

                    {isSubmitted && attempt?.percentageScore != null && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              attempt.percentageScore >= 70 ? 'bg-emerald-500' :
                              attempt.percentageScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${attempt.percentageScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700">
                          {Math.round(attempt.percentageScore)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {isSubmitted ? (
                      <button
                        onClick={() => router.push(`/student/results/${attempt!.id}`)}
                        className="text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors"
                      >
                        View results →
                      </button>
                    ) : isInProgress ? (
                      <button
                        onClick={() => void handleStart(a.id)}
                        disabled={starting === a.id}
                        className="bg-amber-500 hover:bg-amber-600 active:scale-[0.97] disabled:opacity-60
                                   text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all"
                      >
                        {starting === a.id ? 'Loading…' : 'Resume →'}
                      </button>
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
