'use client'

import { useState } from 'react'
import { Icon } from '@/components/product/Icon'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'
import { LEVELS } from '@/lib/profile'

export interface EditableCourse {
  id: string
  title: string
  courseCode: string | null
  level: number | null
  semester: 'FIRST' | 'SECOND' | null
  creditUnits: number | null
  isCarryover: boolean
}

export function EditCourseForm({
  course,
  onSaved,
  onCancel,
}: {
  course: EditableCourse
  onSaved: () => void
  onCancel: () => void
}) {
  const api = useApi()
  const router = useRouter()
  const [form, setForm] = useState({
    courseCode: course.courseCode ?? '',
    title: course.title,
    level: course.level ? String(course.level) : '',
    semester: course.semester ?? '',
    creditUnits: course.creditUnits != null ? String(course.creditUnits) : '',
    isCarryover: course.isCarryover,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: 'courseCode' | 'title' | 'level' | 'semester' | 'creditUnits') {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await api.patch(`/courses/${course.id}`, {
        title: form.title.trim(),
        // null clears a field the student emptied
        courseCode: form.courseCode.trim() || null,
        level: form.level ? Number(form.level) : null,
        semester: form.semester || null,
        creditUnits: form.creditUnits ? Number(form.creditUnits) : null,
        isCarryover: form.isCarryover,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
      setSaving(false)
    }
  }

  async function handleDelete() {
    const name = course.courseCode ? `${course.courseCode} ${course.title}` : course.title
    if (
      !window.confirm(
        `Delete ${name}? This removes its outline, lessons, study plan and quiz history. Your flashcards are kept. This can't be undone.`,
      )
    )
      return
    setDeleting(true)
    try {
      await api.del(`/courses/${course.id}`)
      router.push('/courses')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete course')
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="card p-6 space-y-4">
      <h2 className="font-heading font-bold text-slate-900">Edit course</h2>
      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="grid sm:grid-cols-[140px_1fr] gap-3">
        <div>
          <label htmlFor="courseCode" className="block text-sm font-medium text-slate-700 mb-1.5">Course code</label>
          <input id="courseCode" value={form.courseCode} onChange={set('courseCode')} placeholder="BIO 223" maxLength={20} disabled={saving} className="input-base" />
        </div>
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1.5">Course title</label>
          <input id="title" required minLength={2} maxLength={100} value={form.title} onChange={set('title')} disabled={saving} className="input-base" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="level" className="block text-sm font-medium text-slate-700 mb-1.5">Level</label>
          <select id="level" value={form.level} onChange={set('level')} disabled={saving} className="input-base">
            <option value="">Not set</option>
            {LEVELS.map(l => (
              <option key={l} value={l}>{l}L</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="semester" className="block text-sm font-medium text-slate-700 mb-1.5">Semester</label>
          <select id="semester" value={form.semester} onChange={set('semester')} disabled={saving} className="input-base">
            <option value="">Not set</option>
            <option value="FIRST">First</option>
            <option value="SECOND">Second</option>
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="creditUnits" className="block text-sm font-medium text-slate-700 mb-1.5">Credit units</label>
          <input id="creditUnits" type="number" min={0} max={12} value={form.creditUnits} onChange={set('creditUnits')} disabled={saving} className="input-base" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={form.isCarryover} onChange={e => setForm(f => ({ ...f, isCarryover: e.target.checked }))} disabled={saving} />
        This is a carryover course
      </label>

      <div className="flex items-center gap-3 flex-wrap">
        <button type="submit" disabled={saving || deleting} className="btn-primary">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving || deleting} className="btn-secondary">
          Cancel
        </button>
        <button type="button" onClick={() => void handleDelete()} disabled={saving || deleting} className="ml-auto text-sm font-semibold text-red-500 hover:text-red-700">
          <Icon name="close" className="mr-1 inline h-4 w-4" />{deleting ? 'Deleting…' : 'Delete course'}
        </button>
      </div>
    </form>
  )
}
