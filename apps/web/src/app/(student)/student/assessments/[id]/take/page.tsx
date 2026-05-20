'use client'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface McqOption { key: string; text: string }

interface Question {
  id: string
  questionText: string
  questionType: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'THEORY'
  options?: McqOption[]
  difficulty: string
}

interface AssessmentQuestion {
  id: string
  order: number
  question: Question
}

interface AttemptWithAssessment {
  id: string
  status: string
  assessment: {
    id: string
    title: string
    instructions?: string
    durationMinutes: number
    totalQuestions: number
    questions: AssessmentQuestion[]
  }
  answers: {
    questionId: string
    selectedAnswer?: string
    textAnswer?: string
  }[]
}

// ─── Timer hook ───────────────────────────────────────────────────────────────

function useTimer(durationMinutes: number, onExpire: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpireRef.current()
      return
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft])

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')
  const isLow = secondsLeft < 120 // < 2 minutes

  return { display: `${mm}:${ss}`, isLow }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TakeTestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: assessmentId } = use(params)
  const searchParams = useSearchParams()
  const attemptId = searchParams.get('attemptId') ?? ''
  const router = useRouter()
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [attempt, setAttempt] = useState<AttemptWithAssessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Answers stored locally — synced to backend on change
  const [answers, setAnswers] = useState<Record<string, { selected?: string; text?: string }>>({})

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prevent duplicate submits
  const submittedRef = useRef(false)

  const handleSubmit = useCallback(async (auto = false) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)

    if (auto) {
      alert('⏰ Time is up! Your test is being submitted automatically.')
    }

    try {
      await apiRef.current.post(`/attempts/${attemptId}/submit`, {})
      router.push(`/student/results/${attemptId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
      submittedRef.current = false
      setSubmitting(false)
    }
  }, [attemptId, router])

  // Load attempt + existing answers
  useEffect(() => {
    if (!attemptId) return
    void apiRef.current
      .get<AttemptWithAssessment>(`/attempts/${attemptId}`)
      .then(data => {
        setAttempt(data)
        // Seed local answers from server
        const seed: Record<string, { selected?: string; text?: string }> = {}
        data.answers.forEach(a => {
          seed[a.questionId] = { selected: a.selectedAnswer, text: a.textAnswer }
        })
        setAnswers(seed)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [attemptId])

  const { display: timeDisplay, isLow } = useTimer(
    attempt?.assessment.durationMinutes ?? 60,
    () => void handleSubmit(true),
  )

  async function saveAnswer(questionId: string, value: { selected?: string; text?: string }) {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
    await apiRef.current
      .post(`/attempts/${attemptId}/answers`, {
        questionId,
        selectedAnswer: value.selected ?? undefined,
        textAnswer: value.text ?? undefined,
      })
      .catch(() => undefined) // best-effort save
  }

  if (!attemptId) {
    return (
      <div className="text-center py-20 text-gray-500">
        No attempt ID. <a href="/student/assessments" className="text-indigo-600 hover:underline">Go back</a>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="text-center py-20 text-gray-500">
        Attempt not found. <a href="/student/assessments" className="text-indigo-600 hover:underline">Go back</a>
      </div>
    )
  }

  const questions = attempt.assessment.questions
  const current = questions[currentIndex]
  const q = current?.question
  const answeredCount = Object.keys(answers).length
  const totalQ = questions.length

  if (!q) {
    return <div className="text-center py-20 text-gray-500">No questions found.</div>
  }

  const currentAnswer = answers[q.id] ?? {}

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900 truncate max-w-xs">
            {attempt.assessment.title}
          </span>
          <span className="text-xs text-gray-400">
            {answeredCount}/{totalQ} answered
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className={`flex items-center gap-1.5 font-mono text-sm font-semibold px-3 py-1 rounded-lg ${
            isLow ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'
          }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="1.8" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 6v6l4 2" />
            </svg>
            {timeDisplay}
          </div>

          <button
            onClick={() => void handleSubmit(false)}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400
                       text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit Test'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 flex gap-6">
        {/* Question navigator sidebar */}
        <aside className="w-44 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-3 sticky top-20">
            <p className="text-xs font-medium text-gray-500 mb-2">Questions</p>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((aq, i) => {
                const answered = !!answers[aq.question.id]
                const isCurrent = i === currentIndex
                return (
                  <button
                    key={aq.id}
                    onClick={() => setCurrentIndex(i)}
                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                      isCurrent
                        ? 'bg-indigo-600 text-white'
                        : answered
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 space-y-1 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-indigo-600" /> Current
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-100" /> Answered
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" /> Unanswered
              </div>
            </div>
          </div>
        </aside>

        {/* Main question area */}
        <div className="flex-1 min-w-0">
          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
          )}

          {/* Instructions (once) */}
          {attempt.assessment.instructions && currentIndex === 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4 text-sm text-amber-800">
              <strong className="font-medium">Instructions: </strong>
              {attempt.assessment.instructions}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {/* Question header */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-400 font-mono">
                Question {currentIndex + 1} of {totalQ}
              </span>
              <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                {q.questionType.replace('_', ' ')}
              </span>
              <span className={`text-xs font-medium ${
                q.difficulty === 'EASY' ? 'text-emerald-600' :
                q.difficulty === 'MEDIUM' ? 'text-amber-600' : 'text-red-600'
              }`}>
                {q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase()}
              </span>
            </div>

            {/* Question text */}
            <p className="text-gray-900 text-base font-medium leading-relaxed mb-6">
              {q.questionText}
            </p>

            {/* Answer input */}
            {(q.questionType === 'MCQ' || q.questionType === 'TRUE_FALSE') && q.options ? (
              <div className="space-y-2">
                {q.options.map(opt => (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                      currentAnswer.selected === opt.key
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={opt.key}
                      checked={currentAnswer.selected === opt.key}
                      onChange={() => void saveAnswer(q.id, { selected: opt.key })}
                      className="text-indigo-600"
                    />
                    <span className="text-sm font-mono text-gray-500 w-5">{opt.key}.</span>
                    <span className="text-sm text-gray-800">{opt.text}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={currentAnswer.text ?? ''}
                onChange={e => void saveAnswer(q.id, { text: e.target.value })}
                placeholder="Type your answer here…"
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            )}
          </div>

          {/* Prev / Next */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700
                         disabled:opacity-30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>

            {currentIndex < totalQ - 1 ? (
              <button
                onClick={() => setCurrentIndex(i => Math.min(totalQ - 1, i + 1))}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800
                           font-medium transition-colors"
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => void handleSubmit(false)}
                disabled={submitting}
                className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-800
                           font-medium transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Finish & Submit'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
