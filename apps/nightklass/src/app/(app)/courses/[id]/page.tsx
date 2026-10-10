'use client'

import { useEffect, useRef, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/product/Icon'
import { useApi } from '@/hooks/use-api'
import { getSubjectColor } from '@/lib/subject-color'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { OutlineEditor } from '@/components/courses/OutlineEditor'
import { OutlineInput } from '@/components/courses/OutlineInput'
import { ProposalReview } from '@/components/courses/ProposalReview'
import { EditCourseForm } from '@/components/courses/EditCourseForm'
import type { ProposalSet, Topic, TopicProposal } from '@/components/courses/outline-types'

interface Course {
  id: string
  title: string
  subject: string
  description: string | null
  courseCode: string | null
  level: number | null
  semester: 'FIRST' | 'SECOND' | null
  creditUnits: number | null
  isCarryover: boolean
  outlineText: string | null
  outlineSource: 'UPLOAD' | 'PASTE' | 'PHOTO' | null
  topics: Topic[]
}

const SEMESTER_LABEL = { FIRST: 'First semester', SECOND: 'Second semester' } as const
const OUTLINE_SOURCE_LABEL = {
  UPLOAD: 'uploaded file',
  PASTE: 'pasted text',
  PHOTO: 'photo',
} as const

interface UploadedDocument {
  id: string
  status: string
  fileName: string
}

interface DocumentMap {
  documentId: string
  fileName: string
  covered: { topicId: string; name: string; passages: number }[]
  newTopics: { name: string; description?: string }[]
}

interface Readiness {
  score: number
  label: string
  mastery: number
  coverage: number
  retention: number | null
  daysToExam: number | null
  topics: {
    topicId: string
    name: string
    mastery: number | null
    status: 'strong' | 'ok' | 'weak' | 'not-quizzed' | 'not-started'
  }[]
}

const READINESS_STATUS = {
  strong: { label: 'Strong', className: 'bg-emerald-50 text-emerald-700' },
  ok: { label: 'OK', className: 'bg-violet-50 text-violet-700' },
  weak: { label: 'Weak', className: 'bg-red-50 text-red-700' },
  'not-quizzed': { label: 'Not quizzed', className: 'bg-slate-100 text-slate-600' },
  'not-started': { label: 'Not started', className: 'bg-slate-100 text-slate-400' },
} as const

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
  const [editing, setEditing] = useState(false)

  const [uploadingNotes, setUploadingNotes] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)
  const [notesMap, setNotesMap] = useState<DocumentMap | null>(null)
  const [addingNewTopics, setAddingNewTopics] = useState(false)

  const [days, setDays] = useState<DaySlot[]>(
    DAYS.map(() => ({ enabled: false, startTime: '18:00', endTime: '19:00' })),
  )
  const [examDate, setExamDate] = useState('')
  // Default to a semester-length plan: most students don't know their exam date when they start
  const [planLength, setPlanLength] = useState<'semester' | '5' | '10' | 'custom' | 'exam'>(
    'semester',
  )
  const [customWeeks, setCustomWeeks] = useState('8')
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [hasPlan, setHasPlan] = useState(false)
  const [generatingFlashcardsFor, setGeneratingFlashcardsFor] = useState<string | null>(null)
  const [flashcardError, setFlashcardError] = useState<string | null>(null)

  function load() {
    api
      .get<Course>(`/courses/${id}`)
      .then(setCourse)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load course'))
  }

  useEffect(() => {
    load()
    api
      .get<Readiness>(`/study/courses/${id}/readiness`)
      .then(setReadiness)
      .catch(() => undefined)
    api
      .get(`/study/plans/current?courseId=${id}`)
      .then(() => setHasPlan(true))
      .catch(() => setHasPlan(false))
    api
      .get<{ dayOfWeek: number; startTime: string; endTime: string }[]>('/study/availability')
      .then((slots) => {
        setDays((prev) =>
          prev.map((d, i) => {
            const match = slots.find((s) => s.dayOfWeek === i)
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
      setArrivalError(
        "Your course is ready, but we couldn't read that outline. Try another file, paste it, or take a photo below.",
      )
      return
    }
    setArrivalBusy(outline ? 'Reading your outline…' : 'Drafting an outline from the course title…')
    const request = outline
      ? api
          .post<{
            source: 'ai' | 'fallback'
            proposals: TopicProposal[]
          }>(`/study/courses/${id}/outline/document/${outline}`, {})
          .then((r) => ({
            source: 'OUTLINE' as const,
            proposals: r.proposals,
            fallback: r.source === 'fallback',
          }))
      : api
          .post<{ proposals: TopicProposal[] }>(`/study/courses/${id}/topics/suggest`, {})
          .then((r) => ({ source: 'AI_SUGGESTED' as const, proposals: r.proposals }))
    request
      .then(setProposalSet)
      .catch((err) => setArrivalError(err instanceof Error ? err.message : 'Something went wrong'))
      .finally(() => setArrivalBusy(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Upload notes, then link them to the outline and surface topics they add (spec §16)
  async function handleNotesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setNotesError(null)
    setNotesMap(null)
    setUploadingNotes(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('courseId', id)
      const doc = await api.upload<UploadedDocument>('/documents/upload', formData)
      if (doc.status !== 'READY')
        throw new Error("We couldn't read that file. Try a different one.")
      setNotesMap(await api.post<DocumentMap>(`/learning/documents/${doc.id}/map`, {}))
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingNotes(false)
    }
  }

  async function handleAddNewTopics(topics: DocumentMap['newTopics']) {
    setAddingNewTopics(true)
    try {
      await api.post(`/courses/${id}/topics/bulk`, { source: 'MATERIAL', topics })
      setNotesMap((m) =>
        m ? { ...m, newTopics: m.newTopics.filter((t) => !topics.includes(t)) } : m,
      )
      load()
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Failed to add topics')
    } finally {
      setAddingNewTopics(false)
    }
  }

  async function handleGeneratePlan(e: React.FormEvent) {
    e.preventDefault()
    setPlanError(null)
    setPlanLoading(true)
    try {
      const slots = days
        .map((d, i) => ({ ...d, dayOfWeek: i }))
        .filter((d) => d.enabled)
        .map((d) => ({ dayOfWeek: d.dayOfWeek, startTime: d.startTime, endTime: d.endTime }))

      if (slots.length === 0) {
        throw new Error('Select at least one available day')
      }
      const weeks =
        planLength === 'exam'
          ? undefined
          : planLength === 'semester'
            ? 13
            : Number(planLength === 'custom' ? customWeeks : planLength)
      if (planLength === 'exam' && !examDate) throw new Error('Set your exam date')
      if (weeks !== undefined && (!Number.isInteger(weeks) || weeks < 1 || weeks > 52)) {
        throw new Error('Choose between 1 and 52 weeks')
      }

      await api.post('/study/availability', { slots })
      await api.post('/study/plans/generate', {
        courseId: id,
        ...(weeks ? { weeks } : { examDate }),
      })
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
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, enabled: !d.enabled } : d)))
  }

  function updateDay(i: number, field: 'startTime' | 'endTime', value: string) {
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d)))
  }

  if (error)
    return (
      <div
        role="alert"
        className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
      >
        {error}
      </div>
    )
  if (!course)
    return (
      <div className="space-y-8">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )

  const color = getSubjectColor(course.id)

  return (
    <div className="space-y-8">
      <Link
        href="/courses"
        className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-violet-700"
      >
        <Icon name="back" className="h-4 w-4" />
        My courses
      </Link>
      {editing ? (
        <EditCourseForm
          course={course}
          onSaved={() => {
            setEditing(false)
            load()
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-2xl font-bold text-slate-900">{course.title}</h1>
            {course.subject !== course.title && (
              <p className="text-slate-500 text-sm mt-1">{course.subject}</p>
            )}
            {(course.courseCode ||
              course.level ||
              course.semester ||
              course.creditUnits != null ||
              course.isCarryover) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {course.courseCode && (
                  <span className={`badge ${color.bgSoft} ${color.text}`}>{course.courseCode}</span>
                )}
                {course.level && (
                  <span className="badge bg-slate-100 text-slate-600">{course.level}L</span>
                )}
                {course.semester && (
                  <span className="badge bg-slate-100 text-slate-600">
                    {SEMESTER_LABEL[course.semester]}
                  </span>
                )}
                {course.creditUnits != null && (
                  <span className="badge bg-slate-100 text-slate-600">
                    {course.creditUnits} units
                  </span>
                )}
                {course.isCarryover && (
                  <span className="badge bg-amber-50 text-amber-700">Carryover</span>
                )}
              </div>
            )}
            {hasPlan && (
              <Link
                href={`/courses/${id}/plan`}
                className="inline-block mt-3 text-sm text-violet-600 font-semibold"
              >
                View current study plan →
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setEditing(true)} className="btn-secondary">
              <Icon name="edit" className="h-4 w-4" />
              Edit course
            </button>
            <Link href={`/courses/${id}/chat`} className="btn-secondary">
              <Icon name="chat" className="h-4 w-4" />
              Ask AI
            </Link>
          </div>
        </div>
      )}

      <nav
        aria-label="Course sections"
        className="flex flex-wrap gap-2 border-b border-[#eae6ef] pb-4 text-xs font-medium text-slate-500"
      >
        {[
          ['outline', 'Course outline'],
          ['materials', 'Study materials'],
          ['setup', 'Study setup'],
        ].map(([anchor, label]) => (
          <a
            key={anchor}
            href={`#${anchor}`}
            className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 hover:bg-violet-50 hover:text-violet-700"
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        {course.topics.some((t) => !t.parentTopicId) && (
          <section className="rounded-[20px] border border-[#e7dafb] bg-[#f7f2ff] p-6">
            <h2 className="font-heading font-bold text-slate-900 mb-1">Quick practice</h2>
            <p className="text-slate-500 text-sm mb-4">
              No need to wait for a full plan. Start the first lesson, or test yourself right now.
            </p>
            {flashcardError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4"
              >
                {flashcardError}
              </div>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href={`/topics/${course.topics.find((t) => !t.parentTopicId)!.id}/learn`}
                className="btn-primary"
              >
                <Icon name="book" />
                Start learning
              </Link>
              <Link
                href={`/topics/${course.topics.find((t) => !t.parentTopicId)!.id}/quiz`}
                className="btn-secondary"
              >
                <Icon name="target" />
                Try a quick quiz
              </Link>
              <button
                onClick={() =>
                  handleGenerateFlashcards(course.topics.find((t) => !t.parentTopicId)!.id)
                }
                disabled={
                  generatingFlashcardsFor === course.topics.find((t) => !t.parentTopicId)!.id
                }
                className="btn-secondary"
              >
                {generatingFlashcardsFor === course.topics.find((t) => !t.parentTopicId)!.id
                  ? 'Generating…'
                  : 'Try flashcards'}
              </button>
            </div>
          </section>
        )}

        {readiness && readiness.topics.length > 0 && (
          <section className="card p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-heading font-bold text-slate-900">Exam readiness</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {readiness.label}
                  {readiness.daysToExam !== null &&
                    ` · ${readiness.daysToExam} day${readiness.daysToExam === 1 ? '' : 's'} to go`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-heading text-3xl font-bold text-slate-900">{readiness.score}%</p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-slate-100 mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full ${readiness.score >= 70 ? 'bg-emerald-500' : readiness.score >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
                style={{ width: `${readiness.score}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Mastery {readiness.mastery}% · Covered {readiness.coverage}%
              {readiness.retention !== null && ` · Flashcard retention ${readiness.retention}%`}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {readiness.topics.map((t) => (
                <Link
                  key={t.topicId}
                  href={
                    t.status === 'weak' || t.status === 'not-started'
                      ? `/topics/${t.topicId}/learn`
                      : `/topics/${t.topicId}/quiz`
                  }
                  className={`badge ${READINESS_STATUS[t.status].className} hover:opacity-80`}
                  title={READINESS_STATUS[t.status].label}
                >
                  {t.name}
                  {t.mastery !== null && ` · ${Math.round(t.mastery)}%`}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Course outline: two layers — the student's original plus Nightklass enrichment */}
      <section id="outline" className="card scroll-mt-24 p-6">
        <h2 className="font-heading font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Icon name="book" className="h-5 w-5 text-violet-700" />
          Course outline
        </h2>
        <p className="text-slate-400 text-sm mb-4">
          Your topics, in study order. Edit them anytime. Removing a topic you&apos;ve studied
          archives it, so your progress is kept.
        </p>

        {course.outlineText && course.outlineSource && (
          <div className="mb-4">
            <button
              onClick={() => setShowOriginal((v) => !v)}
              className="text-xs font-semibold text-emerald-700"
            >
              {showOriginal ? 'Hide' : 'View'} your original outline (from{' '}
              {OUTLINE_SOURCE_LABEL[course.outlineSource]})
            </button>
            {showOriginal && (
              <div className="mt-2 rounded-xl bg-emerald-50/50 border border-emerald-100 p-4">
                <p className="text-[11px] text-emerald-700 mb-2">
                  Kept exactly as you provided it. AI never edits this.
                </p>
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 max-h-80 overflow-y-auto">
                  {course.outlineText}
                </pre>
              </div>
            )}
          </div>
        )}

        {arrivalBusy && <p className="text-sm text-slate-400 mb-4">{arrivalBusy}</p>}
        {arrivalError && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4"
          >
            {arrivalError}
          </div>
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
                  <div
                    role="alert"
                    className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mt-3"
                  >
                    {flashcardError}
                  </div>
                )}
              </div>
            )}
            {!arrivalBusy && (
              <div className={course.topics.length > 0 ? 'pt-5 border-t border-slate-100' : ''}>
                <OutlineInput
                  courseId={id}
                  hasTopics={course.topics.length > 0}
                  onProposals={setProposalSet}
                />
              </div>
            )}
          </>
        )}
      </section>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        {/* Lecture notes & slides — grounding material for notes, chat and quizzes */}
        <section id="materials" className="card scroll-mt-24 p-6">
          <h2 className="font-heading font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Icon name="upload" className="h-5 w-5 text-violet-700" />
            Lecture notes &amp; slides
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Upload notes, slides, handouts or a textbook (PDF, Word, PowerPoint or text). Nightklass
            uses them for your study notes, quizzes and answers, so they match what your lecturer
            teaches.
          </p>
          {notesError && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4"
            >
              {notesError}
            </div>
          )}
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
          {notesMap && !uploadingNotes && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 space-y-3 text-sm">
              <p className="text-emerald-700 font-semibold">✓ {notesMap.fileName} added</p>
              {notesMap.covered.length > 0 ? (
                <div>
                  <p className="text-xs text-slate-500 mb-1.5">
                    Linked to your outline. Lessons and quizzes for these topics will use it:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {notesMap.covered.map((c) => (
                      <span key={c.topicId} className="badge bg-emerald-50 text-emerald-700">
                        {c.name} · {c.passages} passage{c.passages === 1 ? '' : 's'}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  It didn&apos;t clearly match any topic in your outline yet.
                </p>
              )}
              {notesMap.newTopics.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1.5">
                    It also covers topics that aren&apos;t in your outline:
                  </p>
                  <ul className="space-y-1.5">
                    {notesMap.newTopics.map((t) => (
                      <li key={t.name} className="flex items-center justify-between gap-3">
                        <span>
                          <span className="font-semibold text-slate-800">{t.name}</span>
                          {t.description && (
                            <span className="text-xs text-slate-500"> · {t.description}</span>
                          )}
                        </span>
                        <button
                          onClick={() => void handleAddNewTopics([t])}
                          disabled={addingNewTopics}
                          className="text-xs font-semibold text-violet-600 flex-shrink-0"
                        >
                          + Add
                        </button>
                      </li>
                    ))}
                  </ul>
                  {notesMap.newTopics.length > 1 && (
                    <button
                      onClick={() => void handleAddNewTopics(notesMap.newTopics)}
                      disabled={addingNewTopics}
                      className="btn-secondary !py-1.5 !px-3 text-xs mt-2"
                    >
                      {addingNewTopics ? 'Adding…' : `Add all ${notesMap.newTopics.length}`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Study setup */}
        <section id="setup" className="card scroll-mt-24 p-6">
          <h2 className="font-heading font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Icon name="calendar" className="h-5 w-5 text-violet-700" />
            Study setup
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Set when you can study and your exam date, then generate a plan.
          </p>

          <form onSubmit={handleGeneratePlan} className="space-y-4">
            {planError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
              >
                {planError}
              </div>
            )}

            <div className="space-y-2">
              {DAYS.map((label, i) => (
                <div
                  key={label}
                  className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-[#f0ebf5] pb-3 sm:grid-cols-[54px_minmax(0,1fr)_auto_minmax(0,1fr)] sm:border-0 sm:pb-0"
                >
                  <label className="col-span-3 flex min-h-9 items-center gap-2 min-w-0 sm:col-span-1">
                    <input
                      type="checkbox"
                      checked={days[i]!.enabled}
                      onChange={() => toggleDay(i)}
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                  <input
                    type="time"
                    aria-label={`${label} study start time`}
                    value={days[i]!.startTime}
                    onChange={(e) => updateDay(i, 'startTime', e.target.value)}
                    disabled={!days[i]!.enabled}
                    className="input-base !px-2 py-1.5 w-full"
                  />
                  <span className="text-slate-400 text-sm">to</span>
                  <input
                    type="time"
                    aria-label={`${label} study end time`}
                    value={days[i]!.endTime}
                    onChange={(e) => updateDay(i, 'endTime', e.target.value)}
                    disabled={!days[i]!.enabled}
                    className="input-base !px-2 py-1.5 w-full"
                  />
                </div>
              ))}
            </div>

            <div>
              <p className="block text-sm font-medium text-slate-700 mb-1.5">Plan length</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['semester', 'This semester (13 weeks)'],
                    ['5', '5 weeks'],
                    ['10', '10 weeks'],
                    ['custom', 'Custom'],
                    ['exam', 'I know my exam date'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={planLength === value}
                    onClick={() => setPlanLength(value)}
                    className={`text-xs font-semibold rounded-xl px-3 py-2 transition-colors ${
                      planLength === value
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {planLength === 'exam' && (
                <div className="mt-3">
                  <label htmlFor="examDate" className="block text-xs text-slate-500 mb-1">
                    Exam date
                  </label>
                  <input
                    id="examDate"
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="input-base w-48"
                  />
                </div>
              )}
              {planLength === 'custom' && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={customWeeks}
                    onChange={(e) => setCustomWeeks(e.target.value)}
                    aria-label="Number of weeks"
                    className="input-base w-24"
                  />
                  <span className="text-sm text-slate-500">weeks</span>
                </div>
              )}
              <p className="text-xs text-slate-400 mt-2">
                {planLength === 'exam'
                  ? 'The plan ends on your exam day, with the final stretch saved for revision.'
                  : "Don't know your exam date yet? That's fine. Add it on your plan whenever it's announced and the plan adjusts to it."}{' '}
                Weak topics get more time, and spaced reviews keep earlier topics fresh.
              </p>
            </div>

            <button type="submit" disabled={planLoading} className="btn-primary">
              {planLoading
                ? 'Generating…'
                : hasPlan
                  ? 'Regenerate study plan'
                  : 'Generate study plan'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
