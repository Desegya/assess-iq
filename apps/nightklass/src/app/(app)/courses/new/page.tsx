'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'
import { LEVELS, profileSummary, type AcademicProfile } from '@/lib/profile'

type Path = 'programme' | 'manual' | 'outline'

interface SuggestedCourse {
  courseCode?: string
  title: string
  creditUnits?: number
  level: number | null
  semester: 'FIRST' | 'SECOND' | null
}

// "BIO 223 Biostatistics", "BIO223 - Biostatistics", "Biostatistics" or just "BIO 223"
function parseCourseInput(raw: string): { courseCode?: string; title: string } {
  const value = raw.trim().replace(/\s+/g, ' ')
  const match = value.match(/^([A-Za-z]{2,4})\s?(\d{3}[A-Za-z]?)\b\s*[-–—:]?\s*(.*)$/)
  if (!match) return { title: value }
  const courseCode = `${match[1]!.toUpperCase()} ${match[2]!.toUpperCase()}`
  return { courseCode, title: match[3]?.trim() || courseCode }
}

const PATHS: { id: Path; title: string; desc: string }[] = [
  {
    id: 'programme',
    title: 'Choose from my programme',
    desc: 'See courses suggested for your department, level and semester.',
  },
  {
    id: 'manual',
    title: 'Add a course manually',
    desc: 'Enter a course code or title. No syllabus needed. We can draft the topics for you.',
  },
  {
    id: 'outline',
    title: 'Upload a course outline',
    desc: 'Upload, photograph or paste your syllabus and we’ll pull the topics out for you to confirm.',
  },
]

