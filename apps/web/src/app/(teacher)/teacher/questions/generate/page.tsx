'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Document {
  id: string
  fileName: string
  chunkCount: number
  pageCount?: number
  course?: { id: string; title: string } | null
}

interface McqOption { key: string; text: string }

interface Question {
  id: string
  questionText: string
  questionType: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'THEORY'
  options?: McqOption[]
  correctAnswer: string
  explanation?: string
  difficulty: string
  status: string
}

interface GenerateResult {
  count: number
  questions: Question[]
}

// ─── Config form state ────────────────────────────────────────────────────────

const TYPES = [
  { value: 'MCQ', label: 'Multiple Choice (MCQ)' },
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
]

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GenerateQuestionsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const documentId = searchParams.get('documentId') ?? ''

  const [doc, setDoc] = useState<Document | null>(null)
  const [docLoading, setDocLoading] = useState(true)

  // form
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['MCQ', 'TRUE_FALSE'])
  const [count, setCount] = useState(10)
  const [difficulty, setDifficulty] = useState('MEDIUM')
  const [topicHint, setTopicHint] = useState('')

  // results
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [error, setError] = useState<string | null>(null)

  // Load document info on mount
  useEffect(() => {
    if (!documentId) return
    void apiRef.current
      .get<Document>(`/documents/${documentId}`)
      .then(setDoc)
      .catch(() => setDoc(null))
      .finally(() => setDocLoading(false))
  }, [documentId])

  function toggleType(t: string) {
    setSelectedTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t],
    )
  }

  async function handleGenerate() {
    if (!documentId || selectedTypes.length === 0) return
    setGenerating(true)
    setError(null)

    try {
      const result = await api.post<GenerateResult>('/questions/generate', {
        documentId,
        types: selectedTypes,
        count,
        difficulty,
        topicHint: topicHint.trim() || undefined,
      })
      setQuestions(result.questions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleApprove(id: string) {
    await api.patch(`/questions/${id}/approve`, {}).catch(() => undefined)
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, status: 'APPROVED' } : q))
  }

  async function handleDelete(id: string) {
    await api.del(`/questions/${id}`).catch(() => undefined)
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!documentId) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-gray-500">No document selected.</p>
        <a href="/teacher/documents" className="text-indigo-600 hover:underline text-sm mt-2 inline-block">
          ← Back to Documents
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <a href="/teacher/documents" className="text-sm text-gray-500 hover:text-indigo-600">
          ← Back to Documents
        </a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Generate Questions</h1>
        {docLoading ? (
          <p className="text-gray-400 text-sm mt-1">Loading document…</p>
        ) : doc ? (
          <p className="text-gray-500 text-sm mt-1">
            <span className="font-medium text-gray-700">{doc.fileName}</span>
            {doc.chunkCount != null && ` · ${doc.chunkCount} text chunks`}
            {doc.course && ` · ${doc.course.title}`}
          </p>
        ) : (
          <p className="text-red-500 text-sm mt-1">Document not found</p>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* ── Config panel ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 self-start">
          <h2 className="font-semibold text-gray-800 mb-4">Configuration</h2>

          {/* Question types */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Question types</p>
            <div className="space-y-1.5">
              {TYPES.map(t => (
                <label key={t.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(t.value)}
                    onChange={() => toggleType(t.value)}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of questions: <span className="text-indigo-600 font-semibold">{count}</span>
            </label>
            <input
              type="range"
              min={3}
              max={30}
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>3</span><span>30</span>
            </div>
          </div>

          {/* Difficulty */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Difficulty</p>
            <div className="flex gap-2">
              {DIFFICULTIES.map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    difficulty === d
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-300 text-gray-600 hover:border-indigo-300'
                  }`}
                >
                  {d.charAt(0) + d.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Topic hint */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topic hint <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={topicHint}
              onChange={e => setTopicHint(e.target.value)}
              placeholder="e.g. Photosynthesis"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || selectedTypes.length === 0 || !doc}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
                       text-white font-medium py-2.5 rounded-lg text-sm transition-colors
                       flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Claude is generating…
              </>
            ) : (
              `✨ Generate ${count} questions`
            )}
          </button>
        </div>

        {/* ── Results panel ────────────────────────────────────────── */}
        <div className="lg:col-span-3">
          {questions.length === 0 && !generating ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-2xl mb-2">✨</p>
              <p className="text-gray-500 font-medium">Configure and generate</p>
              <p className="text-gray-400 text-sm mt-1">
                Questions Claude generates will appear here for you to review.
              </p>
            </div>
          ) : generating ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <svg className="animate-spin h-8 w-8 text-indigo-500 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <p className="text-gray-600 font-medium">Claude is reading your document…</p>
              <p className="text-gray-400 text-sm mt-1">This takes 5–15 seconds</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  {questions.length} questions generated
                </p>
                <button
                  onClick={() => router.push('/teacher/questions')}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  View all questions →
                </button>
              </div>

              {questions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={i + 1}
                  onApprove={() => handleApprove(q.id)}
                  onDelete={() => handleDelete(q.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  question: q,
  index,
  onApprove,
  onDelete,
}: {
  question: Question
  index: number
  onApprove: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const typeLabel: Record<string, string> = {
    MCQ: 'MCQ',
    TRUE_FALSE: 'T/F',
    SHORT_ANSWER: 'Short',
    THEORY: 'Theory',
  }

  const diffColor: Record<string, string> = {
    EASY: 'text-emerald-600',
    MEDIUM: 'text-amber-600',
    HARD: 'text-red-600',
  }

  return (
    <div className={`bg-white rounded-xl border transition-colors ${
      q.status === 'APPROVED' ? 'border-emerald-300' : 'border-gray-200'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-400 font-mono">#{index}</span>
            <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
              {typeLabel[q.questionType] ?? q.questionType}
            </span>
            <span className={`text-xs font-medium ${diffColor[q.difficulty] ?? ''}`}>
              {q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase()}
            </span>
            {q.status === 'APPROVED' && (
              <span className="text-xs font-medium text-emerald-600">✓ Approved</span>
            )}
          </div>

          <div className="flex gap-2 ml-auto">
            {q.status !== 'APPROVED' && (
              <button
                onClick={onApprove}
                className="text-xs text-emerald-600 hover:underline font-medium"
              >
                Approve
              </button>
            )}
            <button
              onClick={onDelete}
              className="text-xs text-red-500 hover:underline"
            >
              Delete
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-800 mt-2 font-medium">{q.questionText}</p>

        {/* MCQ / T-F options */}
        {q.options && q.options.length > 0 && (
          <div className="mt-2 space-y-1">
            {q.options.map(opt => (
              <div
                key={opt.key}
                className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${
                  opt.key === q.correctAnswer
                    ? 'bg-emerald-50 text-emerald-800 font-medium'
                    : 'text-gray-600'
                }`}
              >
                <span className="font-mono text-xs w-4">{opt.key}.</span>
                <span>{opt.text}</span>
                {opt.key === q.correctAnswer && (
                  <span className="ml-auto text-xs text-emerald-600">✓ correct</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Short answer */}
        {!q.options && (
          <div className="mt-2 text-sm bg-emerald-50 text-emerald-800 rounded px-3 py-1.5">
            <span className="font-medium">Answer: </span>{q.correctAnswer}
          </div>
        )}

        {/* Explanation toggle */}
        {q.explanation && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2 text-xs text-gray-400 hover:text-gray-600"
          >
            {expanded ? '▲ Hide explanation' : '▼ Show explanation'}
          </button>
        )}
        {expanded && q.explanation && (
          <p className="mt-1 text-xs text-gray-500 italic">{q.explanation}</p>
        )}
      </div>
    </div>
  )
}
