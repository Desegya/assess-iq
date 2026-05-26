'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Attempt {
  id: string
  status: string
  score?: number
  percentageScore?: number
  startedAt: string
  submittedAt?: string
  student: { id: string; name: string; email: string }
  _count: { answers: number }
}

interface Assessment {
  id: string
  title: string
  totalQuestions: number
  durationMinutes: number
  course: { title: string }
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
      bg-[length:200%_100%] animate-shimmer rounded-lg ${className ?? ''}`} />
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    GRADED:         { label: 'Graded',         cls: 'bg-emerald-100 text-emerald-700' },
    SUBMITTED:      { label: 'Submitted',       cls: 'bg-blue-100 text-blue-700'      },
    AUTO_SUBMITTED: { label: 'Auto-submitted',  cls: 'bg-amber-100 text-amber-700'    },
    IN_PROGRESS:    { label: 'In Progress',     cls: 'bg-violet-100 text-violet-700'  },
  }
  const s = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssessmentResultsPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const api      = useApi()
  const apiRef   = useRef(api)
  apiRef.current = api

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [attempts,   setAttempts]   = useState<Attempt[]>([])
  const [loading,    setLoading]    = useState(true)
  const [sortBy,     setSortBy]     = useState<'name' | 'score' | 'date'>('date')
  const [sortDir,    setSortDir]    = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    if (!id) return
    Promise.all([
      apiRef.current.get<Assessment>(`/assessments/${id}`).catch(() => null),
      apiRef.current.get<Attempt[]>(`/attempts?assessmentId=${id}`).catch(() => []),
    ]).then(([ass, att]) => {
      setAssessment(ass)
      setAttempts(att)
    }).finally(() => setLoading(false))
  }, [id])

  // ── Derived stats ──────────────────────────────────────────────────────────

  const submitted = attempts.filter(
    a => a.status === 'SUBMITTED' || a.status === 'GRADED' || a.status === 'AUTO_SUBMITTED',
  )
  const inProgress = attempts.filter(a => a.status === 'IN_PROGRESS')

  const avgScore = submitted.length > 0
    ? submitted.reduce((s, a) => s + (a.percentageScore ?? 0), 0) / submitted.length
    : null

  const highScore = submitted.length > 0
    ? Math.max(...submitted.map(a => a.percentageScore ?? 0))
    : null

  const passCount = submitted.filter(a => (a.percentageScore ?? 0) >= 70).length

  // ── Sort ───────────────────────────────────────────────────────────────────

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir(col === 'date' ? 'desc' : 'asc') }
  }

  const sorted = [...attempts].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'name')  cmp = a.student.name.localeCompare(b.student.name)
    if (sortBy === 'score') cmp = (a.percentageScore ?? -1) - (b.percentageScore ?? -1)
    if (sortBy === 'date')  cmp = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    return sortDir === 'asc' ? cmp : -cmp
  })

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Back + Header ── */}
      <div className="mb-8 animate-slide-up">
        <button
          onClick={() => router.push(`/teacher/assessments/${id}`)}
          className="text-sm text-slate-500 hover:text-violet-600 font-medium transition-colors
                     flex items-center gap-1.5 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Assessment
        </button>

        {loading ? (
          <>
            <Skeleton className="h-7 w-64 mb-2" />
            <Skeleton className="h-4 w-40" />
          </>
        ) : (
          <>
            <h1 className="font-heading text-2xl font-bold text-slate-900">
              Student Results
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              <span className="font-semibold text-slate-700">{assessment?.title}</span>
              {assessment?.course && ` · ${assessment.course.title}`}
            </p>
          </>
        )}
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          {
            value: loading ? '—' : attempts.length,
            label: 'Total Attempts',
            color: 'text-violet-600',
            bg: 'bg-violet-50',
            icon: (
              <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
            delay: 0,
          },
          {
            value: loading ? '—' : avgScore != null ? `${Math.round(avgScore)}%` : '—',
            label: 'Average Score',
            color: avgScore != null && avgScore >= 70 ? 'text-emerald-600' :
                   avgScore != null && avgScore >= 50 ? 'text-amber-600' : 'text-slate-600',
            bg: 'bg-amber-50',
            icon: (
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ),
            delay: 75,
          },
          {
            value: loading ? '—' : highScore != null ? `${Math.round(highScore)}%` : '—',
            label: 'High Score',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            icon: (
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            ),
            delay: 150,
          },
          {
            value: loading ? '—' : submitted.length > 0
              ? `${passCount}/${submitted.length}`
              : '—',
            label: 'Passed (≥70%)',
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            icon: (
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            delay: 225,
          },
        ].map((s, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 animate-slide-up"
            style={{ animationDelay: `${s.delay}ms`, animationFillMode: 'both' }}
          >
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-2.5`}>
              {s.icon}
            </div>
            <p className={`text-2xl font-heading font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Score distribution bar ── */}
      {!loading && submitted.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 mb-6 animate-slide-up"
             style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <h2 className="font-heading font-semibold text-slate-800 mb-4 text-sm">Score Distribution</h2>
          <ScoreDistribution attempts={submitted} />
        </div>
      )}

      {/* ── Attempts table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden animate-slide-up"
           style={{ animationDelay: '350ms', animationFillMode: 'both' }}>

        {/* Table header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-heading font-semibold text-slate-800">
            All Attempts
            {!loading && (
              <span className="ml-2 text-sm font-normal text-slate-400">
                {attempts.length} total · {inProgress.length} in progress
              </span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="font-heading font-semibold text-slate-600">No attempts yet</p>
            <p className="text-slate-400 text-sm mt-1">Students haven&apos;t started this assessment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {(
                    [
                      { key: 'name',  label: 'Student'       },
                      { key: 'date',  label: 'Date'          },
                      { key: 'score', label: 'Score'         },
                      { key: null,    label: 'Status'        },
                      { key: null,    label: 'Questions'     },
                      { key: null,    label: ''              },
                    ] as Array<{ key: typeof sortBy | null; label: string }>
                  ).map((col, i) => (
                    <th
                      key={i}
                      className={`px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide
                                  ${col.key ? 'cursor-pointer hover:text-slate-700 select-none' : ''}`}
                      onClick={col.key ? () => toggleSort(col.key!) : undefined}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.key && sortBy === col.key && (
                          <svg className={`w-3 h-3 transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`}
                               fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map((attempt, idx) => {
                  const pct = attempt.percentageScore ?? null
                  const isCompleted = attempt.status !== 'IN_PROGRESS'
                  const scoreColor =
                    pct == null       ? 'text-slate-400' :
                    pct >= 70         ? 'text-emerald-600' :
                    pct >= 50         ? 'text-amber-600'   : 'text-red-600'
                  const barColor =
                    pct == null ? 'bg-slate-200' :
                    pct >= 70   ? 'bg-emerald-500' :
                    pct >= 50   ? 'bg-amber-500'   : 'bg-red-500'

                  return (
                    <tr
                      key={attempt.id}
                      className="hover:bg-slate-50/60 transition-colors group animate-slide-up"
                      style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'both' }}
                    >
                      {/* Student */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center
                                          flex-shrink-0 text-xs font-bold text-violet-700">
                            {attempt.student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{attempt.student.name}</p>
                            <p className="text-xs text-slate-400">{attempt.student.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {attempt.submittedAt
                          ? new Date(attempt.submittedAt).toLocaleDateString(undefined, {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })
                          : <span className="text-slate-300">—</span>
                        }
                      </td>

                      {/* Score */}
                      <td className="px-6 py-4">
                        {isCompleted && pct != null ? (
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${barColor} transition-all duration-500`}
                                   style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-sm font-heading font-bold flex-shrink-0 ${scoreColor}`}>
                              {Math.round(pct)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <StatusBadge status={attempt.status} />
                      </td>

                      {/* Questions answered */}
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {attempt._count.answers}
                        {assessment && (
                          <span className="text-slate-300"> / {assessment.totalQuestions}</span>
                        )}
                      </td>

                      {/* View button */}
                      <td className="px-6 py-4 text-right">
                        {isCompleted && (
                          <button
                            onClick={() => router.push(`/teacher/assessments/${id}/results/${attempt.id}`)}
                            className="text-xs font-semibold text-violet-600 hover:text-violet-700
                                       opacity-0 group-hover:opacity-100 transition-all"
                          >
                            View →
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Score distribution bar chart ────────────────────────────────────────────

function ScoreDistribution({ attempts }: { attempts: Attempt[] }) {
  const bands = [
    { label: '0–49',  min: 0,  max: 49,  color: 'bg-red-400'     },
    { label: '50–69', min: 50, max: 69,  color: 'bg-amber-400'   },
    { label: '70–84', min: 70, max: 84,  color: 'bg-emerald-400' },
    { label: '85–100',min: 85, max: 100, color: 'bg-emerald-600' },
  ]

  const counts = bands.map(b =>
    attempts.filter(a => {
      const pct = a.percentageScore ?? 0
      return pct >= b.min && pct <= b.max
    }).length,
  )
  const max = Math.max(...counts, 1)

  return (
    <div className="flex items-end gap-3 h-24">
      {bands.map((b, i) => {
        const c = counts[i] ?? 0
        return (
        <div key={b.label} className="flex-1 flex flex-col items-center gap-1.5">
          <span className="text-xs font-bold text-slate-700">
            {c > 0 ? c : ''}
          </span>
          <div className="w-full flex items-end justify-center">
            <div
              className={`w-full rounded-t-lg ${b.color} transition-all duration-700`}
              style={{
                height: c > 0 ? `${(c / max) * 72}px` : '4px',
                opacity: c > 0 ? 1 : 0.2,
              }}
            />
          </div>
          <span className="text-xs text-slate-400">{b.label}</span>
        </div>
        )
      })}
    </div>
  )
}
