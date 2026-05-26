'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useApi } from '@/hooks/use-api'

interface Assessment {
  id: string
  title: string
  durationMinutes: number
  course: { id: string; title: string }
  _count: { questions: number }
}

interface AttemptSummary {
  id: string
  status: string
  percentageScore?: number
  submittedAt?: string
  assessment: { id: string; title: string; course: { title: string } }
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
      bg-[length:200%_100%] animate-shimmer rounded-lg ${className ?? ''}`} />
  )
}

export default function StudentDashboard() {
  const { user }  = useAuth()
  const router    = useRouter()
  const api       = useApi()
  const apiRef    = useRef(api)
  apiRef.current  = api

  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [attempts,    setAttempts]    = useState<AttemptSummary[]>([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      apiRef.current.get<Assessment[]>('/assessments').catch(() => []),
      apiRef.current.get<AttemptSummary[]>('/attempts/my').catch(() => []),
    ]).then(([ass, att]) => {
      setAssessments(ass); setAttempts(att)
    }).finally(() => setLoading(false))
  }, [])

  const attemptMap = new Map(attempts.map(a => [a.assessment.id, a]))
  const pending = assessments.filter(a => {
    const att = attemptMap.get(a.id)
    return !att || att.status === 'IN_PROGRESS'
  })
  const completed = attempts.filter(
    a => a.status === 'SUBMITTED' || a.status === 'GRADED' || a.status === 'AUTO_SUBMITTED',
  )
  const avgScore = completed.length > 0
    ? completed.reduce((sum, a) => sum + (a.percentageScore ?? 0), 0) / completed.length
    : null

  const firstName = user?.name?.split(' ')[0] ?? 'there'

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Greeting ── */}
      <div className="mb-8 animate-slide-up">
        <h1 className="font-heading text-2xl font-bold text-slate-900">
          Hello, {firstName}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Here&apos;s what&apos;s on your plate today.
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            value: loading ? '—' : assessments.length,
            label: 'Available Tests',
            color: 'text-violet-600',
            bg: 'bg-violet-50',
            delay: 0,
            icon: (
              <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
              </svg>
            ),
          },
          {
            value: loading ? '—' : completed.length,
            label: 'Completed',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            delay: 75,
            icon: (
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
          {
            value: loading ? '—' : avgScore != null ? `${Math.round(avgScore)}%` : '—',
            label: 'Avg. Score',
            color: avgScore != null && avgScore >= 70 ? 'text-emerald-600' :
                   avgScore != null && avgScore >= 50 ? 'text-amber-600' : 'text-slate-600',
            bg: 'bg-amber-50',
            delay: 150,
            icon: (
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ),
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 animate-slide-up"
            style={{ animationDelay: `${stat.delay}ms`, animationFillMode: 'both' }}
          >
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              {stat.icon}
            </div>
            <p className={`text-3xl font-heading font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── Pending tests ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card animate-slide-up"
             style={{ animationDelay: '225ms', animationFillMode: 'both' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-heading font-semibold text-slate-800">Upcoming Tests</h2>
            <a href="/student/assessments"
               className="text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors">
              View all →
            </a>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-50">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-14 rounded-lg" />
                </div>
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600">All caught up!</p>
              <p className="text-xs text-slate-400 mt-1">No pending tests right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {pending.slice(0, 4).map(a => {
                const att = attemptMap.get(a.id)
                const isInProgress = att?.status === 'IN_PROGRESS'
                return (
                  <div key={a.id}
                       className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {a.course.title} · {a._count.questions}q · {a.durationMinutes}m
                      </p>
                    </div>
                    <button
                      onClick={() => router.push('/student/assessments')}
                      className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg
                                  transition-all active:scale-[0.97] ${
                        isInProgress
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-violet-600 hover:bg-violet-700 text-white'
                      }`}
                    >
                      {isInProgress ? 'Resume' : 'Start'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Recent results ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card animate-slide-up"
             style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-heading font-semibold text-slate-800">Recent Results</h2>
            <a href="/student/results"
               className="text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors">
              View all →
            </a>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-50">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-12" />
                </div>
              ))}
            </div>
          ) : completed.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600">No results yet</p>
              <p className="text-xs text-slate-400 mt-1">Complete a test to see your score here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {completed.slice(0, 4).map(a => {
                const pct = a.percentageScore ?? 0
                const scoreColor = pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'
                const barColor   = pct >= 70 ? 'bg-emerald-500'  : pct >= 50 ? 'bg-amber-500'  : 'bg-red-500'
                return (
                  <div
                    key={a.id}
                    onClick={() => router.push(`/student/results/${a.id}`)}
                    className="px-5 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.assessment.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{a.assessment.course.title}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-1">
                          <div className={`h-1 rounded-full ${barColor}`}
                               style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                    <span className={`flex-shrink-0 text-base font-heading font-bold ${scoreColor}`}>
                      {Math.round(pct)}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
