'use client'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'
import { Logo } from '@/components/ui/Logo'

// ─── Proctoring lockdown ──────────────────────────────────────────────────────

const MAX_VIOLATIONS = 3

function useProctoringLock({ onMaxViolations }: { onMaxViolations: () => void }) {
  const [violations, setViolations] = useState(0)
  const [warning, setWarning] = useState<{ reason: string; count: number } | null>(null)
  const onMaxRef         = useRef(onMaxViolations)
  onMaxRef.current       = onMaxViolations
  const lastViolationRef = useRef(0)

  const addViolation = useCallback((reason: string) => {
    const now = Date.now()
    if (now - lastViolationRef.current < 600) return   // debounce blur+visibility
    lastViolationRef.current = now

    setViolations(prev => {
      const next = prev + 1
      if (next >= MAX_VIOLATIONS) {
        onMaxRef.current()
      } else {
        setWarning({ reason, count: next })
      }
      return next
    })
  }, [])

  // Tab switch detection
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') addViolation('You switched away from this tab')
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [addViolation])

  // Window blur (alt-tab to another app)
  useEffect(() => {
    function onBlur() { addViolation('Application focus was lost') }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [addViolation])

  // Copy / cut / paste / right-click blocking
  useEffect(() => {
    function block(e: Event) { e.preventDefault() }
    const blocked = ['copy', 'cut', 'paste', 'contextmenu'] as const
    blocked.forEach(evt => document.addEventListener(evt, block))
    return ()  => blocked.forEach(evt => document.removeEventListener(evt, block))
  }, [])

  // DevTools keyboard shortcut blocking
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'F12') { e.preventDefault(); return }
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.shiftKey && ['i', 'j', 'c', 'k'].includes(e.key.toLowerCase())) {
        e.preventDefault(); return
      }
      if (mod && e.key.toLowerCase() === 'u') e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Fullscreen enforcement
  useEffect(() => {
    if (document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => undefined)
    }
    function onFullscreenChange() {
      if (!document.fullscreenElement) addViolation('Fullscreen mode was exited')
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      void document.exitFullscreen().catch(() => undefined)
    }
  }, [addViolation])

  const reEnterFullscreen = useCallback(() => {
    void document.documentElement.requestFullscreen?.().catch(() => undefined)
    setWarning(null)
  }, [])

  return { violations, warning, dismissWarning: () => setWarning(null), reEnterFullscreen }
}

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

  const mm     = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss     = String(secondsLeft % 60).padStart(2, '0')
  const isLow  = secondsLeft < 120
  const pct    = durationMinutes > 0 ? (secondsLeft / (durationMinutes * 60)) * 100 : 0

  return { display: `${mm}:${ss}`, isLow, pct }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TakeTestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: assessmentId } = use(params)
  const searchParams = useSearchParams()
  const attemptId    = searchParams.get('attemptId') ?? ''
  const router       = useRouter()
  const api          = useApi()
  const apiRef       = useRef(api)
  apiRef.current = api

  const [attempt,      setAttempt]      = useState<AttemptWithAssessment | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers,      setAnswers]      = useState<Record<string, { selected?: string; text?: string }>>({})
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const submittedRef = useRef(false)

  const handleSubmit = useCallback(async (auto = false, reason?: string) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)

    if (auto) {
      alert(reason ?? 'Time is up! Your test is being submitted automatically.')
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

  useEffect(() => {
    if (!attemptId) return
    void apiRef.current
      .get<AttemptWithAssessment>(`/attempts/${attemptId}`)
      .then(data => {
        setAttempt(data)
        const seed: Record<string, { selected?: string; text?: string }> = {}
        data.answers.forEach(a => {
          seed[a.questionId] = { selected: a.selectedAnswer, text: a.textAnswer }
        })
        setAnswers(seed)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [attemptId])

  const { display: timeDisplay, isLow, pct: timePct } = useTimer(
    attempt?.assessment.durationMinutes ?? 60,
    () => void handleSubmit(true),
  )

  const { violations, warning, dismissWarning, reEnterFullscreen } = useProctoringLock({
    onMaxViolations: useCallback(
      () => void handleSubmit(true, 'Test automatically submitted due to repeated security violations.'),
      [handleSubmit],
    ),
  })

  async function saveAnswer(questionId: string, value: { selected?: string; text?: string }) {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
    await apiRef.current
      .post(`/attempts/${attemptId}/answers`, {
        questionId,
        selectedAnswer: value.selected ?? undefined,
        textAnswer: value.text ?? undefined,
      })
      .catch(() => undefined)
  }

  if (!attemptId) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 font-medium">No attempt ID.</p>
          <a href="/student/assessments" className="text-violet-600 hover:underline text-sm mt-2 inline-block">
            Go back
          </a>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
          <div className="absolute inset-0 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 font-medium">Attempt not found.</p>
          <a href="/student/assessments" className="text-violet-600 hover:underline text-sm mt-2 inline-block">
            Go back
          </a>
        </div>
      </div>
    )
  }

  const questions     = attempt.assessment.questions
  const current       = questions[currentIndex]
  const q             = current?.question
  const answeredCount = Object.keys(answers).length
  const totalQ        = questions.length

  if (!q) {
    return <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center text-slate-500">No questions found.</div>
  }

  const currentAnswer = answers[q.id] ?? {}

  return (
    <div className="min-h-screen bg-[#F7F8FC] flex flex-col">
      {/* ── Top progress bar ── */}
      <div className="h-1 bg-slate-200 sticky top-0 z-20">
        <div
          className="h-full bg-violet-600 transition-all duration-500"
          style={{ width: `${(answeredCount / totalQ) * 100}%` }}
        />
      </div>

      {/* ── Header bar ── */}
      <header
        className="sticky top-1 z-10 px-6 py-3 flex items-center justify-between shadow-lg"
        style={{ background: '#1E1145' }}
      >
        <div className="flex items-center gap-4">
          <Logo size="sm" theme="white" iconOnly />
          <div className="hidden sm:block">
            <p className="text-white font-heading font-semibold text-sm truncate max-w-xs">
              {attempt.assessment.title}
            </p>
            <p className="text-white/50 text-xs">
              {answeredCount} of {totalQ} answered
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Violation badge */}
          {violations > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-500/20 text-red-400 text-xs font-bold">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {violations}/{MAX_VIOLATIONS}
            </div>
          )}
          {violations === 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 text-white/50 text-xs font-semibold">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Secure
            </div>
          )}

          {/* Timer */}
          <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-mono text-sm
                          font-bold transition-all ${
            isLow
              ? 'bg-red-500/20 text-red-400 animate-pulse'
              : 'bg-white/10 text-white'
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
            className="bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] disabled:opacity-60
                       text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
          >
            {submitting ? 'Submitting…' : 'Submit Test'}
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 flex gap-6">
        {/* ── Question navigator ── */}
        <aside className="w-44 flex-shrink-0 hidden sm:block">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 sticky top-20">
            <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">
              Questions
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((aq, i) => {
                const answered  = !!answers[aq.question.id]
                const isCurrent = i === currentIndex
                return (
                  <button
                    key={aq.id}
                    onClick={() => setCurrentIndex(i)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all duration-150 ${
                      isCurrent
                        ? 'bg-violet-600 text-white shadow-glow scale-110'
                        : answered
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-violet-600" />
                <span>Current</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-slate-100 border border-slate-200" />
                <span>Unanswered</span>
              </div>
            </div>

            {/* Mini timer ring */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="relative w-12 h-12 mx-auto">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                  <circle cx="24" cy="24" r="20" fill="none"
                          stroke={isLow ? '#ef4444' : '#7c3aed'}
                          strokeWidth="4"
                          strokeDasharray={`${2 * Math.PI * 20}`}
                          strokeDashoffset={`${2 * Math.PI * 20 * (1 - timePct / 100)}`}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 1s linear' }} />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center
                                  text-[9px] font-bold font-mono ${isLow ? 'text-red-500' : 'text-violet-600'}`}>
                  {timeDisplay}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main question area ── */}
        <div className="flex-1 min-w-0">
          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3
                            border border-red-100 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Instructions */}
          {attempt.assessment.instructions && currentIndex === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">Instructions</p>
              {attempt.assessment.instructions}
            </div>
          )}

          {/* Question card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 md:p-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xs text-slate-400 font-mono font-semibold">
                {currentIndex + 1} / {totalQ}
              </span>
              <span className="text-xs font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-lg">
                {q.questionType.replace('_', ' ')}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
                q.difficulty === 'EASY'   ? 'text-emerald-600 bg-emerald-50' :
                q.difficulty === 'MEDIUM' ? 'text-amber-600 bg-amber-50'    : 'text-red-600 bg-red-50'
              }`}>
                {q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase()}
              </span>
            </div>

            {/* Question text */}
            <p className="text-slate-900 text-lg font-semibold leading-relaxed mb-7">
              {q.questionText}
            </p>

            {/* Answer options */}
            {(q.questionType === 'MCQ' || q.questionType === 'TRUE_FALSE') && q.options ? (
              <div className="space-y-2.5">
                {q.options.map(opt => {
                  const isSelected = currentAnswer.selected === opt.key
                  return (
                    <label
                      key={opt.key}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer
                                  transition-all duration-150 ${
                        isSelected
                          ? 'border-violet-500 bg-violet-50 shadow-glow'
                          : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                                      flex-shrink-0 transition-all ${
                        isSelected
                          ? 'border-violet-500 bg-violet-500'
                          : 'border-slate-300'
                      }`}>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="text-sm font-mono text-slate-500 w-5 flex-shrink-0">{opt.key}.</span>
                      <span className={`text-sm flex-1 ${isSelected ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                        {opt.text}
                      </span>
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={opt.key}
                        checked={isSelected}
                        onChange={() => void saveAnswer(q.id, { selected: opt.key })}
                        className="sr-only"
                      />
                    </label>
                  )
                })}
              </div>
            ) : (
              <textarea
                value={currentAnswer.text ?? ''}
                onChange={e => void saveAnswer(q.id, { text: e.target.value })}
                placeholder="Type your answer here…"
                rows={6}
                className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-2xl text-sm
                           text-slate-900 placeholder:text-slate-400 focus:outline-none
                           focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500
                           transition-all resize-none leading-relaxed"
              />
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-5">
            <button
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 text-sm font-medium text-slate-500
                         hover:text-slate-800 disabled:opacity-30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>

            <span className="text-xs text-slate-400 font-medium">
              Use keyboard ← → to navigate
            </span>

            {currentIndex < totalQ - 1 ? (
              <button
                onClick={() => setCurrentIndex(i => Math.min(totalQ - 1, i + 1))}
                className="flex items-center gap-2 text-sm font-semibold text-violet-600
                           hover:text-violet-800 transition-colors"
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
                className="flex items-center gap-2 text-sm font-semibold text-emerald-600
                           hover:text-emerald-800 transition-colors disabled:opacity-50"
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

      {/* ── Violation warning overlay ── */}
      {warning && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Red top bar */}
            <div className="h-1.5 bg-red-500" />

            <div className="p-6">
              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>

              <h2 className="text-slate-900 font-bold text-lg mb-1">
                Security violation — warning {warning.count} of {MAX_VIOLATIONS - 1}
              </h2>
              <p className="text-slate-500 text-sm mb-1">{warning.reason}.</p>
              <p className="text-slate-500 text-sm mb-5">
                {warning.count === MAX_VIOLATIONS - 1
                  ? 'This is your final warning. One more violation will auto-submit your test.'
                  : `${MAX_VIOLATIONS - 1 - warning.count} warning${MAX_VIOLATIONS - 1 - warning.count === 1 ? '' : 's'} remaining before your test is auto-submitted.`}
              </p>

              {/* Violation dots */}
              <div className="flex gap-2 mb-6">
                {Array.from({ length: MAX_VIOLATIONS - 1 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-full transition-all ${
                      i < warning.count ? 'bg-red-500' : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-3">
                {document.fullscreenElement === null && (
                  <button
                    onClick={reEnterFullscreen}
                    className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white text-sm
                               font-semibold rounded-2xl transition-all active:scale-[0.97]"
                  >
                    Re-enter Fullscreen
                  </button>
                )}
                <button
                  onClick={dismissWarning}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700
                             text-sm font-semibold rounded-2xl transition-all"
                >
                  Continue Test
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
