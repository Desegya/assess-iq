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

export default function StudentDashboard() {
  const { user } = useAuth()
  const router = useRouter()
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [attempts, setAttempts] = useState<AttemptSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiRef.current.get<Assessment[]>('/assessments').catch(() => []),
      apiRef.current.get<AttemptSummary[]>('/attempts/my').catch(() => []),
    ]).then(([ass, att]) => {
      setAssessments(ass)
      setAttempts(att)
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Hello, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here&apos;s what&apos;s on your plate today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-2xl font-bold text-indigo-600">{assessments.length}</p>
          <p className="text-sm text-gray-500 mt-1">Available Tests</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-2xl font-bold text-emerald-600">{completed.length}</p>
          <p className="text-sm text-gray-500 mt-1">Completed</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-2xl font-bold text-amber-600">
            {avgScore != null ? `${Math.round(avgScore)}%` : '—'}
          </p>
          <p className="text-sm text-gray-500 mt-1">Avg. Score</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pending tests */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Upcoming Tests</h2>
            <a href="/student/assessments" className="text-xs text-indigo-600 hover:underline">
              View all →
            </a>
          </div>
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No pending tests 🎉</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {pending.slice(0, 4).map(a => {
                const att = attemptMap.get(a.id)
                const isInProgress = att?.status === 'IN_PROGRESS'
                return (
                  <div key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{a.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {a.course.title} · {a._count.questions} questions · {a.durationMinutes}m
                      </p>
                    </div>
                    <button
                      onClick={() => router.push('/student/assessments')}
                      className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        isInProgress
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
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

        {/* Recent results */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Recent Results</h2>
            <a href="/student/results" className="text-xs text-indigo-600 hover:underline">
              View all →
            </a>
          </div>
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
          ) : completed.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No results yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {completed.slice(0, 4).map(a => {
                const pct = a.percentageScore ?? 0
                const color = pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'
                return (
                  <div
                    key={a.id}
                    onClick={() => router.push(`/student/results/${a.id}`)}
                    className="px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{a.assessment.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.assessment.course.title}</p>
                    </div>
                    <span className={`flex-shrink-0 text-sm font-bold ${color}`}>
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
