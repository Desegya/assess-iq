'use client'

import { ExamCalendarCard } from './ExamCalendarCard'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
import { PageHeader } from '@/components/product/PageHeader'

type Exam = 'JAMB' | 'WAEC'
interface Goal {
  id: string
  series: string
  exam: Exam
  year: number
  subjects: { name: string; subjectKey: string; courseId: string }[]
}
// Suggestions are shortcuts, not an official subject catalogue or admission eligibility advice.
const SUGGESTIONS = [
  'Mathematics',
  'Biology',
  'Chemistry',
  'Physics',
  'Literature in English',
  'Government',
  'Economics',
  'Commerce',
  'Financial Accounting',
  'Geography',
  'History',
  'Christian Religious Studies',
  'Islamic Studies',
  'Agricultural Science',
  'French',
  'Yoruba',
  'Igbo',
  'Hausa',
]

export function ExamPreparationWorkspace() {
  const api = useApi()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exam, setExam] = useState<Exam>('JAMB')
  const [series, setSeries] = useState('GENERAL')
  const [year, setYear] = useState(new Date().getFullYear() + 1)
  const [subjects, setSubjects] = useState<string[]>(['Use of English'])
  const [custom, setCustom] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [unavailable, setUnavailable] = useState('')
  useEffect(() => {
    api
      .get<{ available: boolean; message: string | null }>('/exam-preparation/access')
      .then((access) => {
        if (!access.available) {
          setUnavailable(access.message ?? 'WAEC and JAMB preparation is not available on your account yet.')
          return
        }
        return api.get<Goal[]>('/exam-preparation/goals').then(setGoals)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load exam goals'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function add(name: string) {
    const value = name.trim().replace(/\s+/g, ' ')
    if (value.length < 2) return
    if (!subjects.some((s) => s.toLowerCase() === value.toLowerCase()))
      setSubjects((s) => [...s, value])
    setCustom('')
  }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const saved = await api.put<Goal>('/exam-preparation/goals', { exam, year, subjects, series })
      setGoals((old) => [saved, ...old.filter((g) => g.id !== saved.id)])
      setMessage(
        'Your subjects are ready. Open a subject to add an outline or notes and start learning.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your exam setup')
    } finally {
      setSaving(false)
    }
  }
  if (unavailable)
    return (
      <section className="card mx-auto max-w-2xl space-y-3 p-6">
        <h1 className="text-xl font-semibold">WAEC and JAMB preparation</h1>
        <p role="status" className="text-sm text-slate-600">
          {unavailable}
        </p>
      </section>
    )
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your exam preparation"
        icon="spark"
        title="WAEC & JAMB"
        description="Build your subject list, study with your materials, and practise what you learn."
        action={
          <Link href="/onboarding" className="btn-secondary">
            Edit profile
          </Link>
        }
      />
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
          {message}
        </p>
      )}
      {loading ? (
        <p role="status">Loading your exams…</p>
      ) : (
        goals.map((goal) => (
          <section key={goal.id} className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                {goal.exam} {goal.year}
              </h2>
              <div className="flex flex-wrap gap-2">
                <Link
                  className="btn-primary"
                  href={`/exam-preparation/mocks?goal=${goal.id}&exam=${goal.exam}`}
                >
                  {goal.exam === 'WAEC' ? 'WAEC paper mocks' : 'Timed mock'}
                </Link>
                <button
                  className="btn-secondary"
                  disabled={saving}
                  onClick={() => {
                    setExam(goal.exam)
                    setSeries(goal.series)
                    setYear(goal.year)
                    setSubjects(goal.subjects.map((s) => s.name))
                    setMessage(
                      'Editing your subject choices below. Previous learning progress is preserved.',
                    )
                    document.getElementById('exam-setup')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  Edit subjects
                </button>
              </div>
            </div>
            <ExamCalendarCard
              key={`${goal.id}:${goal.series}:${goal.subjects.map((s) => s.subjectKey).join(',')}`}
              goalId={goal.id}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {goal.subjects.map((s) => (
                <div key={s.subjectKey}>
                  <Link
                    className="block rounded-xl border border-violet-100 p-4 hover:bg-violet-50"
                    href={`/courses/${s.courseId}`}
                  >
                    <span className="font-semibold">
                      {goal.exam === 'JAMB' && s.subjectKey === 'english'
                        ? 'Use of English'
                        : s.name}
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      Open lessons, upload notes, and practise →
                    </span>
                  </Link>
                  <Link
                    href={`/exam-preparation/practice?goal=${goal.id}&subject=${encodeURIComponent(s.subjectKey)}`}
                    className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-violet-700"
                  >
                    Teacher notes & reviewed practice →
                  </Link>
                  <Link
                    className="ml-3 inline-flex min-h-11 items-center text-sm font-medium text-violet-700"
                    href={`/exam-preparation/syllabus?goal=${goal.id}&subject=${encodeURIComponent(s.subjectKey)}`}
                  >
                    Syllabus & coverage →
                  </Link>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
      <form id="exam-setup" onSubmit={save} className="card space-y-5 p-6">
        <h2 className="text-xl font-semibold">Set up an exam goal</h2>
        <p className="text-sm text-slate-500">
          Preparing for both? Save each exam separately. Shared subjects reuse your learning
          workspace.
        </p>
        <fieldset disabled={saving || loading} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="exam" className="mb-2 block text-sm font-medium">
                Exam
              </label>
              <select
                id="exam"
                className="input-base"
                value={exam}
                onChange={(e) => {
                  setExam(e.target.value as Exam)
                  setSeries(e.target.value === 'JAMB' ? 'GENERAL' : 'SCHOOL')
                  setSubjects([e.target.value === 'JAMB' ? 'Use of English' : 'English Language'])
                  setMessage('')
                }}
              >
                <option value="JAMB">JAMB / UTME</option>
                <option value="WAEC">WAEC / WASSCE</option>
              </select>
            </div>
            <div>
              <label htmlFor="exam-year" className="mb-2 block text-sm font-medium">
                Exam year
              </label>
              <input
                id="exam-year"
                className="input-base"
                type="number"
                required
                min={2026}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
          </div>
          {exam === 'WAEC' && (
            <label className="block text-sm font-medium" htmlFor="waec-series">
              WAEC series
              <select
                id="waec-series"
                className="input-base mt-2"
                value={series}
                onChange={(e) => setSeries(e.target.value)}
              >
                <option value="SCHOOL">School candidates</option>
                <option value="PRIVATE_FIRST">Private candidates, first series</option>
                <option value="PRIVATE_SECOND">Private candidates, second series</option>
              </select>
            </label>
          )}
          <p className="text-sm text-slate-600">
            {exam === 'JAMB'
              ? 'Choose Use of English and three other subjects. Confirm your combination against the requirements for your intended course.'
              : 'Choose the subjects you are preparing for. Confirm the required subjects with your school or the applicable WAEC guidance.'}
          </p>
          <div className="flex flex-wrap gap-2" aria-label="Selected subjects">
            {subjects.map((name) => (
              <button
                type="button"
                className="rounded-full bg-violet-100 px-4 py-2 text-sm text-violet-900"
                key={name}
                onClick={() => setSubjects((old) => old.filter((s) => s !== name))}
                aria-label={`Remove ${name}`}
              >
                {name} ×
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {['English Language', ...SUGGESTIONS].map((name) => (
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm hover:bg-violet-50"
                key={name}
                onClick={() => add(name)}
              >
                + {name}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="custom-subject" className="mb-2 block text-sm font-medium">
              Add any other subject
            </label>
            <div className="flex gap-2">
              <input
                id="custom-subject"
                className="input-base"
                value={custom}
                maxLength={100}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Enter a subject name"
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => add(custom)}
                disabled={custom.trim().length < 2}
              >
                Add
              </button>
            </div>
          </div>
          <button className="btn-primary" disabled={subjects.length === 0}>
            {saving ? 'Saving…' : 'Save exam and subjects'}
          </button>
        </fieldset>
        <p className="text-xs leading-relaxed text-slate-500">
          These subject suggestions are setup shortcuts. AI-generated outlines are practice aids.
          Timed mocks become available when a verified paper specification and sufficient reviewed
          questions are published.
        </p>
      </form>
    </div>
  )
}
