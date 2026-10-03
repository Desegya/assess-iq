'use client'

import { useEffect, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'
import { getSubjectColor } from '@/lib/subject-color'
import { SkeletonCard } from '@/components/ui/Skeleton'

interface Topic {
  id: string
  name: string
  description: string | null
  estimatedMinutes: number | null
  order: number
}

interface Course {
  id: string
  title: string
  subject: string
  description: string | null
  courseCode: string | null
  level: number | null
  semester: 'FIRST' | 'SECOND' | null
  topics: Topic[]
}

const SEMESTER_LABEL = { FIRST: 'First semester', SECOND: 'Second semester' } as const

interface UploadedDocument {
  id: string
  status: string
  fileName: string
}

interface TopicProposal {
  name: string
  description?: string
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface DaySlot {
  enabled: boolean
  startTime: string
  endTime: string
}

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const api = useApi()
  const router = useRouter()

  const [course, setCourse] = useState<Course | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [topicForm, setTopicForm] = useState({ name: '', description: '', estimatedMinutes: '' })
  const [addingTopic, setAddingTopic] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [readyDoc, setReadyDoc] = useState<UploadedDocument | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [proposals, setProposals] = useState<TopicProposal[] | null>(null)
  const [proposalSource, setProposalSource] = useState<'ai' | 'fallback' | 'course' | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [savingProposals, setSavingProposals] = useState(false)

  const [days, setDays] = useState<DaySlot[]>(
    DAYS.map(() => ({ enabled: false, startTime: '18:00', endTime: '19:00' })),
  )
  const [examDate, setExamDate] = useState('')
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null);
  const [hasPlan, setHasPlan] = useState(false)
  const [generatingFlashcardsFor, setGeneratingFlashcardsFor] = useState<string | null>(null)
  const [flashcardError, setFlashcardError] = useState<string | null>(null)

  function load() {
    api
      .get<Course>(`/courses/${id}`)
      .then(setCourse)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load course'))
  }

  useEffect(() => {
    load()
    api
      .get(`/study/plans/current?courseId=${id}`)
      .then(() => setHasPlan(true))
      .catch(() => setHasPlan(false))
    api
      .get<{ dayOfWeek: number; startTime: string; endTime: string }[]>('/study/availability')
      .then(slots => {
        setDays(prev =>
          prev.map((d, i) => {
            const match = slots.find(s => s.dayOfWeek === i)
            return match ? { enabled: true, startTime: match.startTime, endTime: match.endTime } : d
          }),
        )
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleAddTopic(e: React.FormEvent) {
    e.preventDefault()
    setAddingTopic(true)
    try {
      await api.post(`/courses/${id}/topics`, {
        name: topicForm.name,
        description: topicForm.description || undefined,
        estimatedMinutes: topicForm.estimatedMinutes ? Number(topicForm.estimatedMinutes) : undefined,
      })
      setTopicForm({ name: '', description: '', estimatedMinutes: '' })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add topic')
    } finally {
      setAddingTopic(false)
    }
  }

  async function handleRemoveTopic(topicId: string) {
    await api.del(`/topics/${topicId}`).catch(() => undefined)
    load()
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    setReadyDoc(null)
    setProposals(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('courseId', id)
      const doc = await api.upload<UploadedDocument>('/documents/upload', formData)
      if (doc.status !== 'READY') {
        throw new Error('Document could not be processed — try a different file')
      }
      setReadyDoc(doc)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleExtractTopics() {
    if (!readyDoc) return
    setExtractError(null)
    setExtracting(true)
    try {
      const result = await api.post<{ source: 'ai' | 'fallback'; proposals: TopicProposal[] }>(
        `/documents/${readyDoc.id}/extract-topics`,
        {},
      )
      setProposals(result.proposals)
      setProposalSource(result.source)
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Failed to extract topics')
    } finally {
      setExtracting(false)
    }
  }

  async function handleSuggestTopics() {
    setExtractError(null)
    setSuggesting(true)
    try {
      const result = await api.post<{ source: 'ai'; proposals: TopicProposal[] }>(
        `/study/courses/${id}/topics/suggest`,
        {},
      )
      setProposals(result.proposals)
      setProposalSource('course')
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Failed to suggest topics')
    } finally {
      setSuggesting(false)
    }
  }

  function updateProposal(i: number, name: string) {
    setProposals(prev => (prev ? prev.map((p, idx) => (idx === i ? { ...p, name } : p)) : prev))
  }

  function removeProposal(i: number) {
    setProposals(prev => (prev ? prev.filter((_, idx) => idx !== i) : prev))
  }

  async function handleSaveProposals() {
    if (!proposals || proposals.length === 0) return
    setSavingProposals(true)
    try {
      for (const p of proposals) {
        await api.post(`/courses/${id}/topics`, { name: p.name, description: p.description })
      }
      setProposals(null)
      setReadyDoc(null)
      load()
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Failed to save topics')
    } finally {
      setSavingProposals(false)
    }
  }

  async function handleGeneratePlan(e: React.FormEvent) {
    e.preventDefault()
    setPlanError(null)
    setPlanLoading(true)
    try {
      const slots = days
        .map((d, i) => ({ ...d, dayOfWeek: i }))
        .filter(d => d.enabled)
        .map(d => ({ dayOfWeek: d.dayOfWeek, startTime: d.startTime, endTime: d.endTime }))

      if (slots.length === 0) {
        throw new Error('Select at least one available day')
      }
      if (!examDate) {
        throw new Error('Set your exam date')
      }

      await api.post('/study/availability', { slots })
      await api.post('/study/plans/generate', { courseId: id, examDate })
      router.push(`/courses/${id}/plan`)
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to generate plan')
    } finally {
      setPlanLoading(false)
    }
  }

  async function handleGenerateFlashcards(topicId: string) {
    setFlashcardError(null)
    setGeneratingFlashcardsFor(topicId)
    try {
      await api.post(`/study/topics/${topicId}/flashcards/generate`, { count: 8 })
      router.push('/flashcards')
    } catch (err) {
      setFlashcardError(err instanceof Error ? err.message : 'Failed to generate flashcards')
    } finally {
      setGeneratingFlashcardsFor(null)
    }
  }

  function toggleDay(i: number) {
    setDays(prev => prev.map((d, idx) => (idx === i ? { ...d, enabled: !d.enabled } : d)))
  }

  function updateDay(i: number, field: 'startTime' | 'endTime', value: string) {
    setDays(prev => prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d)))
  }

  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
  if (!course) return <div className="space-y-8"><SkeletonCard /><SkeletonCard /></div>

  const color = getSubjectColor(course.id)

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">{course.title}</h1>
          <p className="text-slate-500 text-sm mt-1">{course.subject}</p>
          {(course.courseCode || course.level || course.semester) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {course.courseCode && <span className={`badge ${color.bgSoft} ${color.text}`}>{course.courseCode}</span>}
              {course.level && <span className="badge bg-slate-100 text-slate-600">{course.level}L</span>}
              {course.semester && <span className="badge bg-slate-100 text-slate-600">{SEMESTER_LABEL[course.semester]}</span>}
            </div>
          )}
          {hasPlan && (
            <Link href={`/courses/${id}/plan`} className="inline-block mt-3 text-sm text-blue-600 font-semibold">
              View current study plan →
            </Link>
          )}
        </div>
        <Link href={`/courses/${id}/chat`} className="btn-secondary flex-shrink-0">
          💬 Ask AI about this course
        </Link>
      </div>

      {course.topics.length > 0 && (
        <section className={`card p-6 ${color.bgSoft} ${color.border}`}>
          <h2 className="font-heading font-bold text-slate-900 mb-1">Quick practice</h2>
          <p className="text-slate-500 text-sm mb-4">
            No need to wait for a full plan — try a quiz or flashcards right now.
          </p>
          {flashcardError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
              {flashcardError}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <Link href={`/topics/${course.topics[0]!.id}/quiz`} className="btn-primary">
              Try a quick quiz
            </Link>
            <button
              onClick={() => handleGenerateFlashcards(course.topics[0]!.id)}
              disabled={generatingFlashcardsFor === course.topics[0]!.id}
              className="btn-secondary"
            >
              {generatingFlashcardsFor === course.topics[0]!.id ? 'Generating…' : 'Try flashcards'}
            </button>
          </div>
        </section>
      )}

      {/* Upload material → extract topics */}
      <section className="card p-6">
        <h2 className="font-heading font-bold text-slate-900 mb-1">Upload course material</h2>
        <p className="text-slate-400 text-sm mb-4">
          Upload a course outline, notes, or textbook (PDF, DOCX, or TXT) and we&apos;ll suggest topics for you to review.
        </p>

        {uploadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{uploadError}</div>
        )}
        {!proposals && (
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleUpload}
              disabled={uploading}
              className="text-sm"
            />
            {uploading && <span className="text-sm text-slate-400">Uploading & extracting text…</span>}
            {readyDoc && !uploading && (
              <button onClick={handleExtractTopics} disabled={extracting} className="btn-secondary">
                {extracting ? 'Suggesting topics…' : `Suggest topics from ${readyDoc.fileName}`}
              </button>
            )}
          </div>
        )}
        {proposals && <p className="text-sm text-slate-500">Review the suggested topics below.</p>}
      </section>

      {/* Topics */}
      <section className="card p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="font-heading font-bold text-slate-900">Topics</h2>
          {!proposals && (
            <button onClick={handleSuggestTopics} disabled={suggesting} className="btn-secondary text-sm">
              {suggesting ? 'Suggesting topics…' : '✨ Suggest topics with AI'}
            </button>
          )}
        </div>

        {extractError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{extractError}</div>
        )}

        {proposals && (
          <div className="space-y-3 mb-6">
            {proposalSource === 'course' && (
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                Suggested from how this course is usually taught — not your official course outline. Edit or remove
                anything that doesn&apos;t match before adding.
              </p>
            )}
            {proposalSource === 'fallback' && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Using basic section-splitting for now (no AI key configured yet) — feel free to edit these before adding.
              </p>
            )}
            <ul className="space-y-2">
              {proposals.map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    value={p.name}
                    onChange={e => updateProposal(i, e.target.value)}
                    className="input-base flex-1"
                  />
                  <button onClick={() => removeProposal(i)} className="text-xs text-red-500 flex-shrink-0">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3">
              <button onClick={handleSaveProposals} disabled={savingProposals} className="btn-primary">
                {savingProposals ? 'Adding…' : `Add ${proposals.length} topic(s)`}
              </button>
              <button
                onClick={() => {
                  setProposals(null)
                  setReadyDoc(null)
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {course.topics.length === 0 && !proposals && (
          <p className="text-slate-400 text-sm mb-4">
            No topics yet. No course outline? Let AI suggest topics from the course title, upload your material above,
            or add them yourself below.
          </p>
        )}

        <ul className="space-y-2 mb-4">
          {course.topics.map(topic => (
            <li key={topic.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{topic.name}</p>
                {topic.description && <p className="text-xs text-slate-400 mt-0.5">{topic.description}</p>}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-slate-400">{topic.estimatedMinutes ?? 45} min</span>
                <Link href={`/topics/${topic.id}/notes`} className="text-xs text-blue-600 font-semibold">
                  Notes
                </Link>
                <Link href={`/topics/${topic.id}/quiz`} className="text-xs text-blue-600 font-semibold">
                  Self-quiz
                </Link>
                <button
                  onClick={() => handleGenerateFlashcards(topic.id)}
                  disabled={generatingFlashcardsFor === topic.id}
                  className="text-xs text-blue-600 font-semibold disabled:opacity-60"
                >
                  {generatingFlashcardsFor === topic.id ? 'Generating…' : 'Flashcards'}
                </button>
                <button onClick={() => handleRemoveTopic(topic.id)} className="text-xs text-red-500">
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={handleAddTopic} className="flex flex-wrap gap-2">
          <input
            required
            placeholder="Topic name"
            value={topicForm.name}
            onChange={e => setTopicForm(f => ({ ...f, name: e.target.value }))}
            className="input-base flex-1 min-w-[160px]"
          />
          <input
            placeholder="Description (optional)"
            value={topicForm.description}
            onChange={e => setTopicForm(f => ({ ...f, description: e.target.value }))}
            className="input-base flex-1 min-w-[160px]"
          />
          <input
            type="number"
            placeholder="Minutes"
            value={topicForm.estimatedMinutes}
            onChange={e => setTopicForm(f => ({ ...f, estimatedMinutes: e.target.value }))}
            className="input-base w-28"
          />
          <button type="submit" disabled={addingTopic} className="btn-secondary">
            {addingTopic ? 'Adding…' : '+ Add topic'}
          </button>
        </form>
      </section>

      {/* Study setup */}
      <section className="card p-6">
        <h2 className="font-heading font-bold text-slate-900 mb-1">Study setup</h2>
        <p className="text-slate-400 text-sm mb-4">Set when you can study and your exam date, then generate a plan.</p>

        <form onSubmit={handleGeneratePlan} className="space-y-4">
          {planError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{planError}</div>}

          <div className="space-y-2">
            {DAYS.map((label, i) => (
              <div key={label} className="flex items-center gap-3">
                <label className="flex items-center gap-2 w-20">
                  <input type="checkbox" checked={days[i]!.enabled} onChange={() => toggleDay(i)} />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
                <input
                  type="time"
                  value={days[i]!.startTime}
                  onChange={e => updateDay(i, 'startTime', e.target.value)}
                  disabled={!days[i]!.enabled}
                  className="input-base py-1.5 w-32"
                />
                <span className="text-slate-400 text-sm">to</span>
                <input
                  type="time"
                  value={days[i]!.endTime}
                  onChange={e => updateDay(i, 'endTime', e.target.value)}
                  disabled={!days[i]!.enabled}
                  className="input-base py-1.5 w-32"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Exam date</label>
            <input
              type="date"
              required
              value={examDate}
              onChange={e => setExamDate(e.target.value)}
              className="input-base w-48"
            />
          </div>

          <button type="submit" disabled={planLoading} className="btn-primary">
            {planLoading ? 'Generating…' : hasPlan ? 'Regenerate study plan' : 'Generate study plan'}
          </button>
        </form>
      </section>
    </div>
  )
}
