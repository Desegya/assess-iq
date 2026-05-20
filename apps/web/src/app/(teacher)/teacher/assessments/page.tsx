'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Course {
  id: string
  title: string
}

interface Assessment {
  id: string
  title: string
  description?: string
  durationMinutes: number
  status: 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
  totalQuestions: number
  createdAt: string
  course: { id: string; title: string }
  _count: { questions: number; attempts: number }
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssessmentsPage() {
  const router = useRouter()
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)

  // Create modal state
  const [showModal, setShowModal] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    courseId: '',
    durationMinutes: 60,
  })

  useEffect(() => {
    void apiRef.current
      .get<Assessment[]>('/assessments')
      .then(setAssessments)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  async function openModal() {
    const list = await api.get<Course[]>('/courses').catch(() => [])
    setCourses(list)
    setShowModal(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.courseId) { setCreateError('Please select a course'); return }
    setCreating(true)
    setCreateError(null)
    try {
      const created = await api.post<Assessment>('/assessments', {
        title: form.title,
        description: form.description || undefined,
        courseId: form.courseId,
        durationMinutes: form.durationMinutes,
      })
      router.push(`/teacher/assessments/${created.id}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create')
      setCreating(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
          <p className="text-gray-500 text-sm mt-0.5">Create and manage tests for your students.</p>
        </div>
        <button
          onClick={() => void openModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium
                     px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Assessment
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
          Loading assessments…
        </div>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-gray-500 font-medium">No assessments yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Build your question bank first, then create an assessment.
          </p>
          <a
            href="/teacher/questions"
            className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
          >
            Go to Question Bank →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map(a => (
            <div
              key={a.id}
              onClick={() => router.push(`/teacher/assessments/${a.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300
                         cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={a.status} />
                    <span className="text-xs text-gray-400">{a.course.title}</span>
                  </div>
                  <h2 className="text-base font-semibold text-gray-900 truncate">{a.title}</h2>
                  {a.description && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{a.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>⏱ {a.durationMinutes} min</span>
                    <span>❓ {a._count.questions} questions</span>
                    <span>📝 {a._count.attempts} attempts</span>
                    <span>Created {new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" fill="none"
                     stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">New Assessment</h2>
              <p className="text-sm text-gray-400 mt-1">Give it a title and pick a course.</p>
            </div>

            <form onSubmit={e => void handleCreate(e)} className="p-6 space-y-4">
              {createError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Biology Mid-Term Test"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief overview…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <select
                  value={form.courseId}
                  onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">— Select a course —</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration: <span className="text-indigo-600 font-semibold">{form.durationMinutes} min</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={180}
                  step={5}
                  value={form.durationMinutes}
                  onChange={e => setForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>5 min</span><span>180 min</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setCreateError(null) }}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium
                             text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
                             text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {creating ? 'Creating…' : 'Create & Open'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
