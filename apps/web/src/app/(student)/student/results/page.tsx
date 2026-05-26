'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'

interface AttemptSummary {
  id: string
  status: string
  score?: number
  percentageScore?: number
  startedAt: string
  submittedAt?: string
  assessment: {
    id: string
    title: string
    durationMinutes: number
    totalQuestions: number
    course: { id: string; title: string }
  }
  _count: { answers: number }
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
      bg-[length:200%_100%] animate-shimmer rounded-lg ${className ?? ''}`} />
  )
}

export default function StudentResultsPage() {
  const router   = useRouter()
  const api      = useApi()
  const apiRef   = useRef(api)
  apiRef.current = api

  const [attempts, setAttempts] = useState<AttemptSummary[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    void apiRef.current
      .get<AttemptSummary[]>('/attempts/my')
      .then(setAttempts)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  const completed = attempts.filter(
    a => a.status === 'SUBMITTED' || a.status === 'GRADED' || a.status === 'AUTO_SUBMITTED',
  )

  const avgScore = completed.length > 0
    ? completed.reduce((s, a) => s + (a.percentageScore ?? 0), 0) / completed.length
    : null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 animate-slide-up">
        <h1 className="font-heading text-2xl font-bold text-slate-900">My Results</h1>
        <p className="text-slate-500 text-sm mt-1">
          {completed.length} completed assessment{completed.length !== 1 ? 's' : ''}
          {avgScore != null && ` · avg. ${Math.round(avgScore)}%`}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 flex gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2 w-full rounded-full mt-3" />
              </div>
              <Skeleton className="w-14 h-14 rounded-2xl flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : completed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="font-heading font-semibold text-slate-700 text-lg">No results yet</p>
          <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
            Complete an assessment to see your scores here.
          </p>
          <a href="/student/assessments"
             className="mt-5 inline-block text-sm font-semibold text-violet-600
                        hover:text-violet-700 transition-colors">
            Go to Assessments →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {completed.map((a, idx) => {
            const pct = a.percentageScore ?? 0
            const isPass = pct >= 70
            const isFair = pct >= 50

            const scoreColor = isPass ? 'text-emerald-600' : isFair ? 'text-amber-600' : 'text-red-600'
            const barColor   = isPass ? 'bg-emerald-500'  : isFair ? 'bg-amber-500'  : 'bg-red-500'
            const scoreBoxBg = isPass ? 'bg-emerald-50 border-emerald-200' :
                               isFair ? 'bg-amber-50 border-amber-200'    : 'bg-red-50 border-red-200'

            return (
              <div
                key={a.id}
                onClick={() => router.push(`/student/results/${a.id}`)}
                className="bg-white rounded-2xl border border-slate-200 shadow-card
                           hover:shadow-card-hover hover:border-violet-200 cursor-pointer
                           transition-all duration-200 p-5 group animate-slide-up"
                style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 font-medium mb-1">
                      {a.assessment.course.title}
                    </p>
                    <h2 className="font-heading text-base font-bold text-slate-900 truncate">
                      {a.assessment.title}
                    </h2>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
                      <span>
                        Submitted{' '}
                        {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '—'}
                      </span>
                      <span>{a._count.answers} answered</span>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${barColor} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Score box */}
                  <div className={`flex-shrink-0 w-14 h-14 rounded-2xl border flex flex-col
                                   items-center justify-center ${scoreBoxBg}`}>
                    <span className={`text-lg font-heading font-bold leading-none ${scoreColor}`}>
                      {Math.round(pct)}
                    </span>
                    <span className={`text-xs font-semibold ${scoreColor}`}>%</span>
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
