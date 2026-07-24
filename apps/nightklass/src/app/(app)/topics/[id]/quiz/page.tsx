'use client'

import { useState, use as usePromise } from 'react'
import { useApi } from '@/hooks/use-api'

interface QuizOption {
  key: string
  text: string
}

interface QuizQuestion {
  id: string
  questionText: string
  questionType: string
  options: QuizOption[] | null
  isAiGenerated: boolean
}

interface QuizResult {
  questionId: string
  isCorrect: boolean | null
  correctAnswer: string | null
  explanation: string | null
}

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD']

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const api = useApi()

  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<QuizResult[] | null>(null)
  const [scorePercent, setScorePercent] = useState<number | null>(null)
  const [count, setCount] = useState(5)
  const [difficulty, setDifficulty] = useState('MEDIUM')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setError(null)
    setLoading(true)
    setResults(null)
    try {
      const qs = await api.post<QuizQuestion[]>(`/study/topics/${id}/quiz/generate`, { count, difficulty })
      setQuestions(qs)
      setAnswers({})
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
      const body = { answers: questions.map(q => ({ questionId: q.id, selectedAnswer: answers[q.id] })) }
      const result = await api.post<{ scorePercent: number | null; results: QuizResult[] }>(
        `/study/topics/${id}/quiz/submit`,
        body,
      )
      setScorePercent(result.scorePercent)
      setResults(result.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit quiz')
    } finally {
      setLoading(false)
    }
  }

  const resultsByQuestion = new Map(results?.map(r => [r.questionId, r]) ?? [])

  return (
    <div className="max-w-2xl">
      <h1 className="font-heading text-2xl font-bold text-slate-900 mb-1">Self-quiz</h1>
      <p className="text-slate-500 text-sm mb-6">Formative practice — this never counts toward an official grade.</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>}

      {!questions && (
        <div className="card p-6 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1.5"># of questions</label>
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={e => setCount(Number(e.target.value))}
                className="input-base"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="input-base">
                {DIFFICULTIES.map(d => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button onClick={handleGenerate} disabled={loading} className="btn-primary w-full">
            {loading ? 'Generating…' : 'Generate quiz'}
          </button>
        </div>
      )}

      {questions && scorePercent === null && (
        <div className="space-y-4">
          {questions.length > 0 && !questions[0]!.isAiGenerated && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Using a practice question bank for now (no AI key configured yet).
            </p>
          )}
          {questions.map((q, i) => (
            <div key={q.id} className="card p-6">
              <p className="text-sm font-medium text-slate-800 mb-3">
                {i + 1}. {q.questionText}
              </p>
              <div className="space-y-2">
                {(q.options ?? []).map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name={q.id}
                      value={opt.key}
                      checked={answers[q.id] === opt.key}
                      onChange={() => setAnswers(a => ({ ...a, [q.id]: opt.key }))}
                    />
                    <span>
                      {opt.key}. {opt.text}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full">
            {loading ? 'Submitting…' : 'Submit answers'}
          </button>
        </div>
      )}

      {questions && scorePercent !== null && (
        <div className="space-y-4">
          <div className="card p-6 text-center">
            <p className="text-3xl font-heading font-bold text-slate-900">{scorePercent}%</p>
            <p className="text-slate-500 text-sm mt-1">score on this quiz</p>
          </div>
          {questions.map((q, i) => {
            const r = resultsByQuestion.get(q.id)
            return (
              <div key={q.id} className="card p-6">
                <p className="text-sm font-medium text-slate-800 mb-2">
                  {i + 1}. {q.questionText}
                </p>
                <p className={`text-sm font-semibold ${r?.isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                  {r?.isCorrect ? 'Correct' : `Incorrect — correct answer: ${r?.correctAnswer ?? '—'}`}
                </p>
                {r?.explanation && <p className="text-xs text-slate-500 mt-2">{r.explanation}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
