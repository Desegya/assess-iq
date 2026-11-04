'use client'

import { useEffect, useRef, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/product/Icon'
import { ReadingText } from '@/components/product/ReadingText'
import { HelpTip } from '@/components/product/HelpTip'
import { nextStudyDate } from '@/lib/study-date'
import { ApiError, useApi } from '@/hooks/use-api'
import { getSubjectColor } from '@/lib/subject-color'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { OutlineEditor } from '@/components/courses/OutlineEditor'
import { OutlineInput } from '@/components/courses/OutlineInput'
import { ProposalReview } from '@/components/courses/ProposalReview'
import { useCourses } from '@/hooks/use-courses'
import { DeleteCourseButton } from '@/components/courses/DeleteCourseButton'
import { CourseDocuments } from '@/components/courses/CourseDocuments'
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
  targetExamDate?: string | null
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

interface NoteUpload {
  key: string
  file: File
  status:
    | 'queued'
    | 'waiting'
    | 'uploading'
    | 'mapping'
    | 'ready'
    | 'upload-failed'
    | 'mapping-failed'
  documentId?: string
  error?: string
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
  return <CourseDetail key={id} id={id} />
}

function CourseDetail({ id }: { id: string }) {
  const api = useApi()
  const router = useRouter()
  const { courses: allCourses } = useCourses()

  const [course, setCourse] = useState<Course | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [proposalSet, setProposalSet] = useState<ProposalSet | null>(null)
  const [arrivalBusy, setArrivalBusy] = useState<string | null>(null)
  const [arrivalError, setArrivalError] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [editing, setEditing] = useState(false)

  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [scheduleMode, setScheduleMode] = useState<'budget' | 'manual' | 'daily'>('budget')
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5, 6])
  const [weeklyHours, setWeeklyHours] = useState('4')
  const [studyPreference, setStudyPreference] = useState('EVENINGS')
  const [avoidWorkHours, setAvoidWorkHours] = useState(true)
  const [workStart, setWorkStart] = useState('09:00')
  const [workEnd, setWorkEnd] = useState('17:00')

  const [uploadingNotes, setUploadingNotes] = useState(false)
  const [documentsVersion, setDocumentsVersion] = useState(0)
  const [notesError, setNotesError] = useState<string | null>(null)
  const [notesMaps, setNotesMaps] = useState<DocumentMap[]>([])
  const [noteUploads, setNoteUploads] = useState<NoteUpload[]>([])
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

  const restoredPlan = useRef(false)

  function load() {
    api
      .get<Course>(`/courses/${id}`)
      .then((loaded) => {
        setCourse(loaded)
        if (loaded.topics.length === 0) setExpandedSection((current) => current ?? 'outline')
        if (restoredPlan.current) return
        const date = loaded.targetExamDate?.slice(0, 10)
        if (date && date >= nextStudyDate()) {
          setExamDate(date)
          setPlanLength('exam')
        } else {
          setExamDate('')
          setPlanLength('semester')
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load course'))
  }

  useEffect(() => {
    setCourse(null)
    setError(null)
    setEditing(new URLSearchParams(window.location.search).get('edit') === '1')
    load()
    api
      .get<Readiness>(`/study/courses/${id}/readiness`)
      .then(setReadiness)
      .catch(() => undefined)
    api
      .get<{
        planType?: 'DURATION' | 'EXAM_DATE'
        weeks?: number | null
        examDate?: string
        weeklyMinutes?: number | null
        schedulingPreferences?: {
          schedulingStyle?: 'TIMED' | 'DAILY'
          studyDays?: number[]
          studyPreference: string
          avoidWorkHours: boolean
          workStart: string
          workEnd: string
        } | null
      }>(`/study/plans/current?courseId=${id}`)
      .then((plan) => {
        setHasPlan(true)
        if (plan.planType === 'DURATION' && plan.weeks) {
          restoredPlan.current = true
          setCustomWeeks(String(plan.weeks))
          setPlanLength(
            plan.weeks === 13
              ? 'semester'
              : plan.weeks === 5
                ? '5'
                : plan.weeks === 10
                  ? '10'
                  : 'custom',
          )
        } else if (plan.planType === 'EXAM_DATE' && plan.examDate) {
          restoredPlan.current = true
          setExamDate(plan.examDate.slice(0, 10))
          setPlanLength('exam')
        }
        if (plan.weeklyMinutes && plan.schedulingPreferences) {
          setScheduleMode(
            plan.schedulingPreferences.schedulingStyle === 'DAILY' ? 'daily' : 'budget',
          )
          setStudyDays(plan.schedulingPreferences.studyDays ?? [1, 2, 3, 4, 5, 6])
          setWeeklyHours(String(plan.weeklyMinutes / 60))
          setStudyPreference(plan.schedulingPreferences.studyPreference)
          setAvoidWorkHours(plan.schedulingPreferences.avoidWorkHours)
          setWorkStart(plan.schedulingPreferences.workStart)
          setWorkEnd(plan.schedulingPreferences.workEnd)
        } else setScheduleMode('manual')
      })
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

  async function handleNotesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const uploads: NoteUpload[] = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      status: 'queued',
    }))
    setNotesError(null)
    setNotesMaps([])
    setNoteUploads(uploads)
    await processNoteUploads(uploads)
  }

  async function processNoteUploads(uploads: NoteUpload[]) {
    setUploadingNotes(true)
    const update = (key: string, patch: Partial<NoteUpload>) =>
      setNoteUploads((current) =>
        current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
      )
    try {
      for (const item of uploads) {
        let documentId = item.documentId
        async function withRateLimitRetry<T>(
          stage: 'uploading' | 'mapping',
          request: () => Promise<T>,
        ): Promise<T> {
          try {
            return await request()
          } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 429) throw error
            const seconds = Math.min(60, Math.max(1, error.retryAfterSeconds ?? 1))
            update(item.key, { status: 'waiting' })
            await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
            update(item.key, { status: stage })
            return request()
          }
        }
        try {
          update(item.key, { status: documentId ? 'mapping' : 'uploading', error: undefined })
          if (!documentId) {
            if (item.file.size > 20 * 1024 * 1024) throw new Error('File exceeds the 20 MB limit')
            const formData = new FormData()
            formData.append('file', item.file)
            formData.append('courseId', id)
            const doc = await withRateLimitRetry('uploading', () =>
              api.upload<UploadedDocument>('/documents/upload', formData),
            )
            if (doc.status !== 'READY')
              throw new Error("We couldn't read that file. Try a different one.")
            documentId = doc.id
            update(item.key, { documentId, status: 'mapping' })
          }
          const mapped = await withRateLimitRetry('mapping', () =>
            api.post<DocumentMap>(`/learning/documents/${documentId}/map`, {}),
          )
          setNotesMaps((current) => [
            ...current.filter((map) => map.documentId !== mapped.documentId),
            mapped,
          ])
          update(item.key, { status: 'ready' })
        } catch (err) {
          update(item.key, {
            documentId,
            status: documentId ? 'mapping-failed' : 'upload-failed',
            error: err instanceof Error ? err.message : 'Upload failed',
          })
        } finally {
          setDocumentsVersion((version) => version + 1)
        }
      }
    } finally {
      setUploadingNotes(false)
    }
  }

  async function handleAddNewTopics(topics: DocumentMap['newTopics'], documentId: string) {
    setAddingNewTopics(true)
    try {
      await api.post(`/courses/${id}/topics/bulk`, { source: 'MATERIAL', topics })
      setNotesMaps((current) =>
        current.map((map) =>
          map.documentId === documentId
            ? { ...map, newTopics: map.newTopics.filter((topic) => !topics.includes(topic)) }
            : map,
        ),
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

      if (scheduleMode === 'manual' && slots.length === 0) {
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

      if (scheduleMode === 'daily' && studyDays.length === 0)
        throw new Error('Choose at least one study day')
      if (scheduleMode === 'manual') await api.post('/study/availability', { slots })
      await api.post('/study/plans/generate', {
        courseId: id,
        ...(scheduleMode !== 'manual'
          ? {
              weeklyHours: Number(weeklyHours),
              schedulingStyle: scheduleMode === 'daily' ? 'DAILY' : 'TIMED',
              ...(scheduleMode === 'daily'
                ? { studyDays }
                : { studyPreference, avoidWorkHours, workStart, workEnd }),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
          : {}),
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
      {allCourses && allCourses.length > 1 && (
        <div className="max-w-md">
          <label
            htmlFor="course-switcher"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Your courses ({allCourses.length})
          </label>
          <select
            id="course-switcher"
            value={id}
            onChange={(e) => router.push(`/courses/${e.target.value}`)}
            className="input-base"
          >
            {allCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.courseCode ? `${c.courseCode} · ` : ''}
                {c.title}
              </option>
            ))}
          </select>
        </div>
      )}
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
          <div className="flex flex-wrap items-center gap-3">
            <DeleteCourseButton course={course} onDeleted={() => router.push('/courses')} />
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
        {(
          [
            ['outline', 'Course outline'],
            ['materials', 'Study materials'],
            ['setup', 'Study setup'],
          ] as const
        ).map(([anchor, label]) => (
          <button
            type="button"
            key={anchor}
            aria-expanded={expandedSection === anchor}
            aria-controls={anchor}
            onClick={() => {
              setExpandedSection(anchor)
              requestAnimationFrame(() =>
                document
                  .getElementById(anchor)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
              )
            }}
            className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 hover:bg-violet-50 hover:text-violet-700"
          >
            {label}
          </button>
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
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-violet-700">
                Readiness by topic
              </summary>
              <div className="flex flex-wrap gap-1.5 mt-3">
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
            </details>
          </section>
        )}
      </div>

      {/* Course outline: two layers — the student's original plus Nightklass enrichment */}
      <details
        id="outline"
        className="card scroll-mt-24 p-6"
        open={expandedSection === 'outline' || !!arrivalBusy || !!proposalSet}
        onToggle={(event) => {
          const open = event.currentTarget.open
          setExpandedSection((current) =>
            open ? 'outline' : current === 'outline' ? null : current,
          )
        }}
      >
        <summary className="cursor-pointer font-heading font-bold text-slate-900">
          Course outline{' '}
          <span className="ml-2 text-xs font-normal text-slate-500">
            {course.topics.filter((t) => !t.parentTopicId).length} topics · view or edit
          </span>
        </summary>
        <div className="mt-4">
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
                  <ReadingText>{course.outlineText}</ReadingText>
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
        </div>
      </details>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        {/* Lecture notes & slides — grounding material for notes, chat and quizzes */}
        <details
          id="materials"
          className="card scroll-mt-24 p-6"
          open={expandedSection === 'materials'}
          onToggle={(event) => {
            const open = event.currentTarget.open
            setExpandedSection((current) =>
              open ? 'materials' : current === 'materials' ? null : current,
            )
          }}
        >
          <summary className="cursor-pointer font-heading font-bold text-slate-900">
            Lecture notes & slides{' '}
            <span className="ml-2 text-xs font-normal text-slate-500">
              Uploaded files & upload notes
            </span>
          </summary>
          <div className="mt-4">
            <p className="text-slate-400 text-sm mb-4">
              Upload notes, slides, handouts or a textbook (PDF, Word, PowerPoint .ppt / .pptx, or
              text). Nightklass uses them for your study notes, quizzes and answers, so they match
              what your lecturer teaches.
            </p>
            <CourseDocuments courseId={id} version={documentsVersion} />
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
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                multiple
                aria-describedby="notes-upload-help"
                onChange={handleNotesUpload}
                disabled={uploadingNotes}
                className="text-sm"
                aria-label="Lecture notes or slides"
              />
              {uploadingNotes && (
                <span className="text-sm text-slate-400">Uploading & reading…</span>
              )}
            </div>
            <p id="notes-upload-help" className="mt-2 text-xs text-slate-500">
              Select multiple files together. Up to 20 MB per file. Each file is uploaded
              separately, so a failure won’t discard the others.
            </p>
            {noteUploads.length > 0 && (
              <div className="mt-4 space-y-2" aria-label="Upload results">
                <p role="status" className="text-sm font-semibold text-slate-700">
                  {uploadingNotes ? 'Adding your files… ' : 'Finished: '}
                  {noteUploads.filter((item) => item.documentId).length} of {noteUploads.length}{' '}
                  files uploaded
                </p>
                <ul className="space-y-2">
                  {noteUploads.map((item) => (
                    <li key={item.key} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <p className="break-words font-medium text-slate-800">{item.file.name}</p>
                      <p className="text-xs text-slate-500">
                        {
                          {
                            queued: 'Waiting',
                            waiting: 'Waiting for the upload limit to reset…',
                            uploading: 'Uploading & reading…',
                            mapping: 'Uploaded · matching to topics…',
                            ready: 'Uploaded & linked to your course',
                            'upload-failed': 'Upload failed',
                            'mapping-failed': 'Uploaded · topic matching needs a retry',
                          }[item.status]
                        }
                      </p>
                      {item.error && (
                        <p role="alert" className="mt-1 text-xs text-red-700">
                          {item.error}
                          {item.documentId
                            ? ' Your file is saved; retrying will only match its topics.'
                            : ''}
                        </p>
                      )}
                      {(item.status === 'upload-failed' || item.status === 'mapping-failed') && (
                        <button
                          type="button"
                          className="mt-2 text-xs font-semibold text-violet-700"
                          disabled={uploadingNotes}
                          onClick={() => void processNoteUploads([item])}
                        >
                          {item.documentId ? 'Retry topic matching' : 'Retry upload'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!uploadingNotes &&
              notesMaps.map((notesMap) => (
                <div
                  key={notesMap.documentId}
                  className="mt-4 rounded-xl bg-slate-50 p-4 space-y-3 text-sm"
                >
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
                              onClick={() => void handleAddNewTopics([t], notesMap.documentId)}
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
                          onClick={() =>
                            void handleAddNewTopics(notesMap.newTopics, notesMap.documentId)
                          }
                          disabled={addingNewTopics}
                          className="btn-secondary !py-1.5 !px-3 text-xs mt-2"
                        >
                          {addingNewTopics ? 'Adding…' : `Add all ${notesMap.newTopics.length}`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </details>

        {/* Study setup */}
        <details
          id="setup"
          className="card scroll-mt-24 p-6"
          open={expandedSection === 'setup'}
          onToggle={(event) => {
            const open = event.currentTarget.open
            setExpandedSection((current) => (open ? 'setup' : current === 'setup' ? null : current))
          }}
        >
          <summary className="cursor-pointer font-heading font-bold text-slate-900">
            Study setup{' '}
            <span className="ml-2 text-xs font-normal text-slate-500">Weekly hours & schedule</span>
          </summary>
          <div className="mt-4">
            <p className="text-slate-400 text-sm mb-4">
              Set a weekly time budget and let Nightklass find space around your other courses. You
              can also choose exact times.
            </p>

            <HelpTip label="What does a study plan do?">
              It spreads your topics and revision across your plan. Choose hours per week or exact
              times. Sessions appear in Today after you generate the plan.
            </HelpTip>

            <form onSubmit={handleGeneratePlan} className="space-y-4">
              {planError && (
                <div
                  role="alert"
                  className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
                >
                  {planError}
                </div>
              )}

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-slate-800 mb-2">
                  How should we schedule this course?
                </legend>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="schedule-mode"
                      checked={scheduleMode === 'daily'}
                      onChange={() => setScheduleMode('daily')}
                    />
                    Day-by-day timetable (no fixed times)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="schedule-mode"
                      checked={scheduleMode === 'budget'}
                      onChange={() => setScheduleMode('budget')}
                    />
                    Hours per week
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="schedule-mode"
                      checked={scheduleMode === 'manual'}
                      onChange={() => setScheduleMode('manual')}
                    />
                    Choose exact times
                  </label>
                </div>
                {scheduleMode !== 'manual' ? (
                  <div className="space-y-4">
                    <label className="block text-sm text-slate-700">
                      Hours per week for this course
                      <input
                        type="number"
                        min="0.5"
                        max="14"
                        step="0.25"
                        required
                        value={weeklyHours}
                        onChange={(e) => setWeeklyHours(e.target.value)}
                        className="input-base mt-1 w-28 block"
                      />
                    </label>
                    {scheduleMode === 'daily' ? (
                      <div className="space-y-3">
                        <fieldset>
                          <legend className="text-sm font-medium text-slate-700 mb-2">
                            Which days would you like to study?
                          </legend>
                          <div className="flex flex-wrap gap-3">
                            {DAYS.map((label, day) => (
                              <label
                                key={label}
                                className="flex min-h-11 items-center gap-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={studyDays.includes(day)}
                                  onChange={(event) =>
                                    setStudyDays((current) =>
                                      event.target.checked
                                        ? [...current, day]
                                        : current.filter((value) => value !== day),
                                    )
                                  }
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <p className="text-xs text-slate-500">
                          An approximate weekly workload, without a fixed clock time. Starts
                          tomorrow, spreads topics and revision across your chosen days, and
                          considers work already planned for other courses. Today shows your tasks
                          and tracks what you mark complete. Lighter days come first, with at most
                          two courses and three hours of planned study per day.
                        </p>
                      </div>
                    ) : (
                      <>
                        <label className="block text-sm text-slate-700">
                          When do you prefer to study?
                          <select
                            value={studyPreference}
                            onChange={(e) => setStudyPreference(e.target.value)}
                            className="input-base mt-1"
                          >
                            <option value="EVENINGS">Weekday evenings & weekends</option>
                            <option value="WEEKENDS">Weekends only</option>
                            <option value="FLEXIBLE">Flexible daytime & evenings</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={avoidWorkHours}
                            onChange={(e) => setAvoidWorkHours(e.target.checked)}
                          />
                          Keep weekday work / class hours free
                        </label>
                        {avoidWorkHours && (
                          <div className="grid grid-cols-2 gap-3">
                            <label className="text-sm text-slate-700">
                              Work / class starts
                              <input
                                type="time"
                                required
                                value={workStart}
                                onChange={(e) => setWorkStart(e.target.value)}
                                className="input-base mt-1"
                              />
                            </label>
                            <label className="text-sm text-slate-700">
                              Work / class ends
                              <input
                                type="time"
                                required
                                value={workEnd}
                                onChange={(e) => setWorkEnd(e.target.value)}
                                className="input-base mt-1"
                              />
                            </label>
                          </div>
                        )}
                        <p className="text-xs text-slate-500">
                          Starts tomorrow. Sessions last up to an hour, with 15-minute breaks, no
                          study after 10pm, up to 2 hours for this course per day, and at most 3
                          hours across courses. Weekday work / class hours include a one-hour
                          buffer. Other course sessions stay reserved; we’ll tell you if your budget
                          cannot fit. Times follow your local clock.
                        </p>{' '}
                      </>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-slate-500 mb-3">
                      These exact times are shared across your courses. Changing them rebalances
                      courses using exact times; courses with weekly budgets keep their reserved
                      sessions.
                    </p>
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
                  </div>
                )}
              </fieldset>

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
                      min={nextStudyDate()}
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
          </div>
        </details>
      </div>
    </div>
  )
}
