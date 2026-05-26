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

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPES = [
  { value: 'MCQ',          label: 'Multiple Choice' },
  { value: 'TRUE_FALSE',   label: 'True / False'    },
  { value: 'SHORT_ANSWER', label: 'Short Answer'    },
]

const DIFFICULTIES = [
  { value: 'EASY',   label: 'Easy',   color: 'text-emerald-600 border-emerald-300 bg-emerald-50' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-amber-600 border-amber-300 bg-amber-50' },
  { value: 'HARD',   label: 'Hard',   color: 'text-red-600 border-red-300 bg-red-50' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GenerateQuestionsPage() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const api          = useApi()
  const apiRef       = useRef(api)
  apiRef.current = api

  const documentId = searchParams.get('documentId') ?? ''

  const [doc,        setDoc]        = useState<Document | null>(null)
  const [docLoading, setDocLoading] = useState(true)

  const [selectedTypes, setSelectedTypes] = useState<string[]>(['MCQ', 'TRUE_FALSE'])
  const [count,         setCount]         = useState(10)
  const [difficulty,    setDifficulty]    = useState('MEDIUM')
  const [topicHint,     setTopicHint]     = useState('')

  const [generating, setGenerating] = useState(false)
  const [questions,  setQuestions]  = useState<Question[]>([])
  const [error,      setError]      = useState<string | null>(null)

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
    setGenerating(true); setError(null)

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

  if (!documentId) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="font-heading font-semibold text-slate-700">No document selected</p>
        <a href="/teacher/documents"
           className="text-violet-600 hover:underline text-sm mt-2 inline-block font-medium">
          ← Back to Documents
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-8">
        <a href="/teacher/documents"
           className="text-sm text-slate-500 hover:text-violet-600 font-medium transition-colors
                      flex items-center gap-1 w-fit">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Documents
        </a>
        <h1 className="font-heading text-2xl font-bold text-slate-900 mt-3">Generate Questions</h1>
        {docLoading ? (
          <div className="mt-1 h-4 w-48 bg-slate-200 animate-shimmer rounded" />
        ) : doc ? (
          <p className="text-slate-500 text-sm mt-1">
            <span className="font-semibold text-slate-700">{doc.fileName}</span>
            {doc.chunkCount != null && ` · ${doc.chunkCount} text chunks`}
            {doc.course && ` · ${doc.course.title}`}
          </p>
        ) : (
          <p className="text-red-500 text-sm mt-1">Document not found</p>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* ── Config panel ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-card p-5 self-start">
          <h2 className="font-heading font-semibold text-slate-800 mb-5">Configuration</h2>

          {/* Question types */}
          <div className="mb-5">
            <p className="text-sm font-semibold text-slate-700 mb-2.5">Question types</p>
            <div className="space-y-2">
              {TYPES.map(t => (
                <label key={t.value}
                       className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer
                                   transition-all duration-150 ${
                         selectedTypes.includes(t.value)
                           ? 'border-violet-400 bg-violet-50'
                           : 'border-slate-200 hover:border-slate-300'
                       }`}>
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(t.value)}
                    onChange={() => toggleType(t.value)}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm font-medium text-slate-700">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Questions:{' '}
              <span className="text-violet-600 font-bold">{count}</span>
            </label>
            <input
              type="range" min={3} max={30} value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="w-full accent-violet-600 h-2 rounded-full"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>3</span><span>30</span>
            </div>
          </div>

          {/* Difficulty */}
          <div className="mb-5">
            <p className="text-sm font-semibold text-slate-700 mb-2.5">Difficulty</p>
            <div className="flex gap-2">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDifficulty(d.value)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                    difficulty === d.value
                      ? d.color + ' border-current'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic hint */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Topic hint <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={topicHint}
              onChange={e => setTopicHint(e.target.value)}
              placeholder="e.g. Photosynthesis"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm
                         placeholder:text-slate-400 focus:outline-none focus:ring-2
                         focus:ring-violet-500/20 focus:border-violet-500 transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5 mb-4 border border-red-100">
              {error}
            </p>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || selectedTypes.length === 0 || !doc}
            className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.98] disabled:opacity-60
                       text-white font-semibold py-3 rounded-xl text-sm transition-all duration-150
                       shadow-sm flex items-center justify-center gap-2"
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
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Generate {count} questions
              </>
            )}
          </button>
        </div>

        {/* ── Results panel ── */}
        <div className="lg:col-span-3">
          {questions.length === 0 && !generating ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <p className="font-heading font-semibold text-slate-700">Configure and generate</p>
              <p className="text-slate-400 text-sm mt-1.5 max-w-xs mx-auto">
                Questions Claude generates will appear here for you to review.
              </p>
            </div>
          ) : generating ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-12 text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
                <div className="absolute inset-0 rounded-full border-4 border-violet-600
                                border-t-transparent animate-spin" />
                <div className="absolute inset-2 rounded-full bg-violet-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707" />
                  </svg>
                </div>
              </div>
              <p className="font-heading font-semibold text-slate-700">Claude is reading your document…</p>
              <p className="text-slate-400 text-sm mt-1">This takes 5–15 seconds</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  {questions.length} questions generated
                </p>
                <button
                  onClick={() => router.push('/teacher/questions')}
                  className="text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
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
    MCQ: 'MCQ', TRUE_FALSE: 'T/F', SHORT_ANSWER: 'Short', THEORY: 'Theory',
  }

  const diffColor: Record<string, string> = {
    EASY:   'text-emerald-600 bg-emerald-50',
    MEDIUM: 'text-amber-600 bg-amber-50',
    HARD:   'text-red-600 bg-red-50',
  }

  const isApproved = q.status === 'APPROVED'

  return (
    <div className={`bg-white rounded-2xl border-2 transition-all duration-200 shadow-card ${
      isApproved ? 'border-emerald-300' : 'border-slate-200 hover:border-violet-300'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <span className="text-xs text-slate-400 font-mono font-bold">#{index}</span>
            <span className="text-xs font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-lg">
              {typeLabel[q.questionType] ?? q.questionType}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${diffColor[q.difficulty] ?? 'text-slate-600 bg-slate-100'}`}>
              {q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase()}
            </span>
            {isApproved && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Approved
              </span>
            )}
          </div>

          <div className="flex gap-3 ml-auto flex-shrink-0">
            {!isApproved && (
              <button
                onClick={onApprove}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Approve
              </button>
            )}
            <button
              onClick={onDelete}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-800 mt-2.5 font-medium leading-relaxed">{q.questionText}</p>

        {q.options && q.options.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {q.options.map(opt => (
              <div
                key={opt.key}
                className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${
                  opt.key === q.correctAnswer
                    ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200'
                    : 'text-slate-600 bg-slate-50'
                }`}
              >
                <span className="font-mono text-xs w-4 flex-shrink-0">{opt.key}.</span>
                <span>{opt.text}</span>
                {opt.key === q.correctAnswer && (
                  <span className="ml-auto text-xs text-emerald-600 font-semibold flex-shrink-0">correct</span>
                )}
              </div>
            ))}
          </div>
        )}

        {!q.options && (
          <div className="mt-2.5 text-sm bg-emerald-50 border border-emerald-200
                          text-emerald-800 rounded-lg px-3 py-2">
            <span className="font-semibold">Answer: </span>{q.correctAnswer}
          </div>
        )}

        {q.explanation && (
          <>
            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-2 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
            >
              <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {expanded ? 'Hide explanation' : 'Show explanation'}
            </button>
            {expanded && (
              <p className="mt-1.5 text-xs text-slate-500 italic bg-slate-50 rounded-lg px-3 py-2">
                {q.explanation}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
