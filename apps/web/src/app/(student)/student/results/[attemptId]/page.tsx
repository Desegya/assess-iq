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
  const radius = 48
  const circ = 2 * Math.PI * radius
  const dash = (percent / 100) * circ

  const color = percent >= 70 ? '#10b981' : percent >= 50 ? '#f59e0b' : '#ef4444'
  const label = percent >= 70 ? '🎉 Great job!' : percent >= 50 ? '👍 Good effort' : '📚 Keep studying'

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={radius}
          fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="60" y="65" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>
          {Math.round(percent)}%
        </text>
      </svg>
      <p className="text-sm font-medium text-gray-600">{label}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResultsPage({
  params,
}: {
  params: Promise<{ attemptId: string }>
}) {
  const { attemptId } = use(params)
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [attempt, setAttempt] = useState<AttemptResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void apiRef.current
      .get<AttemptResult>(`/attempts/${attemptId}`)
      .then(setAttempt)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [attemptId])

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
        Results not found.{' '}
        <a href="/student/assessments" className="text-indigo-600 hover:underline">Go back</a>
      </div>
    )
  }

  const answerMap = new Map(attempt.answers.map(a => [a.questionId, a]))
  const questions = attempt.assessment.questions
  const autoGradedTypes = ['MCQ', 'TRUE_FALSE']
  const autoGraded = questions.filter(aq => autoGradedTypes.includes(aq.question.questionType))
  const correctCount = autoGraded.filter(aq => answerMap.get(aq.question.id)?.isCorrect).length
  const percent = attempt.percentageScore ?? 0
  const timeTaken = attempt.submittedAt
    ? Math.round((new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()) / 60000)
    : null

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <a href="/student/assessments" className="text-sm text-gray-500 hover:text-indigo-600">
          ← Back to Assessments
        </a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Results</h1>
        <p className="text-gray-500 text-sm mt-1">{attempt.assessment.title}</p>
      </div>

      {/* Score summary */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <ScoreRing percent={percent} />

          <div className="flex-1 grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{correctCount}</p>
              <p className="text-xs text-gray-500 mt-1">Correct answers</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{autoGraded.length}</p>
              <p className="text-xs text-gray-500 mt-1">Auto-graded questions</p>
            </div>
            {timeTaken != null && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{timeTaken}m</p>
                <p className="text-xs text-gray-500 mt-1">Time taken</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{questions.length}</p>
              <p className="text-xs text-gray-500 mt-1">Total questions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Question-by-question review */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Question Review</h2>
        </div>

        <div className="divide-y divide-gray-50">
          {questions.map((aq, i) => {
            const q = aq.question
            const ans = answerMap.get(q.id)
            const isAutoGraded = autoGradedTypes.includes(q.questionType)
            const isCorrect = ans?.isCorrect
            const isUnanswered = !ans?.selectedAnswer && !ans?.textAnswer

            return (
              <div key={aq.id} className="px-6 py-5">
                {/* Question header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-gray-400">Q{i + 1}</span>
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {q.questionType.replace('_', ' ')}
                  </span>
                  {isAutoGraded && !isUnanswered && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      isCorrect
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-600'
                    }`}>
                      {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                  )}
                  {isUnanswered && (
                    <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                      Not answered
                    </span>
                  )}
                  {!isAutoGraded && !isUnanswered && (
                    <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                      Manual grading
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-800 font-medium mb-3">{q.questionText}</p>

                {/* MCQ options */}
                {q.options && q.options.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {q.options.map(opt => {
                      const isSelected = ans?.selectedAnswer === opt.key
                      const isCorrectOpt = opt.key === q.correctAnswer
                      return (
                        <div
                          key={opt.key}
                          className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                            isCorrectOpt
                              ? 'bg-emerald-50 text-emerald-800'
                              : isSelected && !isCorrectOpt
                              ? 'bg-red-50 text-red-700'
                              : 'text-gray-600'
                          }`}
                        >
                          <span className="font-mono text-xs w-4">{opt.key}.</span>
                          <span>{opt.text}</span>
                          {isCorrectOpt && (
                            <span className="ml-auto text-xs text-emerald-600 font-medium">✓ correct</span>
                          )}
                          {isSelected && !isCorrectOpt && (
                            <span className="ml-auto text-xs text-red-500">your answer</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Short answer / theory */}
                {!q.options && (
                  <div className="space-y-2 mb-3">
                    {ans?.textAnswer && (
                      <div className="text-sm bg-blue-50 text-blue-800 rounded-lg px-3 py-2">
                        <span className="font-medium">Your answer: </span>{ans.textAnswer}
                      </div>
                    )}
                    <div className="text-sm bg-emerald-50 text-emerald-800 rounded-lg px-3 py-2">
                      <span className="font-medium">Model answer: </span>{q.correctAnswer}
                    </div>
                  </div>
                )}

                {/* Explanation */}
                {q.explanation && (
                  <p className="text-xs text-gray-500 italic bg-gray-50 rounded-lg px-3 py-2">
                    💡 {q.explanation}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <a
          href="/student/assessments"
          className="text-sm text-gray-500 hover:text-indigo-600 transition-colors"
        >
          ← Back to Assessments
        </a>
      </div>
    </div>
  )
}
