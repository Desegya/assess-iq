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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  // Modal: 'create' | 'edit' | null
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Course | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    void apiRef.current
      .get<Course[]>('/courses')
      .then(setCourses)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setEditing(null)
    setModal('create')
  }

  function openEdit(c: Course) {
    setForm({ title: c.title, subject: c.subject, description: c.description ?? '' })
    setFormError(null)
    setEditing(c)
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setEditing(null)
    setFormError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

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

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Courses</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Organise your subjects — assessments are grouped by course.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium
                     px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Course
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
          Loading courses…
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-3xl mb-3">📚</p>
          <p className="text-gray-700 font-medium">No courses yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-4">
            Create a course first — assessments and documents are organised by course.
          </p>
          <button
            onClick={openCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium
                       px-4 py-2 rounded-lg transition-colors"
          >
            Create your first course
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(c => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col
                         hover:border-indigo-200 transition-colors"
            >
              {/* Icon + title */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center
                                text-indigo-700 font-bold text-lg flex-shrink-0">
                  {c.title.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-gray-900 truncate">{c.title}</h2>
                  <p className="text-xs text-indigo-600 font-medium">{c.subject}</p>
                </div>
              </div>

              {c.description && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{c.description}</p>
              )}

              {/* Counts */}
              <div className="flex gap-3 text-xs text-gray-400 mt-auto mb-4">
                <span>📄 {c._count.documents} docs</span>
                <span>❓ {c._count.questions} questions</span>
                <span>📋 {c._count.assessments} tests</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <a
                  href={`/teacher/documents?courseId=${c.id}`}
                  className="flex-1 text-center text-xs text-gray-600 hover:text-indigo-600
                             py-1.5 rounded-lg border border-gray-200 hover:border-indigo-300
                             transition-colors font-medium"
                >
                  Documents
                </a>
                <button
                  onClick={() => openEdit(c)}
                  className="flex-1 text-xs text-gray-600 hover:text-indigo-600
                             py-1.5 rounded-lg border border-gray-200 hover:border-indigo-300
                             transition-colors font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => void handleDelete(c)}
                  className="px-3 text-xs text-red-400 hover:text-red-600
                             py-1.5 rounded-lg border border-gray-200 hover:border-red-200
                             transition-colors"
                  title="Delete course"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {modal === 'create' ? 'New Course' : `Edit — ${editing?.title}`}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {modal === 'create'
                  ? 'Courses group your documents and assessments by subject.'
                  : 'Update the course details below.'}
              </p>
            </div>

            <form onSubmit={e => void handleSave(e)} className="p-6 space-y-4">
              {formError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Course Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Biology SS2"
                  required
                  minLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Biology"
                  required
                  minLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description{' '}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Senior Secondary Biology — WAEC syllabus"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium
                             text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
                             text-white rounded-lg text-sm font-medium transition-colors"
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
