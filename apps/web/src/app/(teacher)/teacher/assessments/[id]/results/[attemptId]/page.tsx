'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface McqOption { key: string; text: string }

interface Question {
  id: string
  questionText: string
  questionType: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'THEORY'
  options?: McqOption[]
  correctAnswer: string
  explanation?: string
  difficulty: string
}

interface AssessmentQuestion {
  id: string
  order: number
  question: Question
}

interface Answer {
  id: string
  questionId: string
  selectedAnswer?: string
  textAnswer?: string
  isCorrect?: boolean
  score?: number
}

interface AttemptResult {
  id: string
  status: string
  score?: number
  percentageScore?: number
  submittedAt?: string
  startedAt: string
  student: { id: string; name: string; email: string }
  assessment: {
    id: string
    title: string
    totalQuestions: number
    durationMinutes: number
    course: { id: string; title: string }
    questions: AssessmentQuestion[]
  }
  answers: Answer[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
      bg-[length:200%_100%] animate-shimmer rounded-lg ${className ?? ''}`} />
  )
}

function ScoreRing({ percent }: { percent: number }) {
  const radius = 52
  const circ   = 2 * Math.PI * radius
  const dash   = (percent / 100) * circ
  const ringColor = percent >= 70 ? '#10b981' : percent >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative">
      <svg width="120" height="120" viewBox="0 0 130 130" className="animate-scale-in">
        <circle cx="65" cy="65" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        <circle
          cx="65" cy="65" r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="12"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dasharray 1.2s ease-out 0.3s' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-heading font-bold" style={{ color: ringColor }}>
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeacherAttemptDetailPage() {
  const { id, attemptId } = useParams<{ id: string; attemptId: string }>()
  const router = useRouter()
  const api    = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [attempt,    setAttempt]    = useState<AttemptResult | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [openIdx,    setOpenIdx]    = useState<number | null>(null)

  // Manual grading state: answerId → score (0 or 1)
  const [pendingGrades, setPendingGrades] = useState<Record<string, number>>({})
  const [grading,       setGrading]       = useState(false)
  const [gradeError,    setGradeError]    = useState<string | null>(null)

  useEffect(() => {
    if (!attemptId) return
    void apiRef.current
      .get<AttemptResult>(`/attempts/${attemptId}`)
      .then(setAttempt)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [attemptId])

  async function handleSaveGrades() {
    if (Object.keys(pendingGrades).length === 0) return
    setGrading(true); setGradeError(null)
    try {
      const grades = Object.entries(pendingGrades).map(([answerId, score]) => ({ answerId, score }))
      const updated = await api.patch<{ percentageScore: number; score: number; status: string }>(
        `/attempts/${attemptId}/grade`,
        { grades },
      )
      setAttempt(prev => prev
        ? { ...prev, percentageScore: updated.percentageScore, score: updated.score, status: updated.status }
        : prev
      )
      // Merge the new scores back into answers
      setAttempt(prev => {
        if (!prev) return prev
        return {
          ...prev,
          percentageScore: updated.percentageScore,
          score: updated.score,
          status: updated.status,
          answers: prev.answers.map(a =>
            pendingGrades[a.id] !== undefined
              ? { ...a, score: pendingGrades[a.id], isCorrect: (pendingGrades[a.id] ?? 0) > 0 }
              : a
          ),
        }
      })
      setPendingGrades({})
    } catch (err) {
      setGradeError(err instanceof Error ? err.message : 'Failed to save grades')
    } finally {
      setGrading(false)
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-5 w-32" />
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <div className="flex items-center gap-6">
            <Skeleton className="w-28 h-28 rounded-full" />
            <div className="flex-1 grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="font-heading font-semibold text-slate-700">Attempt not found</p>
        <button
          onClick={() => router.push(`/teacher/assessments/${id}/results`)}
          className="text-violet-600 hover:underline text-sm mt-2 inline-block font-medium"
        >
          Back to results
        </button>
      </div>
    )
  }

  const answerMap       = new Map(attempt.answers.map(a => [a.questionId, a]))
  const questions       = attempt.assessment.questions
  const autoGradedTypes = ['MCQ', 'TRUE_FALSE']
  const autoGraded      = questions.filter(aq => autoGradedTypes.includes(aq.question.questionType))
  const correctCount    = autoGraded.filter(aq => answerMap.get(aq.question.id)?.isCorrect).length
  const percent         = attempt.percentageScore ?? 0
  const timeTaken       = attempt.submittedAt
    ? Math.round(
        (new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()) / 60000,
      )
    : null

  // Open-ended questions needing grading
  const openEndedQuestions = questions.filter(aq =>
    !autoGradedTypes.includes(aq.question.questionType)
  )
  const ungradedCount = openEndedQuestions.filter(aq => {
    const ans = answerMap.get(aq.question.id)
    return ans?.textAnswer && ans.score == null
  }).length

  const hasPendingGrades = Object.keys(pendingGrades).length > 0

  return (
    <div className="max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-6 animate-slide-up">
        <button
          onClick={() => router.push(`/teacher/assessments/${id}/results`)}
          className="text-sm text-slate-500 hover:text-violet-600 font-medium transition-colors
                     flex items-center gap-1.5 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Results
        </button>

        <h1 className="font-heading text-2xl font-bold text-slate-900">Attempt Review</h1>
        <p className="text-slate-500 text-sm mt-1">
          <span className="font-semibold text-slate-700">{attempt.student.name}</span>
          {' · '}
          {attempt.assessment.title}
        </p>
      </div>

      {/* ── Score summary card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 mb-6 animate-slide-up"
           style={{ animationDelay: '75ms', animationFillMode: 'both' }}>

        {/* Student info banner */}
        <div className="flex items-center gap-3 pb-5 mb-5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center
                          text-sm font-bold text-violet-700 flex-shrink-0">
            {attempt.student.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">{attempt.student.name}</p>
            <p className="text-xs text-slate-400">{attempt.student.email}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-slate-400">Submitted</p>
            <p className="text-sm font-medium text-slate-600">
              {attempt.submittedAt
                ? new Date(attempt.submittedAt).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })
                : '—'
              }
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-8">
          <ScoreRing percent={percent} />

          <div className="flex-1 grid grid-cols-2 gap-3 w-full">
            <div className="bg-slate-50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-heading font-bold text-slate-900">{correctCount}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Correct</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-heading font-bold text-slate-900">{autoGraded.length}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Auto-graded</p>
            </div>
            {timeTaken != null && (
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <p className="text-2xl font-heading font-bold text-slate-900">{timeTaken}m</p>
                <p className="text-xs text-slate-500 mt-1 font-medium">Time taken</p>
              </div>
            )}
            <div className="bg-slate-50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-heading font-bold text-slate-900">
                {attempt.answers.length}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Answered</p>
            </div>
          </div>
        </div>

        {/* Ungraded open-ended banner */}
        {ungradedCount > 0 && (
          <div className="mt-5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
            </svg>
            <p className="text-sm text-blue-800">
              <span className="font-semibold">{ungradedCount} question{ungradedCount !== 1 ? 's' : ''}</span>
              {' '}need{ungradedCount === 1 ? 's' : ''} manual grading. Score them below and click
              {' '}<strong>Save Grades</strong>.
            </p>
          </div>
        )}
      </div>

      {/* ── Question review ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden
                      animate-slide-up" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-heading font-semibold text-slate-900">Question Review</h2>
          <span className="text-xs text-slate-400 font-medium">
            {correctCount} / {autoGraded.length} auto-graded correct
          </span>
        </div>

        <div className="divide-y divide-slate-50">
          {questions.map((aq, i) => {
            const q            = aq.question
            const ans          = answerMap.get(q.id)
            const isAutoGrad   = autoGradedTypes.includes(q.questionType)
            const isCorrect    = ans?.isCorrect
            const isUnanswered = !ans?.selectedAnswer && !ans?.textAnswer
            const isOpen       = openIdx === i
            const needsGrading = !isAutoGrad && !!ans?.textAnswer && ans.score == null

            // Current grade value for this answer (pending or saved)
            const currentGrade = ans?.id ? (pendingGrades[ans.id] ?? ans.score ?? null) : null

            return (
              <div key={aq.id}>
                <button
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  className="w-full px-6 py-4 text-left flex items-center gap-3
                             hover:bg-slate-50/60 transition-colors"
                >
                  {/* Result indicator */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isUnanswered ? 'bg-slate-100' :
                    !isAutoGrad && needsGrading ? 'bg-amber-100' :
                    !isAutoGrad && !needsGrading && currentGrade != null
                      ? (currentGrade > 0 ? 'bg-emerald-100' : 'bg-red-100')
                      : !isAutoGrad ? 'bg-blue-100' :
                    isCorrect    ? 'bg-emerald-100' : 'bg-red-100'
                  }`}>
                    {isUnanswered ? (
                      <span className="text-xs text-slate-400 font-bold leading-none">—</span>
                    ) : !isAutoGrad && needsGrading ? (
                      <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    ) : !isAutoGrad && currentGrade != null ? (
                      currentGrade > 0 ? (
                        <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )
                    ) : !isAutoGrad ? (
                      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
                      </svg>
                    ) : isCorrect ? (
                      <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-mono text-slate-400 font-semibold">Q{i + 1}</span>
                      <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                        {q.questionType.replace('_', ' ')}
                      </span>
                      {isAutoGrad && !isUnanswered && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {isCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                      )}
                      {isUnanswered && (
                        <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                          Skipped
                        </span>
                      )}
                      {!isAutoGrad && needsGrading && (
                        <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          Needs grading
                        </span>
                      )}
                      {!isAutoGrad && !needsGrading && currentGrade != null && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          currentGrade > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {currentGrade > 0 ? 'Marked correct' : 'Marked incorrect'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 font-medium line-clamp-1">{q.questionText}</p>
                  </div>

                  <svg
                    className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-6 pb-5 bg-slate-50/40 border-t border-slate-50 animate-slide-up">
                    <p className="text-sm text-slate-800 font-medium leading-relaxed pt-3 mb-3">
                      {q.questionText}
                    </p>

                    {/* MCQ options */}
                    {q.options && q.options.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        {q.options.map(opt => {
                          const isSelected   = ans?.selectedAnswer === opt.key
                          const isCorrectOpt = opt.key === q.correctAnswer
                          return (
                            <div
                              key={opt.key}
                              className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${
                                isCorrectOpt
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : isSelected && !isCorrectOpt
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'text-slate-600 bg-white border border-slate-100'
                              }`}
                            >
                              <span className="font-mono text-xs w-4 flex-shrink-0">{opt.key}.</span>
                              <span className="flex-1">{opt.text}</span>
                              {isCorrectOpt && (
                                <span className="text-xs text-emerald-600 font-semibold flex-shrink-0 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                  correct
                                </span>
                              )}
                              {isSelected && !isCorrectOpt && (
                                <span className="text-xs text-red-500 flex-shrink-0">student&apos;s answer</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Text / open-ended answers */}
                    {!q.options && (
                      <div className="space-y-2 mb-3">
                        {ans?.textAnswer ? (
                          <div className="text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3 py-2.5">
                            <span className="font-semibold">Student&apos;s answer: </span>{ans.textAnswer}
                          </div>
                        ) : (
                          <div className="text-sm bg-slate-50 border border-slate-200 text-slate-500 rounded-xl px-3 py-2.5 italic">
                            No answer provided
                          </div>
                        )}
                        <div className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2.5">
                          <span className="font-semibold">Model answer: </span>{q.correctAnswer}
                        </div>

                        {/* Manual grade controls — only when student answered */}
                        {ans?.textAnswer && ans.id && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mt-1">
                            <p className="text-xs font-semibold text-amber-800 mb-2">
                              Assign score for this answer:
                            </p>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => {
                                  const newGrade = currentGrade === 1 ? null : 1
                                  setPendingGrades(p => {
                                    const next = { ...p }
                                    if (newGrade === null) { delete next[ans.id!]; return next }
                                    next[ans.id!] = 1
                                    return next
                                  })
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                                            border-2 transition-all ${
                                  currentGrade === 1
                                    ? 'border-emerald-500 bg-emerald-100 text-emerald-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
                                }`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                Correct (1 pt)
                              </button>
                              <button
                                onClick={() => {
                                  const newGrade = currentGrade === 0 ? null : 0
                                  setPendingGrades(p => {
                                    const next = { ...p }
                                    if (newGrade === null) { delete next[ans.id!]; return next }
                                    next[ans.id!] = 0
                                    return next
                                  })
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                                            border-2 transition-all ${
                                  currentGrade === 0
                                    ? 'border-red-500 bg-red-100 text-red-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-red-300'
                                }`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Incorrect (0 pts)
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="text-xs text-slate-500 italic bg-violet-50 border border-violet-100
                                      rounded-xl px-3 py-2.5 flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-violet-500 mt-0.5 flex-shrink-0"
                             fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Save grades bar */}
        {(hasPendingGrades || ungradedCount > 0) && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-4">
            <div>
              {gradeError && (
                <p className="text-sm text-red-600">{gradeError}</p>
              )}
              {hasPendingGrades && !gradeError && (
                <p className="text-sm text-slate-600">
                  {Object.keys(pendingGrades).length} grade{Object.keys(pendingGrades).length !== 1 ? 's' : ''} pending
                </p>
              )}
            </div>
            <button
              onClick={() => void handleSaveGrades()}
              disabled={!hasPendingGrades || grading}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm
                         font-semibold px-5 py-2.5 rounded-xl transition-all active:scale-[0.98]
                         flex items-center gap-2"
            >
              {grading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Saving…
                </>
              ) : (
                'Save Grades'
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Footer actions ── */}
      <div className="mt-6 flex items-center justify-center gap-6 animate-fade-in"
           style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
        <button
          onClick={() => router.push(`/teacher/assessments/${id}/results`)}
          className="text-sm font-medium text-slate-500 hover:text-violet-600 transition-colors
                     flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All results
        </button>
        <button
          onClick={() => router.push(`/teacher/assessments/${id}`)}
          className="text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors"
        >
          Assessment builder →
        </button>
      </div>
    </div>
  )
}
