'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Course { id: string; title: string }

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

export default function AssessmentsPage() {
  const router = useRouter()
  const api    = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading,     setLoading]     = useState(true)

  const [showModal,    setShowModal]    = useState(false)
  const [courses,      setCourses]      = useState<Course[]>([])
  const [creating,     setCreating]     = useState(false)
  const [createError,  setCreateError]  = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', courseId: '', durationMinutes: 60,
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
    setCourses(list); setShowModal(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.courseId) { setCreateError('Please select a course'); return }
    setCreating(true); setCreateError(null)
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

  const inputClass =
    'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 ' +
    'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 ' +
    'focus:border-violet-500 transition-all duration-150'

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Assessments</h1>
          <p className="text-slate-500 text-sm mt-1">Create and manage tests for your students.</p>
        </div>
        <button
          onClick={() => void openModal()}
          className="bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white
                     font-semibold px-5 py-2.5 rounded-xl text-sm transition-all duration-150
                     shadow-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Assessment
        </button>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 flex gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
                <div className="flex gap-3 pt-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-6 w-16 rounded-full self-start" />
            </div>
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="font-heading font-semibold text-slate-700 text-lg">No assessments yet</p>
          <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
            Build your question bank first, then create an assessment.
          </p>
          <a href="/teacher/questions"
             className="mt-5 inline-block text-sm font-semibold text-violet-600
                        hover:text-violet-700 transition-colors">
            Go to Question Bank →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a, idx) => (
            <div
              key={a.id}
              onClick={() => router.push(`/teacher/assessments/${a.id}`)}
              className="bg-white rounded-2xl border border-slate-200 shadow-card
                         hover:shadow-card-hover hover:border-violet-200 cursor-pointer
                         transition-all duration-200 p-5 group animate-slide-up"
              style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <StatusBadge status={a.status} />
                    <span className="text-xs text-slate-400 font-medium">{a.course.title}</span>
                  </div>
                  <h2 className="font-heading text-base font-bold text-slate-900 truncate">
                    {a.title}
                  </h2>
                  {a.description && (
                    <p className="text-sm text-slate-500 mt-0.5 truncate">{a.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="1.8" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 6v6l4 2" />
                      </svg>
                      {a.durationMinutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
                      </svg>
                      {a._count.questions} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                      </svg>
                      {a._count.attempts} attempts
                    </span>
                    <span>Created {new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-slate-300 group-hover:text-violet-400 flex-shrink-0 mt-1
                                transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center
                        justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-modal w-full max-w-md animate-scale-in">
            <div className="p-6 border-b border-slate-100">
              <h2 className="font-heading text-lg font-bold text-slate-900">New Assessment</h2>
              <p className="text-sm text-slate-400 mt-1">Give it a title and pick a course.</p>
            </div>

            <form onSubmit={e => void handleCreate(e)} className="p-6 space-y-4">
              {createError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5 border border-red-100">
                  {createError}
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Biology Mid-Term Test"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Description <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief overview…"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Course</label>
                <select
                  value={form.courseId}
                  onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">— Select a course —</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Duration:{' '}
                  <span className="text-violet-600 font-bold">{form.durationMinutes} min</span>
                </label>
                <input
                  type="range" min={5} max={180} step={5}
                  value={form.durationMinutes}
                  onChange={e => setForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))}
                  className="w-full accent-violet-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>5 min</span><span>180 min</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setCreateError(null) }}
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium
                             text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60
                             text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
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