export default function NewCoursePage() {
  const router = useRouter()
  const api = useApi()

  const [path, setPath] = useState<Path | null>(null)
  const [profile, setProfile] = useState<AcademicProfile | null>(null)
  const [form, setForm] = useState({ course: '', level: '', semester: '', creditUnits: '' })
  const [generateOutline, setGenerateOutline] = useState(true)
  const [isCarryover, setIsCarryover] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestedCourse[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [suggesting, setSuggesting] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api
      .get<AcademicProfile>('/users/me/profile')
      .then(p => {
        setProfile(p)
        // Default new courses to the student's current level and semester
        setForm(f => ({
          ...f,
          level: f.level || (p.currentLevel ? String(p.currentLevel) : ''),
          semester: f.semester || (p.currentSemester ?? ''),
        }))
      })
      .catch(() => undefined)
    // Dashboard links deep-link straight into a path
    const initial = new URLSearchParams(window.location.search).get('path')
    if (initial === 'programme' || initial === 'manual' || initial === 'outline') setPath(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasProfile = !!profile?.profileCompletedAt

  useEffect(() => {
    if (path === 'programme' && hasProfile && suggestions === null && !suggesting) void loadSuggestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, hasProfile])

  async function loadSuggestions() {
    setError(null)
    setSuggesting(true)
    try {
      const result = await api.post<{ courses: SuggestedCourse[] }>('/study/course-suggestions', {})
      setSuggestions(result.courses)
      setSelected(new Set(result.courses.map((_, i) => i)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suggest courses')
    } finally {
      setSuggesting(false)
    }
  }

  function toggleSuggestion(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  async function handleAddSuggestions() {
    if (!suggestions) return
    setError(null)
    setLoading(true)
    try {
      for (const i of [...selected].sort((a, b) => a - b)) {
        const c = suggestions[i]!
        await api.post('/courses', {
          title: c.title,
          courseCode: c.courseCode,
          level: c.level ?? undefined,
          semester: c.semester ?? undefined,
          creditUnits: c.creditUnits,
        })
      }
      router.push('/courses')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add courses')
      setLoading(false)
    }
  }

  const parsed = parseCourseInput(form.course)
  // Spec §11: course level below the student's level suggests a carryover
  const levelMismatch = !!profile?.currentLevel && !!form.level && Number(form.level) < profile.currentLevel
  const codeOnly = !!parsed.courseCode && parsed.title === parsed.courseCode

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const course = await api.post<{ id: string }>('/courses', {
        title: parsed.title,
        courseCode: parsed.courseCode,
        level: Number(form.level),
        semester: form.semester,
        creditUnits: form.creditUnits ? Number(form.creditUnits) : undefined,
        isCarryover: levelMismatch && isCarryover,
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

      router.push(path === 'manual' && generateOutline ? `/courses/${course.id}?generate=1` : `/courses/${course.id}`)
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
              onClick={() => setPath(p.id)}
              className="card w-full p-5 text-left flex items-start gap-4 hover:-translate-y-0.5 hover:border-blue-300"
            >
              <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-heading font-bold text-sm flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-heading font-bold text-slate-900">{p.title}</span>
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

  if (path === 'programme') {
    return (
      <div className="max-w-2xl">
        <button type="button" onClick={() => setPath(null)} className="text-sm text-blue-600 font-semibold">
          ← Other ways to add a course
        </button>
        <h1 className="font-heading text-2xl font-bold text-slate-900 mt-2">Choose from my programme</h1>

        {profile && !hasProfile && (
          <div className="card p-6 mt-6">
            <p className="text-sm text-slate-600">
              Tell us your programme, level and semester first, and we&apos;ll suggest the courses you&apos;re likely taking.
            </p>
            <Link href="/onboarding" className="btn-primary inline-flex mt-4">
              Set up my profile
            </Link>
          </div>
        )}

        {hasProfile && (
          <>
            <p className="text-sm font-semibold text-blue-600 mt-1">{profileSummary(profile!)}</p>
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mt-4">
              AI suggestions based on courses commonly taken in your programme, not your school&apos;s official list. Course
              codes may differ at your school. Untick anything you&apos;re not taking.
            </p>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mt-4">{error}</div>}

            {suggesting && <p className="text-sm text-slate-400 mt-6">Finding courses for your programme…</p>}

            {suggestions && suggestions.length === 0 && (
              <p className="text-sm text-slate-500 mt-6">No new suggestions. You may already have them all.</p>
            )}

            {suggestions && suggestions.length > 0 && (
              <ul className="card divide-y divide-slate-100 mt-4">
                {suggestions.map((c, i) => (
                  <li key={i}>
                    <label className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-slate-50">
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSuggestion(i)} disabled={loading} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-slate-800">
                          {c.courseCode && <span className="text-blue-600 mr-1.5">{c.courseCode}</span>}
                          {c.title}
                        </span>
                      </span>
                      {c.creditUnits != null && <span className="text-xs text-slate-400 flex-shrink-0">{c.creditUnits} units</span>}
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-5">
              {suggestions && suggestions.length > 0 && (
                <button onClick={handleAddSuggestions} disabled={loading || selected.size === 0} className="btn-primary">
                  {loading ? 'Adding courses…' : `Add ${selected.size} course${selected.size === 1 ? '' : 's'}`}
                </button>
              )}
              <button type="button" onClick={() => setPath('manual')} disabled={loading} className="btn-secondary">
                Add a course that&apos;s not listed
              </button>
              {suggestions && (
                <button type="button" onClick={() => void loadSuggestions()} disabled={loading || suggesting} className="text-sm text-blue-600 font-semibold">
                  Suggest again
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-4">
              Taking an elective or carryover? Use &quot;Add a course that&apos;s not listed&quot;.
            </p>
          </>
        )}
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

        {levelMismatch && (
          <label className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isCarryover}
              onChange={e => setIsCarryover(e.target.checked)}
              disabled={loading}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">Is this a carryover course?</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                You&apos;re in {profile!.currentLevel} Level and this is a {form.level} Level course.
              </span>
            </span>
          </label>
        )}

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
              accept=".pdf,.doc,.docx,.pptx,.txt"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              disabled={loading}
              className="text-sm"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              PDF, Word, PowerPoint or text. Only have a printout? Skip this and take a photo or paste it on the next screen.
            </p>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (path === 'outline' ? 'Creating & reading your outline…' : 'Creating…') : 'Create course'}
        </button>
      </form>
    </div>
  )
}
