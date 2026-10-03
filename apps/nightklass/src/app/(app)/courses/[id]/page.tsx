'use client'

import { useEffect, useRef, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'
import { getSubjectColor } from '@/lib/subject-color'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { OutlineEditor } from '@/components/courses/OutlineEditor'
import { OutlineInput } from '@/components/courses/OutlineInput'
import { ProposalReview } from '@/components/courses/ProposalReview'
import type { ProposalSet, Topic, TopicProposal } from '@/components/courses/outline-types'

interface Course {
  id: string
  title: string
  subject: string
  description: string | null
  courseCode: string | null
  level: number | null
  semester: 'FIRST' | 'SECOND' | null
  isCarryover: boolean
  outlineText: string | null
  outlineSource: 'UPLOAD' | 'PASTE' | 'PHOTO' | null
  topics: Topic[]
}

const SEMESTER_LABEL = { FIRST: 'First semester', SECOND: 'Second semester' } as const
const OUTLINE_SOURCE_LABEL = { UPLOAD: 'uploaded file', PASTE: 'pasted text', PHOTO: 'photo' } as const

interface UploadedDocument {
  id: string
  status: string
  fileName: string
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

  const [proposalSet, setProposalSet] = useState<ProposalSet | null>(null)
  const [arrivalBusy, setArrivalBusy] = useState<string | null>(null)
  const [arrivalError, setArrivalError] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)

  const [uploadingNotes, setUploadingNotes] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)
  const [notesDoc, setNotesDoc] = useState<UploadedDocument | null>(null)
  const [extractingNotes, setExtractingNotes] = useState(false)

  const [days, setDays] = useState<DaySlot[]>(
    DAYS.map(() => ({ enabled: false, startTime: '18:00', endTime: '19:00' })),
  )
  const [examDate, setExamDate] = useState('')
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
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

  // Arriving from the New Course flow: ?generate=1 drafts an AI outline, ?outline=<docId> reads the uploaded
  // outline. The ref stops React strict mode from firing the AI call twice.
  const handledArrival = useRef(false)
  useEffect(() => {
    if (handledArrival.current) return
    handledArrival.current = true
    const params = new URLSearchParams(window.location.search)
    const outline = params.get('outline')
    if (!outline && !params.get('generate')) return
    router.replace(`/courses/${id}`)
    if (outline === 'failed') {
      setArrivalError("Your course is ready, but we couldn't read that outline. Try another file, paste it, or take a photo below.")
      return
    }
    setArrivalBusy(outline ? 'Reading your outline…' : 'Drafting an outline from the course title…')
    const request = outline
      ? api
          .post<{ source: 'ai' | 'fallback'; proposals: TopicProposal[] }>(`/study/courses/${id}/outline/document/${outline}`, {})
          .then(r => ({ source: 'OUTLINE' as const, proposals: r.proposals, fallback: r.source === 'fallback' }))
      : api
          .post<{ proposals: TopicProposal[] }>(`/study/courses/${id}/topics/suggest`, {})
          .then(r => ({ source: 'AI_SUGGESTED' as const, proposals: r.proposals }))
    request
      .then(setProposalSet)
      .catch(err => setArrivalError(err instanceof Error ? err.message : 'Something went wrong'))
      .finally(() => setArrivalBusy(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleNotesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setNotesError(null)
    setNotesDoc(null)
    setUploadingNotes(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('courseId', id)
      const doc = await api.upload<UploadedDocument>('/documents/upload', formData)
      if (doc.status !== 'READY') throw new Error("We couldn't read that file. Try a different one.")
      setNotesDoc(doc)
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingNotes(false)
    }
  }

  async function handleTopicsFromNotes() {
    if (!notesDoc) return
    setNotesError(null)
    setExtractingNotes(true)
    try {
      const r = await api.post<{ source: 'ai' | 'fallback'; proposals: TopicProposal[] }>(`/documents/${notesDoc.id}/extract-topics`, {})
      setProposalSet({ source: 'MATERIAL', proposals: r.proposals, fallback: r.source === 'fallback' })
      setNotesDoc(null)
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Failed to suggest topics')
    } finally {
      setExtractingNotes(false)
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
          {course.subject !== course.title && <p className="text-slate-500 text-sm mt-1">{course.subject}</p>}
          {(course.courseCode || course.level || course.semester || course.isCarryover) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {course.courseCode && <span className={`badge ${color.bgSoft} ${color.text}`}>{course.courseCode}</span>}
              {course.level && <span className="badge bg-slate-100 text-slate-600">{course.level}L</span>}
              {course.semester && <span className="badge bg-slate-100 text-slate-600">{SEMESTER_LABEL[course.semester]}</span>}
              {course.isCarryover && <span className="badge bg-amber-50 text-amber-700">Carryover</span>}
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

      {course.topics.some(t => !t.parentTopicId) && (
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
            <Link href={`/topics/${course.topics.find(t => !t.parentTopicId)!.id}/quiz`} className="btn-primary">
              Try a quick quiz
            </Link>
            <button
              onClick={() => handleGenerateFlashcards(course.topics.find(t => !t.parentTopicId)!.id)}
              disabled={generatingFlashcardsFor === course.topics.find(t => !t.parentTopicId)!.id}
              className="btn-secondary"
            >
              {generatingFlashcardsFor === course.topics.find(t => !t.parentTopicId)!.id ? 'Generating…' : 'Try flashcards'}
            </button>
          </div>
        </section>
      )}

      {/* Course outline: two layers — the student's original plus Nightklass enrichment */}
      <section className="card p-6">
        <h2 className="font-heading font-bold text-slate-900 mb-1">Course outline</h2>
        <p className="text-slate-400 text-sm mb-4">
          Your topics, in study order. Edit them anytime. Removing a topic you&apos;ve studied archives it, so your progress is kept.
        </p>

        {course.outlineText && course.outlineSource && (
          <div className="mb-4">
            <button onClick={() => setShowOriginal(v => !v)} className="text-xs font-semibold text-emerald-700">
              {showOriginal ? 'Hide' : 'View'} your original outline (from {OUTLINE_SOURCE_LABEL[course.outlineSource]})
            </button>
            {showOriginal && (
              <div className="mt-2 rounded-xl bg-emerald-50/50 border border-emerald-100 p-4">
                <p className="text-[11px] text-emerald-700 mb-2">Kept exactly as you provided it. AI never edits this.</p>
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 max-h-80 overflow-y-auto">{course.outlineText}</pre>
              </div>
            )}
          </div>
        )}

        {arrivalBusy && <p className="text-sm text-slate-400 mb-4">{arrivalBusy}</p>}
        {arrivalError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{arrivalError}</div>
        )}

        {proposalSet ? (
          <ProposalReview
            courseId={id}
            set={proposalSet}
            onSaved={() => {
              setProposalSet(null)
              load()
            }}
            onCancel={() => setProposalSet(null)}
          />
        ) : (
          <>
            {course.topics.length > 0 && (
              <div className="mb-6">
                <OutlineEditor
                  courseId={id}
                  topics={course.topics}
                  onChanged={load}
                  onFlashcards={handleGenerateFlashcards}
                  flashcardsBusyFor={generatingFlashcardsFor}
                />
                {flashcardError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mt-3">{flashcardError}</div>
                )}
              </div>
            )}
            {!arrivalBusy && (
              <div className={course.topics.length > 0 ? 'pt-5 border-t border-slate-100' : ''}>
                <OutlineInput courseId={id} hasTopics={course.topics.length > 0} onProposals={setProposalSet} />
              </div>
            )}
          </>
        )}
      </section>

      {/* Lecture notes & slides — grounding material for notes, chat and quizzes */}
      <section className="card p-6">
        <h2 className="font-heading font-bold text-slate-900 mb-1">Lecture notes &amp; slides</h2>
        <p className="text-slate-400 text-sm mb-4">
          Upload notes, slides, handouts or a textbook (PDF, Word, PowerPoint or text). Nightklass uses them for your study
          notes, quizzes and answers, so they match what your lecturer teaches.
        </p>
        {notesError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{notesError}</div>}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.pptx,.txt"
            onChange={handleNotesUpload}
            disabled={uploadingNotes}
            className="text-sm"
            aria-label="Lecture notes or slides"
          />
          {uploadingNotes && <span className="text-sm text-slate-400">Uploading & reading…</span>}
        </div>
        {notesDoc && !uploadingNotes && (
          <div className="mt-3 flex items-center gap-3 flex-wrap text-sm">
            <span className="text-emerald-700">✓ {notesDoc.fileName} added.</span>
            <button onClick={handleTopicsFromNotes} disabled={extractingNotes || !!proposalSet} className="btn-secondary !py-1.5 !px-3 text-xs">
              {extractingNotes ? 'Finding topics…' : 'Suggest topics from it'}
            </button>
          </div>
        )}
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
