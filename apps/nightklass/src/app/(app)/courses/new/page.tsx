'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'

const LEVELS = [100, 200, 300, 400, 500, 600]

type Path = 'manual' | 'outline'

// "BIO 223 Biostatistics", "BIO223 - Biostatistics", "Biostatistics" or just "BIO 223"
function parseCourseInput(raw: string): { courseCode?: string; title: string } {
  const value = raw.trim().replace(/\s+/g, ' ')
  const match = value.match(/^([A-Za-z]{2,4})\s?(\d{3}[A-Za-z]?)\b\s*[-–—:]?\s*(.*)$/)
  if (!match) return { title: value }
  const courseCode = `${match[1]!.toUpperCase()} ${match[2]!.toUpperCase()}`
  return { courseCode, title: match[3]?.trim() || courseCode }
}

const PATHS: { id: Path | 'programme'; title: string; desc: string; soon?: boolean }[] = [
  {
    id: 'programme',
    title: 'Choose from my programme',
    desc: 'See courses suggested for your department, level and semester.',
    soon: true,
  },
  {
    id: 'manual',
    title: 'Add a course manually',
    desc: 'Enter a course code or title. No syllabus needed. We can draft the topics for you.',
  },
  {
    id: 'outline',
    title: 'Upload a course outline',
    desc: 'Upload your syllabus (PDF, Word or text) and we’ll pull the topics out for you to confirm.',
  },
]

export default function NewCoursePage() {
  const router = useRouter()
  const api = useApi()

  const [path, setPath] = useState<Path | null>(null)
  const [form, setForm] = useState({ course: '', level: '', semester: '', creditUnits: '' })
  const [generateOutline, setGenerateOutline] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const parsed = parseCourseInput(form.course)
  const codeOnly = !!parsed.courseCode && parsed.title === parsed.courseCode

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (path === 'outline' && !file) {
      setError('Choose your course outline file')
      return
    }
    setLoading(true)
    try {
      const course = await api.post<{ id: string }>('/courses', {
        title: parsed.title,
        courseCode: parsed.courseCode,
        level: Number(form.level),
        semester: form.semester,
        creditUnits: form.creditUnits ? Number(form.creditUnits) : undefined,
      })

      if (path === 'outline' && file) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('courseId', course.id)
        const doc = await api.upload<{ id: string; status: string }>('/documents/upload', formData).catch(() => null)
        // The course exists either way; the course page explains what to do if the file couldn't be read
        router.push(doc?.status === 'READY' ? `/courses/${course.id}?outline=${doc.id}` : `/courses/${course.id}?outline=failed`)
        return
      }

      router.push(generateOutline ? `/courses/${course.id}?generate=1` : `/courses/${course.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create course')
      setLoading(false)
    }
  }

  if (!path) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-heading text-2xl font-bold text-slate-900">New course</h1>
        <p className="text-slate-500 text-sm mt-1 mb-6">How would you like to add it?</p>
        <div className="space-y-3">
          {PATHS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              disabled={p.soon}
              onClick={() => !p.soon && setPath(p.id as Path)}
              className="card w-full p-5 text-left flex items-start gap-4 enabled:hover:-translate-y-0.5 enabled:hover:border-blue-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-heading font-bold text-sm flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-heading font-bold text-slate-900">
                  {p.title}
                  {p.soon && (
                    <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                      Coming soon
                    </span>
                  )}
                </span>
                <span className="block text-sm text-slate-500 mt-1">{p.desc}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-5">
          No syllabus? No problem. Nightklass can generate an editable course outline and study notes for you.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <button type="button" onClick={() => setPath(null)} className="text-sm text-blue-600 font-semibold">
        ← Other ways to add a course
      </button>
      <h1 className="font-heading text-2xl font-bold text-slate-900 mt-2 mb-6">
        {path === 'outline' ? 'Upload a course outline' : 'Add a course'}
      </h1>
      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

        <div>
          <label htmlFor="course" className="block text-sm font-medium text-slate-700 mb-1.5">
            Course code or title
          </label>
          <input
            id="course"
            required
            minLength={2}
            value={form.course}
            onChange={set('course')}
            placeholder="BIO 223 Biostatistics"
            disabled={loading}
            className="input-base"
          />
          {codeOnly ? (
            <p className="text-xs text-amber-700 mt-1.5">Add the course title too (e.g. {parsed.courseCode} Biostatistics) for better topic suggestions.</p>
          ) : parsed.courseCode ? (
            <p className="text-xs text-slate-400 mt-1.5">
              Code <span className="font-semibold text-slate-600">{parsed.courseCode}</span> · Title{' '}
              <span className="font-semibold text-slate-600">{parsed.title}</span>
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="level" className="block text-sm font-medium text-slate-700 mb-1.5">Level</label>
            <select id="level" required value={form.level} onChange={set('level')} disabled={loading} className="input-base">
              <option value="">Select</option>
              {LEVELS.map(l => (
                <option key={l} value={l}>
                  {l}L
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="semester" className="block text-sm font-medium text-slate-700 mb-1.5">Semester</label>
            <select id="semester" required value={form.semester} onChange={set('semester')} disabled={loading} className="input-base">
              <option value="">Select</option>
              <option value="FIRST">First</option>
              <option value="SECOND">Second</option>
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="creditUnits" className="block text-sm font-medium text-slate-700 mb-1.5">
              Credit units <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="creditUnits"
              type="number"
              min={0}
              max={12}
              value={form.creditUnits}
              onChange={set('creditUnits')}
              placeholder="3"
              disabled={loading}
              className="input-base"
            />
          </div>
        </div>

        {path === 'manual' && (
          <label className="flex items-start gap-3 bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={generateOutline}
              onChange={e => setGenerateOutline(e.target.checked)}
              disabled={loading}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">Generate a topic outline with AI</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                We&apos;ll suggest the topics this course usually covers. You review and edit them before anything is added.
              </span>
            </span>
          </label>
        )}

        {path === 'outline' && (
          <div>
            <label htmlFor="outline" className="block text-sm font-medium text-slate-700 mb-1.5">Course outline</label>
            <input
              id="outline"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              disabled={loading}
              className="text-sm"
            />
            <p className="text-xs text-slate-400 mt-1.5">PDF, Word or text. Scanned images and slides aren&apos;t supported yet.</p>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (path === 'outline' ? 'Creating & reading your outline…' : 'Creating…') : 'Create course'}
        </button>
      </form>
    </div>
  )
}
