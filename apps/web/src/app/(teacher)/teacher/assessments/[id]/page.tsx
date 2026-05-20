'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface McqOption { key: string; text: string }

interface Question {
  id: string
  questionText: string
  questionType: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'THEORY'
  options?: McqOption[]
  correctAnswer: string
  difficulty: string
  status: string
}

interface AssessmentQuestion {
  id: string
  order: number
  scoreWeight: number
  question: Question
}

interface Assessment {
  id: string
  title: string
  description?: string
  instructions?: string
  durationMinutes: number
  status: 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
  totalQuestions: number
  course: { id: string; title: string }
  createdBy: { id: string; name: string }
  questions: AssessmentQuestion[]
  _count: { attempts: number }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Assessment['status'] }) {
  const cfg: Record<Assessment['status'], string> = {
    DRAFT:     'bg-gray-100 text-gray-600',
    PUBLISHED: 'bg-indigo-50 text-indigo-700',
    ACTIVE:    'bg-emerald-50 text-emerald-700',
    CLOSED:    'bg-amber-50 text-amber-700',
    ARCHIVED:  'bg-red-50 text-red-600',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [loading, setLoading] = useState(true)

  // Add-questions panel
  const [bankQuestions, setBankQuestions] = useState<Question[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const [showBank, setShowBank] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)

  // Action states
  const [publishing, setPublishing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    void apiRef.current
      .get<Assessment>(`/assessments/${id}`)
      .then(setAssessment)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [id])

  async function openBank() {
    setShowBank(true)
    setBankLoading(true)
    try {
      const qs = await api.get<Question[]>('/questions?status=APPROVED')
      // Filter out already-added questions
      const addedIds = new Set(assessment?.questions.map(aq => aq.question.id) ?? [])
      setBankQuestions(qs.filter(q => !addedIds.has(q.id)))
    } catch {
      setBankQuestions([])
    } finally {
      setBankLoading(false)
    }
  }

  function toggleSelect(qId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(qId) ? next.delete(qId) : next.add(qId)
      return next
    })
  }

  async function handleAddQuestions() {
    if (selected.size === 0) return
    setAdding(true)
    try {
      const updated = await api.post<Assessment>(`/assessments/${id}/questions`, {
        questionIds: [...selected],
      })
      setAssessment(updated)
      setSelected(new Set())
      setShowBank(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add questions')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemoveQuestion(questionId: string) {
    try {
      const updated = await api.del<Assessment>(`/assessments/${id}/questions/${questionId}`)
      setAssessment(updated as Assessment)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove question')
    }
  }

  async function handlePublish() {
    setPublishing(true)
    setActionError(null)
    try {
      await api.patch(`/assessments/${id}/publish`, {})
      setAssessment(prev => prev ? { ...prev, status: 'PUBLISHED' } : prev)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-gray-500">Assessment not found.</p>
        <a href="/teacher/assessments" className="text-indigo-600 hover:underline text-sm mt-2 inline-block">
          ← Back to Assessments
        </a>
      </div>
    )
  }

  const isDraft = assessment.status === 'DRAFT'

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <a href="/teacher/assessments" className="text-sm text-gray-500 hover:text-indigo-600">
          ← Back to Assessments
        </a>

        <div className="flex items-start justify-between gap-4 mt-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={assessment.status} />
              <span className="text-xs text-gray-400">{assessment.course.title}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{assessment.title}</h1>
            {assessment.description && (
              <p className="text-gray-500 text-sm mt-1">{assessment.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
              <span>⏱ {assessment.durationMinutes} min</span>
              <span>❓ {assessment.totalQuestions} questions</span>
              <span>📝 {assessment._count.attempts} attempts</span>
            </div>
          </div>

          {isDraft && (
            <button
              onClick={() => void handlePublish()}
              disabled={publishing || assessment.totalQuestions === 0}
              title={assessment.totalQuestions === 0 ? 'Add at least one question first' : ''}
              className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300
                         text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {publishing ? 'Publishing…' : '🚀 Publish'}
            </button>
          )}
        </div>

        {actionError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{actionError}</p>
        )}
      </div>

      {/* Instructions */}
      {assessment.instructions && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6 text-sm text-amber-800">
          <strong className="font-medium">Instructions: </strong>{assessment.instructions}
        </div>
      )}

      {/* Questions */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">
            Questions ({assessment.questions.length})
          </h2>
          {isDraft && (
            <button
              onClick={() => void openBank()}
              className="text-sm text-indigo-600 hover:underline font-medium"
            >
              + Add from Question Bank
            </button>
          )}
        </div>

        {assessment.questions.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">No questions yet.</p>
            {isDraft && (
              <button
                onClick={() => void openBank()}
                className="mt-3 text-sm text-indigo-600 hover:underline"
              >
                Add questions from the bank →
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {assessment.questions.map((aq, i) => (
              <div key={aq.id} className="px-5 py-4 flex items-start gap-3">
                <span className="text-xs font-mono text-gray-400 pt-0.5 w-5 flex-shrink-0">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                      {aq.question.questionType.replace('_', ' ')}
                    </span>
                    <span className={`text-xs font-medium ${
                      aq.question.difficulty === 'EASY' ? 'text-emerald-600' :
                      aq.question.difficulty === 'MEDIUM' ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {aq.question.difficulty.charAt(0) + aq.question.difficulty.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800">{aq.question.questionText}</p>
                  {aq.question.options && (
                    <div className="mt-1 space-y-0.5">
                      {aq.question.options.map((opt: McqOption) => (
                        <div
                          key={opt.key}
                          className={`text-xs px-2 py-0.5 rounded ${
                            opt.key === aq.question.correctAnswer
                              ? 'text-emerald-700 font-medium'
                              : 'text-gray-500'
                          }`}
                        >
                          {opt.key}. {opt.text}
                          {opt.key === aq.question.correctAnswer && ' ✓'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {isDraft && (
                  <button
                    onClick={() => void handleRemoveQuestion(aq.question.id)}
                    className="text-xs text-red-400 hover:text-red-600 flex-shrink-0"
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Results summary if published */}
      {!isDraft && assessment._count.attempts > 0 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => router.push(`/teacher/assessments/${id}/results`)}
            className="text-sm text-indigo-600 hover:underline"
          >
            View student results ({assessment._count.attempts} attempts) →
          </button>
        </div>
      )}

      {/* Question Bank Slide-over */}
      {showBank && (
        <div className="fixed inset-0 bg-black/40 flex z-50">
          <div className="ml-auto w-full max-w-xl bg-white h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Question Bank</h3>
              <button
                onClick={() => { setShowBank(false); setSelected(new Set()) }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {bankLoading ? (
                <p className="text-sm text-gray-400 text-center py-10">Loading questions…</p>
              ) : bankQuestions.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-500">No approved questions found.</p>
                  <a
                    href="/teacher/questions/generate"
                    className="text-sm text-indigo-600 hover:underline mt-2 inline-block"
                  >
                    Generate questions with AI →
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 mb-3">
                    {bankQuestions.length} approved questions available · {selected.size} selected
                  </p>
                  {bankQuestions.map(q => (
                    <label
                      key={q.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selected.has(q.id)
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(q.id)}
                        onChange={() => toggleSelect(q.id)}
                        className="mt-0.5 rounded border-gray-300 text-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {q.questionType.replace('_', ' ')}
                          </span>
                          <span className={`text-xs ${
                            q.difficulty === 'EASY' ? 'text-emerald-600' :
                            q.difficulty === 'MEDIUM' ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 line-clamp-2">{q.questionText}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => void handleAddQuestions()}
                disabled={selected.size === 0 || adding}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
                           text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                {adding
                  ? 'Adding…'
                  : selected.size === 0
                  ? 'Select questions to add'
                  : `Add ${selected.size} question${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
