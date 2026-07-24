'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'

export default function NewCoursePage() {
  const router = useRouter()
  const api = useApi()

  const [form, setForm] = useState({ title: '', subject: '', description: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const course = await api.post<{ id: string }>('/courses', form)
      router.push(`/courses/${course.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create course')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-heading text-2xl font-bold text-slate-900 mb-6">New course</h1>
      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Course title</label>
          <input
            required
            value={form.title}
            onChange={set('title')}
            placeholder="Biostatistics"
            disabled={loading}
            className="input-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject</label>
          <input
            required
            value={form.subject}
            onChange={set('subject')}
            placeholder="Statistics"
            disabled={loading}
            className="input-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={form.description}
            onChange={set('description')}
            placeholder="Intro to biostatistics for 200-level"
            disabled={loading}
            rows={3}
            className="input-base"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating…' : 'Create course'}
        </button>
      </form>
    </div>
  )
}
