'use client'

import { useState, useEffect, useRef, use } from 'react'
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

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ percent }: { percent: number }) {
  const radius = 52
  const circ   = 2 * Math.PI * radius
  const dash   = (percent / 100) * circ

  const isPass = percent >= 70
  const isFair = percent >= 50

  const ringColor = isPass ? '#10b981' : isFair ? '#f59e0b' : '#ef4444'
  const bgColor   = isPass ? '#f0fdf4' : isFair ? '#fffbeb' : '#fef2f2'
  const textColor = isPass ? '#065f46' : isFair ? '#92400e' : '#991b1b'
  const badge     = isPass ? 'Excellent!' : isFair ? 'Good effort' : 'Keep studying'

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="130" height="130" viewBox="0 0 130 130" className="animate-scale-in">
          {/* Background ring */}
          <circle cx="65" cy="65" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="12" />
          {/* Score ring */}
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
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-heading font-bold" style={{ color: ringColor }}>
            {Math.round(percent)}%
          </span>
        </div>
      </div>

      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold`}
           style={{ background: bgColor, color: textColor }}>
        {isPass ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : isFair ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017a2 2 0 01-1.789-1.106L5 13.5M14 10V5a2 2 0 00-2-2h0a2 2 0 00-2 2v5m4 0H9" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13" />
          </svg>
        )}
        {badge}
      </div>
    </div>
  )
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
      bg-[length:200%_100%] animate-shimmer rounded-lg ${className ?? ''}`} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResultsPage({
  params,
}: {
  params: Promise<{ attemptId: string }>
}) {
  const { attemptId } = use(params)
  const api    = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [attempt, setAttempt] = useState<AttemptResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  useEffect(() => {
    void apiRef.current
      .get<AttemptResult>(`/attempts/${attemptId}`)
      .then(setAttempt)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [attemptId])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-5 w-32" />
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <Skeleton className="w-32 h-32 rounded-full" />
            <div className="flex-1 grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
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
        <p className="font-heading font-semibold text-slate-700">Results not found</p>
        <a href="/student/assessments"
           className="text-violet-600 hover:underline text-sm mt-2 inline-block font-medium">
          Go back
        </a>
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
    ? Math.round((new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()) / 60000)
    : null

  const isPass = percent >= 70

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-6 animate-slide-up">
        <a href="/student/assessments"
           className="text-sm text-slate-500 hover:text-violet-600 font-medium transition-colors
                      flex items-center gap-1 w-fit mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Assessments
        </a>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Your Results</h1>
        <p className="text-slate-500 text-sm mt-1">{attempt.assessment.title}</p>
      </div>

      {/* ── Score summary ── */}
      <div className={`bg-white rounded-2xl border shadow-card p-8 mb-6 animate-slide-up
                       ${isPass ? 'border-emerald-200' : 'border-slate-200'}`}
           style={{ animationDelay: '75ms', animationFillMode: 'both' }}>
        {/* Confetti-like decorative dots for passing scores */}
        {isPass && (
          <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none" aria-hidden="true">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full opacity-30 animate-fade-in"
                style={{
                  background: ['#7c3aed','#10b981','#f59e0b','#3b82f6'][i % 4],
                  left: `${10 + i * 12}%`,
                  top: `${5 + (i % 3) * 15}%`,
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-8">
          <ScoreRing percent={percent} />

          <div className="flex-1 grid grid-cols-2 gap-3 w-full">
            <div className="bg-slate-50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-heading font-bold text-slate-900">{correctCount}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Correct answers</p>
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
              <p className="text-2xl font-heading font-bold text-slate-900">{questions.length}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Total questions</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Question review ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden
                      animate-slide-up" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-heading font-semibold text-slate-900">Question Review</h2>
          <span className="text-xs text-slate-400 font-medium">
            {correctCount} / {autoGraded.length} correct
          </span>
        </div>

        <div className="divide-y divide-slate-50">
          {questions.map((aq, i) => {
            const q          = aq.question
            const ans        = answerMap.get(q.id)
            const isAutoGrad = autoGradedTypes.includes(q.questionType)
            const isCorrect  = ans?.isCorrect
            const isUnanswered = !ans?.selectedAnswer && !ans?.textAnswer
            const isOpen     = openIdx === i

            return (
              <div key={aq.id}>
                {/* Question header — always visible */}
                <button
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  className="w-full px-6 py-4 text-left flex items-center gap-3
                             hover:bg-slate-50/60 transition-colors"
                >
                  {/* Result indicator */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center
                                  flex-shrink-0 ${
                    isUnanswered ? 'bg-slate-100' :
                    !isAutoGrad  ? 'bg-blue-100'  :
                    isCorrect    ? 'bg-emerald-100' : 'bg-red-100'
                  }`}>
                    {isUnanswered ? (
                      <span className="text-xs text-slate-400 font-bold">—</span>
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
                    <div className="flex items-center gap-2 mb-0.5">
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
                    </div>
                    <p className="text-sm text-slate-700 font-medium line-clamp-1">{q.questionText}</p>
                  </div>

                  <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                       fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                <span className="text-xs text-emerald-600 font-semibold flex-shrink-0">correct</span>
                              )}
                              {isSelected && !isCorrectOpt && (
                                <span className="text-xs text-red-500 flex-shrink-0">your answer</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Text answers */}
                    {!q.options && (
                      <div className="space-y-2 mb-3">
                        {ans?.textAnswer && (
                          <div className="text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3 py-2.5">
                            <span className="font-semibold">Your answer: </span>{ans.textAnswer}
                          </div>
                        )}
                        <div className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2.5">
                          <span className="font-semibold">Model answer: </span>{q.correctAnswer}
                        </div>
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="text-xs text-slate-500 italic bg-violet-50 border border-violet-100
                                      rounded-xl px-3 py-2.5 flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-violet-500 mt-0.5 flex-shrink-0" fill="none"
                             stroke="currentColor" viewBox="0 0 24 24">
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
      </div>

      {/* ── Actions ── */}
      <div className="mt-6 flex items-center justify-center gap-6 animate-fade-in"
           style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
        <a href="/student/assessments"
           className="text-sm font-medium text-slate-500 hover:text-violet-600 transition-colors">
          ← Back to Assessments
        </a>
        <a href="/student/results"
           className="text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors">
          All results →
        </a>
      </div>
    </div>
  )
}
