'use client'
import { MathText } from '@/components/product/MathText'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/product/PageHeader'
import { Icon } from '@/components/product/Icon'
import { DataState } from './AdminUI'
import { adminRequest, useAdminData, type PageResult } from './admin-api'
import type { AdminCourse, AdminQuestion, SummaryCourse } from './admin-types'
export function AdminQuestionDetail({ id }: { id: string }) {
  const params = useSearchParams()
  const router = useRouter()
  const isNew = id === 'new'
  const question = useAdminData<AdminQuestion>(isNew ? null : `questions/${id}`)
  const [courseId, setCourseId] = useState(params.get('courseId') ?? '')
  const [courseQuery, setCourseQuery] = useState('')
  const courses = useAdminData<PageResult<SummaryCourse>>(
    isNew ? `courses?limit=20&search=${encodeURIComponent(courseQuery)}` : null,
  )
  const [topicPage, setTopicPage] = useState(1)
  const topics = useAdminData<AdminCourse>(
    isNew && courseId ? `courses/${courseId}?limit=50&page=${topicPage}` : null,
  )
  const [questionText, setQuestionText] = useState('')
  const [type, setType] = useState('MCQ')
  const [options, setOptions] = useState([
    { key: 'A', text: '' },
    { key: 'B', text: '' },
    { key: 'C', text: '' },
    { key: 'D', text: '' },
  ])
  const [answer, setAnswer] = useState('A')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (question.data) {
      setQuestionText(question.data.questionText)
      setType(question.data.questionType)
      setOptions(question.data.options ?? [])
      setAnswer(question.data.correctAnswer)
    }
  }, [question.data])
  return (
    <>
      <Link
        href="/admin/questions"
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-violet-800"
      >
        <Icon name="back" />
        Questions
      </Link>
      <PageHeader
        eyebrow="Formative assessment"
        title={isNew ? 'Create a clear question.' : 'Review this question.'}
        description="Support the existing MCQ, true/false, short-answer, and theory formats. Questions with graded attempts cannot be edited."
        icon="target"
      />
      {notice && (
        <p role="status" className="mt-5 text-sm text-violet-800">
          {notice}
        </p>
      )}
      {!isNew && <DataState {...question} />}
      {(isNew || question.data) && (
        <form
          key={question.data?.id ?? 'new'}
          className="admin-form card mt-8 max-w-3xl space-y-5 p-6 sm:p-8"
          onSubmit={async (e) => {
            e.preventDefault()
            setError('')
            setSaving(true)
            const values = new FormData(e.currentTarget)
            try {
              const result = await adminRequest<{ id: string }>(
                isNew ? 'questions' : `questions/${id}`,
                {
                  method: isNew ? 'POST' : 'PATCH',
                  body: JSON.stringify({
                    topicId: isNew ? values.get('topicId') : question.data!.topicId,
                    questionText: values.get('questionText'),
                    questionType: type,
                    difficulty: values.get('difficulty'),
                    status: values.get('status'),
                    correctAnswer: answer,
                    explanation: values.get('explanation'),
                    marks: Number(values.get('marks')) || undefined,
                    options: type === 'MCQ' ? options.filter((o) => o.text.trim()) : undefined,
                    reason: values.get('reason'),
                  }),
                },
              )
              if (isNew) router.replace(`/admin/questions/${result.id}`)
              else {
                setNotice('Question saved.')
                question.reload()
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unable to save question')
            } finally {
              setSaving(false)
            }
          }}
        >
          {isNew && (
            <fieldset className="space-y-4">
              <legend className="mb-3 text-sm font-semibold">Course & topic</legend>
              <label>
                Find a course
                <input
                  className="input-base"
                  type="search"
                  value={courseQuery}
                  onChange={(e) => setCourseQuery(e.target.value)}
                  placeholder="Search course titles"
                  maxLength={100}
                />
              </label>
              <DataState {...courses} />
              <label>
                Course
                <select
                  className="input-base"
                  value={courseId}
                  onChange={(e) => {
                    setCourseId(e.target.value)
                    setTopicPage(1)
                  }}
                  required
                >
                  <option value="">Choose a course</option>
                  {courses.data?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} · {c.owner.name}
                    </option>
                  ))}
                </select>
              </label>
              {courseId && (
                <>
                  <DataState {...topics} />
                  <label>
                    Topic
                    <select
                      className="input-base"
                      name="topicId"
                      required
                      defaultValue={params.get('topicId') ?? ''}
                      key={courseId + topicPage}
                    >
                      <option value="">Choose a topic</option>
                      {topics.data?.topics.items
                        .filter((t) => !t.archivedAt)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {topics.data && topics.data.topics.total > 50 && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="btn-secondary px-4"
                        disabled={topicPage === 1}
                        onClick={() => setTopicPage((p) => p - 1)}
                      >
                        Previous topics
                      </button>
                      <button
                        type="button"
                        className="btn-secondary px-4"
                        disabled={topicPage * 50 >= topics.data.topics.total}
                        onClick={() => setTopicPage((p) => p + 1)}
                      >
                        More topics
                      </button>
                    </div>
                  )}
                </>
              )}
            </fieldset>
          )}
          <label>
            Question
            <textarea
              name="questionText"
              required
              minLength={5}
              maxLength={10000}
              rows={4}
              className="input-base"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
            />
          </label>
          <section aria-label="Question display preview" className="space-y-3 rounded-xl border bg-slate-50 p-4">
            <h2 className="text-sm font-semibold">Question display preview</h2>
            <p className="text-xs text-slate-500">Use $…$ for inline formulas and $$…$$ for equations. Type pronunciation symbols directly, for example /ʃ/ or /ə/.</p>
            <p><MathText>{questionText}</MathText></p>
            {type === 'MCQ' && options.map((option) => (
              <p key={option.key}>{option.key}. <MathText>{option.text}</MathText></p>
            ))}
          </section>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Question format
              <select
                className="input-base"
                value={type}
                onChange={(e) => {
                  setType(e.target.value)
                  setAnswer(
                    e.target.value === 'MCQ' ? 'A' : e.target.value === 'TRUE_FALSE' ? 'true' : '',
                  )
                  if (e.target.value === 'MCQ' && !options.length)
                    setOptions([
                      { key: 'A', text: '' },
                      { key: 'B', text: '' },
                    ])
                }}
              >
                <option value="MCQ">Multiple choice</option>
                <option value="TRUE_FALSE">True / false</option>
                <option value="SHORT_ANSWER">Short answer</option>
                <option value="THEORY">Theory / structured / calculation</option>
              </select>
            </label>
            <label>
              Difficulty
              <select
                name="difficulty"
                className="input-base"
                defaultValue={question.data?.difficulty ?? 'MEDIUM'}
              >
                <option value="EASY">Basic</option>
                <option value="MEDIUM">Intermediate</option>
                <option value="HARD">Advanced</option>
              </select>
            </label>
          </div>
          {type === 'MCQ' && (
            <fieldset className="space-y-3">
              <legend className="mb-3 text-sm font-semibold">Answer options</legend>
              {options.map((o, i) => (
                <label key={o.key}>
                  Option {o.key}
                  <input
                    className="input-base"
                    required={i < 2}
                    maxLength={2000}
                    value={o.text}
                    onChange={(e) =>
                      setOptions(
                        options.map((v, j) => (i === j ? { ...v, text: e.target.value } : v)),
                      )
                    }
                  />
                </label>
              ))}
              {options.length < 6 && (
                <button
                  type="button"
                  className="btn-secondary px-4"
                  onClick={() =>
                    setOptions([...options, { key: 'ABCDEF'[options.length]!, text: '' }])
                  }
                >
                  Add option
                </button>
              )}
            </fieldset>
          )}
          <label>
            {['MCQ', 'TRUE_FALSE'].includes(type)
              ? 'Correct answer'
              : 'Model answer / marking guide'}
            {type === 'MCQ' ? (
              <select
                className="input-base"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              >
                {options.map((o) => (
                  <option key={o.key}>{o.key}</option>
                ))}
              </select>
            ) : type === 'TRUE_FALSE' ? (
              <select
                className="input-base"
                value={answer.toLowerCase()}
                onChange={(e) => setAnswer(e.target.value)}
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : (
              <textarea
                className="input-base"
                required
                maxLength={10000}
                rows={5}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            )}
          </label>
          <label>
            Explanation
            <textarea
              name="explanation"
              className="input-base"
              maxLength={10000}
              rows={3}
              defaultValue={question.data?.explanation ?? ''}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Marks (optional)
              <input
                type="number"
                name="marks"
                min={1}
                max={100}
                className="input-base"
                defaultValue={question.data?.marks ?? ''}
              />
            </label>
            <label>
              Status
              <select
                name="status"
                className="input-base"
                defaultValue={question.data?.status ?? 'DRAFT'}
              >
                <option value="DRAFT">Draft</option>
                <option value="PENDING_REVIEW">Pending review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
          </div>
          <label>
            Reason for creating or changing this question
            <textarea
              name="reason"
              required
              minLength={5}
              maxLength={500}
              className="input-base"
              rows={2}
            />
          </label>
          <p className="text-xs leading-relaxed text-[#716778]">
            This manages stored learner quiz content. Nightklass’s existing quiz generation creates
            fresh questions; this does not introduce a shared public question bank.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-800">
              {error}
            </p>
          )}
          <button className="btn-primary px-5" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create question' : 'Save question'}
          </button>
        </form>
      )}
    </>
  )
}
