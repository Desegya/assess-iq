'use client'

import { useState, use as usePromise, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/product/PageHeader'
import { Icon } from '@/components/product/Icon'
import { useApi } from '@/hooks/use-api'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { celebrate } from '@/lib/celebrate'

type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'THEORY'
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'

interface QuizOption {
  key: string
  text: string
}

interface QuizQuestion {
  id: string
  questionText: string
  questionType: QuestionType
  options: QuizOption[] | null
  marks: number | null
  isAiGenerated: boolean
}

interface QuizResult {
  questionId: string
  isCorrect: boolean | null
  score: number | null
  maxScore: number | null
  correctAnswer: string | null
  explanation: string | null
  feedback?: string | null
  missingPoints?: string[]
}

interface SubmitResponse {
  attemptId: string | null
  scorePercent: number | null
  results: QuizResult[]
  gradingFailed: boolean
  mistakes: number
  isWeak: boolean
  recommendedDifficulty: Difficulty
  planMessage: string | null
}

const DIFFICULTIES: { value: Difficulty; label: string; hint: string }[] = [
  { value: 'EASY', label: 'Basic', hint: 'Recall and definitions' },
  { value: 'MEDIUM', label: 'Intermediate', hint: 'Understanding and application' },
  { value: 'HARD', label: 'Advanced', hint: 'Analysis and multi-step problems' },
]

const FORMATS: { id: string; label: string; types: QuestionType[] }[] = [
  { id: 'objective', label: 'Multiple choice', types: ['MCQ', 'TRUE_FALSE'] },
  { id: 'short', label: 'Short answer & calculations', types: ['SHORT_ANSWER'] },
  { id: 'theory', label: 'Structured & essay', types: ['THEORY'] },
]

const isWritten = (t: QuestionType) => t === 'SHORT_ANSWER' || t === 'THEORY'

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const api = useApi()

  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<SubmitResponse | null>(null)
  const [count, setCount] = useState(5)
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM')
  const [recommended, setRecommended] = useState<Difficulty | null>(null)
  const [formats, setFormats] = useState<Set<string>>(new Set(['objective']))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardsMade, setCardsMade] = useState<number | null>(null)

  useEffect(() => {
    api
      .get<{ recommendedDifficulty: Difficulty; attempts: unknown[] }>(
        `/study/topics/${id}/quiz/history`,
      )
      .then((h) => {
        setDifficulty(h.recommendedDifficulty)
        if (h.attempts.length) setRecommended(h.recommendedDifficulty)
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (result?.scorePercent != null && result.scorePercent >= 70) celebrate()
  }, [result])

  function toggleFormat(f: string) {
    setFormats((prev) => {
      const next = new Set(prev)
      if (next.has(f) && next.size > 1) next.delete(f)
      else next.add(f)
      return next
    })
  }

  async function handleGenerate(nextDifficulty?: Difficulty) {
    setError(null)
    setLoading(true)
    setResult(null)
    setCardsMade(null)
    const d = nextDifficulty ?? difficulty
    if (nextDifficulty) setDifficulty(nextDifficulty)
    try {
      const types = FORMATS.filter((f) => formats.has(f.id)).flatMap((f) => f.types)
      const qs = await api.post<QuizQuestion[]>(`/study/topics/${id}/quiz/generate`, {
        count,
        difficulty: d,
        types,
      })
      setQuestions(qs)
      setAnswers({})
      window.scrollTo({ top: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate quiz')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!questions) return
    setLoading(true)
    setError(null)
    try {
      const body = {
        answers: questions.map((q) =>
          isWritten(q.questionType)
            ? { questionId: q.id, textAnswer: answers[q.id] ?? '' }
            : { questionId: q.id, selectedAnswer: answers[q.id] },
        ),
      }
      setResult(await api.post<SubmitResponse>(`/study/topics/${id}/quiz/submit`, body))
      window.scrollTo({ top: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit quiz')
    } finally {
      setLoading(false)
    }
  }

  async function handleFlashcards() {
    if (!result?.attemptId) return
    try {
      const r = await api.post<{ created: number }>(
        `/study/quiz-attempts/${result.attemptId}/flashcards`,
        {},
      )
      setCardsMade(r.created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create flashcards')
    }
  }

  const resultsByQuestion = new Map(result?.results.map((r) => [r.questionId, r]) ?? [])
  const answeredCount = questions ? questions.filter((q) => answers[q.id]?.trim()).length : 0
  const hasWritten = questions?.some((q) => isWritten(q.questionType))
  const score = result?.scorePercent

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="See what you know."
        description="Test your understanding, spot what needs another pass, and get feedback. Your scores stay yours."
        eyebrow="Practice, not pressure"
        icon="target"
      />

      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6"
        >
          {error}
        </div>
      )}

      {!questions && (
        <div className="card p-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Level</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={difficulty === d.value}
                  onClick={() => setDifficulty(d.value)}
                  className={`rounded-xl px-3 py-2.5 text-left border-2 transition-colors ${
                    difficulty === d.value
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <span className="block text-sm font-semibold text-slate-800">{d.label}</span>
                  <span className="block text-[11px] text-slate-500">{d.hint}</span>
                </button>
              ))}
            </div>
            {recommended && (
              <p className="text-xs text-violet-600 mt-2">
                Recommended from your last quiz:{' '}
                {DIFFICULTIES.find((d) => d.value === recommended)!.label}
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Question types</p>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={formats.has(f.id)}
                  onClick={() => toggleFormat(f.id)}
                  className={`text-xs font-semibold rounded-xl px-3 py-2 transition-colors ${
                    formats.has(f.id)
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {(formats.has('short') || formats.has('theory')) && (
              <p className="text-xs text-slate-400 mt-2">
                Written answers are marked by AI against a marking scheme, with feedback.
              </p>
            )}
          </div>

          <div className="w-32">
            <label htmlFor="count" className="block text-sm font-medium text-slate-700 mb-1.5">
              Questions
            </label>
            <input
              id="count"
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="input-base"
            />
          </div>

          <button
            onClick={() => void handleGenerate()}
            disabled={loading}
            className="btn-primary w-full"
          >
            <Icon name="target" />
            {loading ? 'Writing your quiz…' : 'Start quiz'}
          </button>
        </div>
      )}

      {questions && !result && (
        <div className="space-y-4">
          <div
            aria-label={`${answeredCount} of ${questions.length} questions answered`}
            className="flex flex-wrap items-center justify-center gap-1.5"
          >
            {questions.map((q, i) => (
              <span
                key={q.id}
                className={`h-2 rounded-full transition-all ${
                  answers[q.id]?.trim()
                    ? 'w-6 bg-violet-500'
                    : i === answeredCount
                      ? 'w-6 bg-violet-200'
                      : 'w-2 bg-slate-200'
                }`}
              />
            ))}
          </div>
          {questions.length > 0 && !questions[0]!.isAiGenerated && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              AI isn&apos;t available right now, so these are multiple-choice questions from a
              practice bank.
            </p>
          )}
          {questions.map((q, i) => (
            <div key={q.id} className="card p-6">
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-base font-medium leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {i + 1}. {q.questionText}
                </p>
                {q.questionType === 'THEORY' && q.marks && (
                  <span className="badge bg-slate-100 text-slate-600 flex-shrink-0">
                    {q.marks} marks
                  </span>
                )}
              </div>
              {isWritten(q.questionType) ? (
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  rows={q.questionType === 'THEORY' ? 8 : 3}
                  placeholder={
                    q.questionType === 'THEORY'
                      ? 'Write your answer. Use headings or points for each part.'
                      : 'Your answer (show working for calculations)'
                  }
                  aria-label={`Answer to question ${i + 1}`}
                  className="input-base"
                />
              ) : (
                <div className="space-y-2">
                  {(q.options ?? []).map((opt) => (
                    <label
                      key={opt.key}
                      className={`flex items-center gap-2 text-sm text-slate-700 rounded-xl px-4 py-3 min-h-12 border cursor-pointer transition-colors ${
                        answers[q.id] === opt.key
                          ? 'border-violet-400 bg-violet-50'
                          : 'border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={opt.key}
                        checked={answers[q.id] === opt.key}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.key }))}
                      />
                      <span>
                        {opt.key}. {opt.text}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full">
            {loading ? (hasWritten ? 'Marking your answers…' : 'Submitting…') : 'Submit answers'}
          </button>
        </div>
      )}

      {questions && result && (
        <div className="space-y-4">
          <div className="card p-8 text-center">
            {score != null ? (
              <>
                <div className="flex justify-center mb-3">
                  <ProgressRing
                    percent={score}
                    size={96}
                    strokeWidth={8}
                    color={score >= 70 ? '#16a34a' : score >= 40 ? '#f59e0b' : '#f43f5e'}
                    label={
                      <span className="font-heading text-2xl font-bold text-slate-900">
                        {score}%
                      </span>
                    }
                  />
                </div>
                <p className="text-slate-500 text-sm">
                  {score >= 80
                    ? 'Excellent. This topic is looking solid.'
                    : score >= 60
                      ? 'Good. A little more practice and you’ve got it.'
                      : score >= 40
                        ? 'Getting there. Revise the lesson, then try again.'
                        : 'This one needs another pass. Start with the lesson.'}
                </p>
              </>
            ) : (
              <p className="text-slate-500 text-sm">
                Your answers are saved below with the model answers.
              </p>
            )}
            {result.gradingFailed && (
              <p className="text-xs text-amber-700 mt-2">
                We couldn&apos;t mark the written answers right now. Compare yours with the model
                answers below.
              </p>
            )}
            {result.planMessage && (
              <p className="text-xs text-violet-700 bg-violet-50 rounded-lg px-3 py-2 mt-4">
                <span className="inline-flex items-center gap-2">
                  <Icon name="calendar" className="h-4 w-4" />
                  {result.planMessage}
                </span>
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {result.isWeak && (
                <Link href={`/topics/${id}/learn`} className="btn-primary !py-2 text-sm">
                  Revise the lesson
                </Link>
              )}
              {result.mistakes > 0 && result.attemptId && cardsMade === null && (
                <button onClick={handleFlashcards} className="btn-secondary !py-2 text-sm">
                  Make flashcards from my {result.mistakes} mistake
                  {result.mistakes === 1 ? '' : 's'}
                </button>
              )}
              {cardsMade !== null && (
                <Link href="/flashcards" className="btn-secondary !py-2 text-sm">
                  ✓ {cardsMade} flashcards added, review them
                </Link>
              )}
              <button
                onClick={() => void handleGenerate(result.recommendedDifficulty)}
                disabled={loading}
                className="btn-secondary !py-2 text-sm"
              >
                {loading
                  ? 'Writing…'
                  : result.recommendedDifficulty !== difficulty
                    ? `Try a ${DIFFICULTIES.find((d) => d.value === result.recommendedDifficulty)!.label.toLowerCase()} quiz`
                    : 'Another quiz'}
              </button>
            </div>
          </div>

          {questions.map((q, i) => {
            const r = resultsByQuestion.get(q.id)
            const options = q.options ?? []
            const correctText = options.find((o) => o.key === r?.correctAnswer)
            return (
              <div key={q.id} className="card p-6">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-base font-medium leading-relaxed text-slate-800 whitespace-pre-wrap">
                    {i + 1}. {q.questionText}
                  </p>
                  {r?.score != null && r.maxScore != null && isWritten(q.questionType) && (
                    <span
                      className={`badge flex-shrink-0 ${
                        r.score / r.maxScore >= 0.6
                          ? 'bg-emerald-50 text-emerald-700'
                          : r.score > 0
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {r.score}/{r.maxScore}
                    </span>
                  )}
                </div>

                {isWritten(q.questionType) ? (
                  <div className="space-y-2 text-sm">
                    <p className="text-xs text-slate-500">Your answer</p>
                    <p className="whitespace-pre-wrap bg-slate-50 rounded-lg p-3 text-slate-700">
                      {answers[q.id]?.trim() || '(blank)'}
                    </p>
                    {r?.feedback && (
                      <p className="text-slate-700">
                        <span className="font-semibold">Feedback:</span> {r.feedback}
                      </p>
                    )}
                    {r?.missingPoints && r.missingPoints.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">You missed</p>
                        <ul className="list-disc pl-5 text-slate-600">
                          {r.missingPoints.map((m, j) => (
                            <li key={j}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <details>
                      <summary className="text-xs font-semibold text-violet-600 cursor-pointer">
                        {q.questionType === 'THEORY'
                          ? 'Marking scheme & model answer'
                          : 'Model answer'}
                      </summary>
                      <p className="whitespace-pre-wrap text-xs text-slate-600 mt-2">
                        {r?.correctAnswer}
                      </p>
                      {r?.explanation && (
                        <p className="whitespace-pre-wrap text-xs text-slate-600 mt-2">
                          {r.explanation}
                        </p>
                      )}
                    </details>
                  </div>
                ) : (
                  <>
                    <p
                      className={`text-sm font-semibold ${r?.isCorrect ? 'text-emerald-600' : 'text-red-600'}`}
                    >
                      {r?.isCorrect
                        ? 'Correct'
                        : `Incorrect. Correct answer: ${r?.correctAnswer ?? '—'}${correctText ? `. ${correctText.text}` : ''}`}
                    </p>
                    {r?.explanation && (
                      <p className="text-xs text-slate-500 mt-2">{r.explanation}</p>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
