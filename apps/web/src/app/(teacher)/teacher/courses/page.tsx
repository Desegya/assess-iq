'use client'

import { useState, useEffect, useRef } from 'react'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Course {
  id: string
  title: string
  subject: string
  description?: string
  isActive: boolean
  createdAt: string
  teacher: { id: string; name: string }
  _count: { documents: number; questions: number; assessments: number }
}

type FormState = { title: string; subject: string; description: string }
const EMPTY_FORM: FormState = { title: '', subject: '', description: '' }

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
      bg-[length:200%_100%] animate-shimmer rounded-lg ${className ?? ''}`} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  const [modal,     setModal]     = useState<'create' | 'edit' | null>(null)
  const [editing,   setEditing]   = useState<Course | null>(null)
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    void apiRef.current
      .get<Course[]>('/courses')
      .then(setCourses)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  function openCreate() {
    setForm(EMPTY_FORM); setFormError(null); setEditing(null); setModal('create')
  }

  function openEdit(c: Course) {
    setForm({ title: c.title, subject: c.subject, description: c.description ?? '' })
    setFormError(null); setEditing(c); setModal('edit')
  }

  function closeModal() { setModal(null); setEditing(null); setFormError(null) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setFormError(null)

    try {
      if (modal === 'create') {
        const created = await api.post<Course>('/courses', {
          title: form.title.trim(),
          subject: form.subject.trim(),
          description: form.description.trim() || undefined,
        })
        setCourses(prev => [created, ...prev])
      } else if (modal === 'edit' && editing) {
        const updated = await api.patch<Course>(`/courses/${editing.id}`, {
          title: form.title.trim(),
          subject: form.subject.trim(),
          description: form.description.trim() || undefined,
        })
        setCourses(prev => prev.map(c => (c.id === editing.id ? updated : c)))
      }
      closeModal()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: Course) {
    if (!confirm(`Delete "${c.title}"? This cannot be undone.`)) return
    await api.del(`/courses/${c.id}`).catch(() => undefined)
    setCourses(prev => prev.filter(x => x.id !== c.id))
  }

  // Subject colour cycling
  const SUBJECT_COLORS = [
    'from-violet-500 to-violet-700',
    'from-sky-500 to-sky-700',
    'from-emerald-500 to-emerald-700',
    'from-amber-500 to-amber-600',
    'from-rose-500 to-rose-700',
    'from-indigo-500 to-indigo-700',
  ]

  const inputClass =
    'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 ' +
    'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 ' +
    'focus:border-violet-500 transition-all duration-150'

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">My Courses</h1>
          <p className="text-slate-500 text-sm mt-1">
            Organise your subjects — assessments are grouped by course.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white
                     font-semibold px-5 py-2.5 rounded-xl text-sm transition-all duration-150
                     shadow-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Course
        </button>
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-20" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="font-heading font-semibold text-slate-700 text-lg">No courses yet</p>
          <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
            Create a course first — assessments and documents are organised by course.
          </p>
          <button
            onClick={openCreate}
            className="mt-5 bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white
                       font-semibold px-5 py-2.5 rounded-xl text-sm transition-all duration-150 shadow-sm"
          >
            Create your first course
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c, idx) => {
            const grad = SUBJECT_COLORS[idx % SUBJECT_COLORS.length]
            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-card
                           hover:shadow-card-hover transition-all duration-200 flex flex-col overflow-hidden"
              >
                {/* Top colour strip */}
                <div className={`h-1.5 bg-gradient-to-r ${grad}`} />

                <div className="p-5 flex flex-col flex-1">
                  {/* Icon + title */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad}
                                    flex items-center justify-center text-white font-bold
                                    text-lg flex-shrink-0`}>
                      {c.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-heading font-semibold text-slate-900 truncate">{c.title}</h2>
                      <p className="text-xs text-violet-600 font-medium mt-0.5">{c.subject}</p>
                    </div>
                  </div>

                  {c.description && (
                    <p className="text-sm text-slate-500 mb-3 line-clamp-2 leading-relaxed">
                      {c.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-auto mb-4">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {c._count.documents} docs
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {c._count.questions} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                      </svg>
                      {c._count.assessments} tests
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <a
                      href={`/teacher/documents?courseId=${c.id}`}
                      className="flex-1 text-center text-xs font-medium text-slate-600 hover:text-violet-700
                                 py-2 rounded-xl border border-slate-200 hover:border-violet-300
                                 hover:bg-violet-50 transition-all duration-150"
                    >
                      Documents
                    </a>
                    <button
                      onClick={() => openEdit(c)}
                      className="flex-1 text-xs font-medium text-slate-600 hover:text-violet-700
                                 py-2 rounded-xl border border-slate-200 hover:border-violet-300
                                 hover:bg-violet-50 transition-all duration-150"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void handleDelete(c)}
                      className="px-3 text-xs text-red-400 hover:text-red-600
                                 py-2 rounded-xl border border-slate-200 hover:border-red-200
                                 hover:bg-red-50 transition-all duration-150"
                      title="Delete course"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center
                        justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-modal w-full max-w-md animate-scale-in">
            <div className="p-6 border-b border-slate-100">
              <h2 className="font-heading text-lg font-bold text-slate-900">
                {modal === 'create' ? 'New Course' : `Edit — ${editing?.title}`}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {modal === 'create'
                  ? 'Courses group your documents and assessments by subject.'
                  : 'Update the course details below.'}
              </p>
            </div>

            <form onSubmit={e => void handleSave(e)} className="p-6 space-y-4">
              {formError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5 border border-red-100">
                  {formError}
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Course Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Biology SS2"
                  required minLength={2}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Biology"
                  required minLength={2}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Description <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Senior Secondary Biology — WAEC syllabus"
                  rows={3}
                  className={inputClass + ' resize-none'}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium
                             text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60
                             text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                >
                  {saving
                    ? 'Saving…'
                    : modal === 'create'
                    ? 'Create Course'
                    : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
