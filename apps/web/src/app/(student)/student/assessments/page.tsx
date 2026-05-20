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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentAssessmentsPage() {
  const router = useRouter()
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      apiRef.current.get<Assessment[]>('/assessments').catch(() => []),
      apiRef.current.get<Attempt[]>('/attempts/my').catch(() => []),
    ]).then(([ass, att]) => {
      setAssessments(ass)
      setAttempts(att)
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Assessments</h1>
        <p className="text-gray-500 text-sm mt-1">Available tests from your teachers</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
          Loading assessments…
        </div>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-gray-500 font-medium">No assessments available yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Check back later — your teacher will publish tests here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map(a => {
            const attempt = attemptMap.get(a.id)
            const isSubmitted = attempt?.status === 'SUBMITTED' ||
                                attempt?.status === 'GRADED' ||
                                attempt?.status === 'AUTO_SUBMITTED'
            const isInProgress = attempt?.status === 'IN_PROGRESS'

            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">{a.course.title}</span>
                      {isSubmitted && (
                        <span className="text-xs font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                          Completed
                        </span>
                      )}
                      {isInProgress && (
                        <span className="text-xs font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                          In Progress
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-semibold text-gray-900">{a.title}</h2>
                    {a.description && (
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{a.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>⏱ {a.durationMinutes} min</span>
                      <span>❓ {a._count.questions} questions</span>
                      {a.startTime && (
                        <span>📅 Opens {new Date(a.startTime).toLocaleDateString()}</span>
                      )}
                    </div>
                    {isSubmitted && attempt?.percentageScore != null && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              attempt.percentageScore >= 70
                                ? 'bg-emerald-500'
                                : attempt.percentageScore >= 50
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${attempt.percentageScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-700">
                          {Math.round(attempt.percentageScore)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {isSubmitted ? (
                      <button
                        onClick={() => router.push(`/student/results/${attempt!.id}`)}
                        className="text-sm text-indigo-600 hover:underline font-medium"
                      >
                        View results →
                      </button>
                    ) : isInProgress ? (
                      <button
                        onClick={() => void handleStart(a.id)}
                        disabled={starting === a.id}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium
                                   px-4 py-1.5 rounded-lg transition-colors"
                      >
                        {starting === a.id ? 'Loading…' : 'Resume →'}
                      </button>
                    ) : (
                      <button
                        onClick={() => void handleStart(a.id)}
                        disabled={starting === a.id}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
                                   text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
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
