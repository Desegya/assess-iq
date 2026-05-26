'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Overview {
  totalStudents: number
  totalAssessments: number
  totalAttempts: number
  completedAttempts: number
  totalQuestions: number
  totalCourses: number
  avgScore: number | null
  passRate: number | null
}

interface ScoreBand {
  label: string
  min: number
  max: number
  count: number
}

interface AssessmentRow {
  id: string
  title: string
  course: string
  status: string
  attemptCount: number
  avgScore: number | null
}

interface ActivityItem {
  id: string
  studentName: string
  assessmentTitle: string
  assessmentId: string
  percentageScore: number | null
  submittedAt: string | null
}

interface CourseRow {
  id: string
  title: string
  subject: string
  assessmentCount: number
  attemptCount: number
  avgScore: number | null
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
      bg-[length:200%_100%] animate-shimmer rounded-lg ${className ?? ''}`} />
  )
}

// ─── Score ring (small) ───────────────────────────────────────────────────────

function MiniRing({ value, label, color }: { value: number | null; label: string; color: string }) {
  const radius = 28
  const circ   = 2 * Math.PI * radius
  const dash   = value != null ? (value / 100) * circ : 0

  const ringColor =
    color === 'auto'
      ? value == null ? '#94a3b8'
        : value >= 70 ? '#10b981'
        : value >= 50 ? '#f59e0b' : '#ef4444'
      : color

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <svg width="68" height="68" viewBox="0 0 68 68">
          <circle cx="34" cy="34" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="7" />
          {value != null && (
            <circle
              cx="34" cy="34" r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="7"
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              transform="rotate(-90 34 34)"
              style={{ transition: 'stroke-dasharray 1s ease-out 0.2s' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-heading font-bold" style={{ color: ringColor }}>
            {value != null ? `${value}%` : '—'}
          </span>
        </div>
      </div>
      <span className="text-xs text-slate-500 text-center font-medium">{label}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router   = useRouter()
  const api      = useApi()
  const apiRef   = useRef(api)
  apiRef.current = api

  const [overview,     setOverview]     = useState<Overview | null>(null)
  const [distribution, setDistribution] = useState<ScoreBand[]>([])
  const [assessments,  setAssessments]  = useState<AssessmentRow[]>([])
  const [activity,     setActivity]     = useState<ActivityItem[]>([])
  const [courses,      setCourses]      = useState<CourseRow[]>([])
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    Promise.all([
      apiRef.current.get<Overview>('/analytics/overview').catch(() => null),
      apiRef.current.get<ScoreBand[]>('/analytics/score-distribution').catch(() => []),
      apiRef.current.get<AssessmentRow[]>('/analytics/assessments').catch(() => []),
      apiRef.current.get<ActivityItem[]>('/analytics/recent-activity').catch(() => []),
      apiRef.current.get<CourseRow[]>('/analytics/courses').catch(() => []),
    ]).then(([ov, dist, ass, act, crs]) => {
      setOverview(ov)
      setDistribution(dist)
      setAssessments(ass)
      setActivity(act)
      setCourses(crs)
    }).finally(() => setLoading(false))
  }, [])

  // ── Top stat cards ─────────────────────────────────────────────────────────

  const statCards = overview
    ? [
        {
          value: overview.totalStudents,
          label: 'Total Students',
          color: 'text-violet-600',
          bg: 'bg-violet-50',
          delay: 0,
          icon: (
            <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          value: overview.completedAttempts,
          label: 'Completed Attempts',
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
          value: overview.totalAssessments,
          label: 'Assessments',
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          delay: 150,
          icon: (
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          ),
        },
        {
          value: overview.totalQuestions,
          label: 'Questions',
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          delay: 225,
          icon: (
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
      ]
    : []

  const maxBandCount = Math.max(...distribution.map(b => b.count), 1)

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-8 animate-slide-up">
        <h1 className="font-heading text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">
          Student performance overview and trends
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5">
                <Skeleton className="w-9 h-9 rounded-xl mb-3" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))
          : statCards.map((s, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 animate-slide-up"
                style={{ animationDelay: `${s.delay}ms`, animationFillMode: 'both' }}
              >
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                  {s.icon}
                </div>
                <p className={`text-3xl font-heading font-bold ${s.color}`}>{s.value}</p>
                <p className="text-sm text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
      </div>

      {/* ── Score rings + distribution ── */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">

        {/* Score rings */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 animate-slide-up"
             style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <h2 className="font-heading font-semibold text-slate-800 mb-5 text-sm">Performance Metrics</h2>
          {loading ? (
            <div className="flex justify-around">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <Skeleton className="w-16 h-16 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex justify-around">
              <MiniRing
                value={overview?.avgScore ?? null}
                label="Avg. Score"
                color="auto"
              />
              <MiniRing
                value={overview?.passRate ?? null}
                label="Pass Rate"
                color="#7c3aed"
              />
            </div>
          )}

          {!loading && overview && (
            <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-xl font-heading font-bold text-slate-900">{overview.totalCourses}</p>
                <p className="text-xs text-slate-400 mt-0.5">Courses</p>
              </div>
              <div>
                <p className="text-xl font-heading font-bold text-slate-900">{overview.totalAttempts}</p>
                <p className="text-xs text-slate-400 mt-0.5">Total attempts</p>
              </div>
            </div>
          )}
        </div>

        {/* Score distribution */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-card p-5 animate-slide-up"
             style={{ animationDelay: '350ms', animationFillMode: 'both' }}>
          <h2 className="font-heading font-semibold text-slate-800 mb-5 text-sm">Score Distribution</h2>
          {loading ? (
            <div className="flex items-end gap-2 h-28">
              {[40, 65, 55, 80, 70, 90, 75, 60, 45, 35].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-md animate-shimmer bg-slate-200"
                     style={{ height: `${h}%` } as React.CSSProperties} />
              ))}
            </div>
          ) : distribution.length === 0 || distribution.every(b => b.count === 0) ? (
            <div className="h-28 flex items-center justify-center text-slate-400 text-sm">
              No data yet — awaiting completed attempts
            </div>
          ) : (
            <div className="flex items-end gap-1.5 h-28">
              {distribution.map(b => {
                const pct = (b.count / maxBandCount) * 100
                const barColor =
                  b.min < 50  ? 'bg-red-400' :
                  b.min < 70  ? 'bg-amber-400' :
                  b.min < 85  ? 'bg-emerald-400' : 'bg-emerald-600'
                return (
                  <div key={b.label} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip */}
                    {b.count > 0 && (
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2
                                      bg-slate-800 text-white text-xs px-2 py-1 rounded-lg
                                      opacity-0 group-hover:opacity-100 transition-opacity
                                      pointer-events-none whitespace-nowrap z-10">
                        {b.count} student{b.count !== 1 ? 's' : ''}
                      </div>
                    )}
                    <div className="w-full flex items-end" style={{ height: '88px' }}>
                      <div
                        className={`w-full rounded-t-md ${barColor} transition-all duration-700`}
                        style={{
                          height: b.count > 0 ? `${pct}%` : '3px',
                          opacity: b.count > 0 ? 1 : 0.15,
                          minHeight: '3px',
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 leading-none">{b.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row: assessments leaderboard + recent activity ── */}
      <div className="grid lg:grid-cols-5 gap-6 mb-6">

        {/* Assessment leaderboard */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden
                        animate-slide-up" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-heading font-semibold text-slate-800 text-sm">Assessments by Avg. Score</h2>
            <a href="/teacher/assessments"
               className="text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors">
              View all →
            </a>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-12" />
                </div>
              ))}
            </div>
          ) : assessments.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm text-slate-400">No assessments yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {assessments.map((a, i) => {
                const pct = a.avgScore
                const scoreColor =
                  pct == null ? 'text-slate-300' :
                  pct >= 70   ? 'text-emerald-600' :
                  pct >= 50   ? 'text-amber-600'   : 'text-red-600'
                const barColor =
                  pct == null ? 'bg-slate-200' :
                  pct >= 70   ? 'bg-emerald-500' :
                  pct >= 50   ? 'bg-amber-500'   : 'bg-red-500'

                return (
                  <div
                    key={a.id}
                    onClick={() => router.push(`/teacher/assessments/${a.id}/results`)}
                    className="px-5 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
                  >
                    <span className="text-xs font-mono text-slate-300 w-4 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-slate-400 truncate">{a.course}</p>
                        {a.attemptCount > 0 && (
                          <div className="flex-1 bg-slate-100 rounded-full h-1">
                            <div
                              className={`h-1 rounded-full ${barColor} transition-all duration-700`}
                              style={{ width: pct != null ? `${pct}%` : '0%' }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`text-sm font-heading font-bold ${scoreColor}`}>
                        {pct != null ? `${pct}%` : '—'}
                      </span>
                      <p className="text-[10px] text-slate-400">{a.attemptCount} attempt{a.attemptCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden
                        animate-slide-up" style={{ animationDelay: '450ms', animationFillMode: 'both' }}>
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-heading font-semibold text-slate-800 text-sm">Recent Submissions</h2>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-50">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-10" />
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm text-slate-400">No submissions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 overflow-y-auto max-h-80">
              {activity.map(item => {
                const pct = item.percentageScore
                const scoreColor =
                  pct == null ? 'text-slate-300' :
                  pct >= 70   ? 'text-emerald-600' :
                  pct >= 50   ? 'text-amber-600'   : 'text-red-600'

                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/teacher/assessments/${item.assessmentId}/results/${item.id}`)}
                    className="px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center
                                    flex-shrink-0 text-xs font-bold text-violet-700">
                      {item.studentName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{item.studentName}</p>
                      <p className="text-[11px] text-slate-400 truncate">{item.assessmentTitle}</p>
                    </div>
                    <span className={`text-sm font-heading font-bold flex-shrink-0 ${scoreColor}`}>
                      {pct != null ? `${Math.round(pct)}%` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Course breakdown ── */}
      {!loading && courses.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden
                        animate-slide-up" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-heading font-semibold text-slate-800 text-sm">Course Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Course', 'Subject', 'Assessments', 'Attempts', 'Avg. Score'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {courses.map((c, idx) => {
                  const pct = c.avgScore
                  const scoreColor =
                    pct == null ? 'text-slate-300' :
                    pct >= 70   ? 'text-emerald-600' :
                    pct >= 50   ? 'text-amber-600'   : 'text-red-600'
                  const barColor =
                    pct == null ? 'bg-slate-200' :
                    pct >= 70   ? 'bg-emerald-500' :
                    pct >= 50   ? 'bg-amber-500'   : 'bg-red-500'

                  return (
                    <tr key={c.id}
                        className="hover:bg-slate-50/60 transition-colors animate-slide-up"
                        style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'both' }}>
                      <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">{c.title}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{c.subject}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-700">{c.assessmentCount}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-700">{c.attemptCount}</td>
                      <td className="px-5 py-3.5">
                        {c.attemptCount > 0 && pct != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${barColor}`}
                                   style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-sm font-heading font-bold ${scoreColor}`}>
                              {pct}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state when no data at all */}
      {!loading && overview && overview.totalAttempts === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center mt-6 animate-slide-up"
             style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="font-heading font-semibold text-slate-700 text-lg">No data yet</p>
          <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
            Analytics appear once students start completing assessments.
          </p>
          <button
            onClick={() => router.push('/teacher/assessments')}
            className="mt-5 inline-block text-sm font-semibold text-violet-600
                       hover:text-violet-700 transition-colors"
          >
            View Assessments →
          </button>
        </div>
      )}
    </div>
  )
}
