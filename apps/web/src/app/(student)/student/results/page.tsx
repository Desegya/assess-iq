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

export default function StudentResultsPage() {
  const router = useRouter()
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [attempts, setAttempts] = useState<AttemptSummary[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Results</h1>
        <p className="text-gray-500 text-sm mt-1">All your completed assessments</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
          Loading results…
        </div>
      ) : completed.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-2xl mb-2">📊</p>
          <p className="text-gray-500 font-medium">No results yet</p>
          <p className="text-gray-400 text-sm mt-1">Complete an assessment to see your scores here.</p>
          <a href="/student/assessments" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
            Go to Assessments →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {completed.map(a => {
            const pct = a.percentageScore ?? 0
            const color = pct >= 70 ? 'emerald' : pct >= 50 ? 'amber' : 'red'
            return (
              <div
                key={a.id}
                onClick={() => router.push(`/student/results/${a.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300
                           cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 mb-1">{a.assessment.course.title}</p>
                    <h2 className="text-base font-semibold text-gray-900 truncate">
                      {a.assessment.title}
                    </h2>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
                      <span>Submitted {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '—'}</span>
                      <span>{a._count.answers} answered</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full bg-${color}-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold text-${color}-600`}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                  </div>

                  <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center
                    bg-${color}-50 text-${color}-700`}>
                    <span className="text-xl font-bold">{Math.round(pct)}</span>
                    <span className="text-xs">%</span>
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
