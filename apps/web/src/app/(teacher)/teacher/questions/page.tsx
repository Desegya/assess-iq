'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface McqOption { key: string; text: string }

interface Question {
  id: string
  questionText: string
  questionType: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'THEORY'
  options?: McqOption[]
  correctAnswer: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED'
  isAiGenerated: boolean
  createdAt: string
  createdBy: { id: string; name: string }
  sourceDocument?: { id: string; fileName: string } | null
  course?: { id: string; title: string } | null
}

interface Course { id: string; title: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<Question['questionType'], string> = {
  MCQ: 'MCQ',
  TRUE_FALSE: 'T/F',
  SHORT_ANSWER: 'Short',
  THEORY: 'Theory',
}

const STATUS_STYLE: Record<Question['status'], string> = {
  DRAFT:          'bg-gray-100 text-gray-600',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700',
  APPROVED:       'bg-emerald-50 text-emerald-700',
  REJECTED:       'bg-red-50 text-red-500',
  ARCHIVED:       'bg-gray-100 text-gray-400',
}

const DIFF_STYLE: Record<Question['difficulty'], string> = {
  EASY:   'text-emerald-600',
  MEDIUM: 'text-amber-600',
  HARD:   'text-red-600',
}

// ─── Question row ─────────────────────────────────────────────────────────────

function QuestionRow({
  q,
  onApprove,
  onDelete,
}: {
  q: Question
  onApprove: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`border-b border-gray-50 last:border-0 px-5 py-4 transition-colors ${
      expanded ? 'bg-gray-50/50' : 'hover:bg-gray-50/30'
    }`}>
      <div className="flex items-start gap-3">
        {/* Badges */}
        <div className="flex flex-col gap-1 pt-0.5 flex-shrink-0 w-16">
          <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-center">
            {TYPE_LABEL[q.questionType]}
          </span>
          <span className={`text-xs font-medium ${DIFF_STYLE[q.difficulty]} text-center`}>
            {q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase()}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm text-gray-800 font-medium ${expanded ? '' : 'line-clamp-2'}`}>
            {q.questionText}
          </p>

          {/* Expanded detail */}
          {expanded && (
            <div className="mt-3 space-y-2">
              {q.options && q.options.length > 0 && (
                <div className="space-y-1">
                  {q.options.map(opt => (
                    <div
                      key={opt.key}
                      className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                        opt.key === q.correctAnswer
                          ? 'bg-emerald-50 text-emerald-800 font-medium'
                          : 'text-gray-500'
                      }`}
                    >
                      <span className="font-mono w-4">{opt.key}.</span>
                      <span>{opt.text}</span>
                      {opt.key === q.correctAnswer && (
                        <span className="ml-auto text-emerald-600">✓</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!q.options && (
                <div className="bg-emerald-50 text-emerald-800 text-xs rounded px-3 py-1.5">
                  <span className="font-medium">Answer: </span>{q.correctAnswer}
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-400 pt-1">
                {q.course && <span>📚 {q.course.title}</span>}
                {q.sourceDocument && <span>📄 {q.sourceDocument.fileName}</span>}
                {q.isAiGenerated && <span>✨ AI generated</span>}
                <span>by {q.createdBy.name}</span>
                <span>{new Date(q.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          )}

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors"
          >
            {expanded ? '▲ less' : '▼ more'}
          </button>
        </div>

        {/* Status + actions */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_STYLE[q.status]}`}>
            {q.status === 'PENDING_REVIEW' ? 'Review' : q.status.charAt(0) + q.status.slice(1).toLowerCase()}
          </span>
          <div className="flex items-center gap-2">
            {q.status !== 'APPROVED' && (
              <button
                onClick={() => onApprove(q.id)}
                className="text-xs text-emerald-600 hover:underline font-medium"
              >
                Approve
              </button>
            )}
            <button
              onClick={() => onDelete(q.id)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuestionsPage() {
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [questions, setQuestions] = useState<Question[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [courseFilter, setCourseFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([
      apiRef.current.get<Question[]>('/questions').catch(() => []),
      apiRef.current.get<Course[]>('/courses').catch(() => []),
    ]).then(([qs, cs]) => {
      setQuestions(qs)
      setCourses(cs)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (statusFilter !== 'ALL' && q.status !== statusFilter) return false
      if (courseFilter !== 'ALL' && q.course?.id !== courseFilter) return false
      if (search) {
        const s = search.toLowerCase()
        if (!q.questionText.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [questions, statusFilter, courseFilter, search])

  async function handleApprove(id: string) {
    await api.patch(`/questions/${id}/approve`, {}).catch(() => undefined)
    setQuestions(prev =>
      prev.map(q => q.id === id ? { ...q, status: 'APPROVED' as const } : q),
    )
  }

  async function handleDelete(id: string) {
    await api.del(`/questions/${id}`).catch(() => undefined)
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  const counts = useMemo(() => ({
    all: questions.length,
    draft: questions.filter(q => q.status === 'DRAFT').length,
    approved: questions.filter(q => q.status === 'APPROVED').length,
  }), [questions])

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {counts.all} total · {counts.approved} approved · {counts.draft} awaiting review
          </p>
        </div>
        <a
          href="/teacher/documents"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium
                     px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 4v16m8-8H4" />
          </svg>
          Generate more
        </a>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search questions…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {['ALL', 'DRAFT', 'APPROVED'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s === 'ALL' ? `All (${counts.all})` :
                 s === 'DRAFT' ? `Draft (${counts.draft})` :
                 `Approved (${counts.approved})`}
              </button>
            ))}
          </div>

          {/* Course filter */}
          {courses.length > 0 && (
            <select
              value={courseFilter}
              onChange={e => setCourseFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white
                         focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">Loading questions…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            {questions.length === 0 ? (
              <>
                <p className="text-2xl mb-2">🤖</p>
                <p className="text-gray-500 font-medium">No questions yet</p>
                <p className="text-gray-400 text-sm mt-1 mb-4">
                  Upload a document and use AI to generate questions from it.
                </p>
                <a
                  href="/teacher/documents"
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  Upload a document →
                </a>
              </>
            ) : (
              <>
                <p className="text-gray-500 font-medium">No questions match your filters</p>
                <button
                  onClick={() => { setStatusFilter('ALL'); setCourseFilter('ALL'); setSearch('') }}
                  className="mt-2 text-sm text-indigo-600 hover:underline"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Bulk approve banner */}
            {counts.draft > 0 && statusFilter !== 'APPROVED' && (
              <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-100">
                <p className="text-sm text-amber-700">
                  <span className="font-medium">{counts.draft} questions</span> need review before
                  they can be added to assessments.
                </p>
                <button
                  onClick={async () => {
                    const drafts = questions.filter(q => q.status === 'DRAFT')
                    await Promise.all(drafts.map(q =>
                      api.patch(`/questions/${q.id}/approve`, {}).catch(() => undefined)
                    ))
                    setQuestions(prev =>
                      prev.map(q => q.status === 'DRAFT' ? { ...q, status: 'APPROVED' as const } : q)
                    )
                  }}
                  className="text-xs font-medium text-amber-700 hover:text-amber-900 border border-amber-200
                             px-3 py-1 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  Approve all drafts
                </button>
              </div>
            )}

            <div className="divide-y divide-gray-50">
              {filtered.map(q => (
                <QuestionRow
                  key={q.id}
                  q={q}
                  onApprove={() => void handleApprove(q.id)}
                  onDelete={() => void handleDelete(q.id)}
                />
              ))}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400">
                Showing {filtered.length} of {questions.length} questions
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
