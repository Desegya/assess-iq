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
    DRAFT:     'bg-slate-100 text-slate-600',
    PUBLISHED: 'bg-violet-100 text-violet-700',
    ACTIVE:    'bg-emerald-100 text-emerald-700',
    CLOSED:    'bg-amber-100 text-amber-700',
    ARCHIVED:  'bg-red-100 text-red-600',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
      bg-[length:200%_100%] animate-shimmer rounded-lg ${className ?? ''}`} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }  = use(params)
  const router  = useRouter()
  const api     = useApi()
  const apiRef  = useRef(api)
  apiRef.current = api

  const [assessment,   setAssessment]   = useState<Assessment | null>(null)
  const [loading,      setLoading]      = useState(true)

  const [bankQuestions, setBankQuestions] = useState<Question[]>([])
  const [bankLoading,   setBankLoading]   = useState(false)
  const [showBank,      setShowBank]      = useState(false)
  const [selected,      setSelected]      = useState<Set<string>>(new Set())
  const [adding,        setAdding]        = useState(false)

  const [publishing,   setPublishing]   = useState(false)
  const [actionError,  setActionError]  = useState<string | null>(null)

  useEffect(() => {
    void apiRef.current
      .get<Assessment>(`/assessments/${id}`)
      .then(setAssessment)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [id])

  async function openBank() {
    setShowBank(true); setBankLoading(true)
    try {
      const qs = await api.get<Question[]>('/questions?status=APPROVED')
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
      setAssessment(updated); setSelected(new Set()); setShowBank(false)
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
    setPublishing(true); setActionError(null)
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
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-4 w-6" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="font-heading font-semibold text-slate-700">Assessment not found</p>
        <a href="/teacher/assessments"
           className="text-violet-600 hover:underline text-sm mt-2 inline-block font-medium">
          ← Back to Assessments
        </a>
      </div>
    )
  }

  const isDraft = assessment.status === 'DRAFT'

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-8">
        <a href="/teacher/assessments"
           className="text-sm text-slate-500 hover:text-violet-600 font-medium transition-colors
                      flex items-center gap-1 w-fit mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Assessments
        </a>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={assessment.status} />
              <span className="text-xs text-slate-400 font-medium">{assessment.course.title}</span>
            </div>
            <h1 className="font-heading text-2xl font-bold text-slate-900">{assessment.title}</h1>
            {assessment.description && (
              <p className="text-slate-500 text-sm mt-1">{assessment.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="1.8"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 6v6l4 2"/>
                </svg>
                {assessment.durationMinutes} min
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
                </svg>
                {assessment.totalQuestions} questions
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                </svg>
                {assessment._count.attempts} attempts
              </span>
            </div>
          </div>

          {isDraft && (
            <button
              onClick={() => void handlePublish()}
              disabled={publishing || assessment.totalQuestions === 0}
              title={assessment.totalQuestions === 0 ? 'Add at least one question first' : ''}
              className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]
                         disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5
                         rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              {publishing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Publishing…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 8a3 3 0 11-6 0 3 3 0 016 0zm6 8a2 2 0 01-2 2H5a2 2 0 01-2-2v-1a7 7 0 0114 0v1z" />
                  </svg>
                  Publish
                </>
              )}
            </button>
          )}
        </div>

        {actionError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5
                        border border-red-100">
            {actionError}
          </p>
        )}
      </div>

      {/* ── Instructions ── */}
      {assessment.instructions && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6
                        text-sm text-amber-800">
          <p className="font-semibold mb-1">Instructions</p>
          {assessment.instructions}
        </div>
      )}

      {/* ── Questions list ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-heading font-semibold text-slate-800">
            Questions ({assessment.questions.length})
          </h2>
          {isDraft && (
            <button
              onClick={() => void openBank()}
              className="text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors"
            >
              + Add from Question Bank
            </button>
          )}
        </div>

        {assessment.questions.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">No questions yet</p>
            {isDraft && (
              <button
                onClick={() => void openBank()}
                className="mt-3 text-sm font-semibold text-violet-600 hover:underline"
              >
                Add questions from the bank →
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {assessment.questions.map((aq, i) => (
              <div key={aq.id}
                   className="px-6 py-4 flex items-start gap-3 hover:bg-slate-50/60 transition-colors group">
                <span className="text-xs font-mono text-slate-400 pt-0.5 w-6 flex-shrink-0 font-semibold">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold bg-violet-100 text-violet-700
                                     px-2 py-0.5 rounded-lg">
                      {aq.question.questionType.replace('_', ' ')}
                    </span>
                    <span className={`text-xs font-semibold ${
                      aq.question.difficulty === 'EASY'   ? 'text-emerald-600' :
                      aq.question.difficulty === 'MEDIUM' ? 'text-amber-600'   : 'text-red-600'
                    }`}>
                      {aq.question.difficulty.charAt(0) + aq.question.difficulty.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 leading-relaxed">{aq.question.questionText}</p>
                  {aq.question.options && (
                    <div className="mt-2 space-y-0.5">
                      {aq.question.options.map((opt: McqOption) => (
                        <div
                          key={opt.key}
                          className={`text-xs px-2 py-1 rounded-lg ${
                            opt.key === aq.question.correctAnswer
                              ? 'text-emerald-700 font-semibold bg-emerald-50'
                              : 'text-slate-500'
                          }`}
                        >
                          {opt.key}. {opt.text}
                          {opt.key === aq.question.correctAnswer && (
                            <svg className="ml-2 inline w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {isDraft && (
                  <button
                    onClick={() => void handleRemoveQuestion(aq.question.id)}
                    className="flex-shrink-0 w-6 h-6 rounded-lg hover:bg-red-100 hover:text-red-600
                               text-slate-300 flex items-center justify-center transition-all
                               opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Results link ── */}
      {!isDraft && assessment._count.attempts > 0 && (
        <div className="mt-5 text-center">
          <button
            onClick={() => router.push(`/teacher/assessments/${id}/results`)}
            className="text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors"
          >
            View student results ({assessment._count.attempts} attempts) →
          </button>
        </div>
      )}

      {/* ── Question Bank Slide-over ── */}
      {showBank && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex z-50 animate-fade-in">
          <div className="ml-auto w-full max-w-xl bg-white h-full flex flex-col shadow-modal
                          translate-x-0 transition-transform">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h3 className="font-heading font-bold text-slate-900">Question Bank</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select approved questions to add
                </p>
              </div>
              <button
                onClick={() => { setShowBank(false); setSelected(new Set()) }}
                className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center
                           text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {bankLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3 p-3">
                      <Skeleton className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : bankQuestions.length === 0 ? (
                <div className="text-center py-14">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-600">No approved questions found</p>
                  <a href="/teacher/questions/generate"
                     className="text-sm text-violet-600 hover:underline mt-2 inline-block font-medium">
                    Generate questions with AI →
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 mb-3 font-medium">
                    {bankQuestions.length} questions available · {selected.size} selected
                  </p>
                  {bankQuestions.map(q => (
                    <label
                      key={q.id}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer
                                  transition-all duration-150 ${
                        selected.has(q.id)
                          ? 'border-violet-400 bg-violet-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(q.id)}
                        onChange={() => toggleSelect(q.id)}
                        className="mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold bg-slate-100 text-slate-600
                                           px-2 py-0.5 rounded-lg">
                            {q.questionType.replace('_', ' ')}
                          </span>
                          <span className={`text-xs font-semibold ${
                            q.difficulty === 'EASY'   ? 'text-emerald-600' :
                            q.difficulty === 'MEDIUM' ? 'text-amber-600'   : 'text-red-600'
                          }`}>
                            {q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800 line-clamp-2 leading-relaxed">
                          {q.questionText}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/60">
              <button
                onClick={() => void handleAddQuestions()}
                disabled={selected.size === 0 || adding}
                className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.98]
                           disabled:opacity-60 text-white font-semibold py-3 rounded-xl
                           text-sm transition-all"
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
