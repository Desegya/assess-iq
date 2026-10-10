'use client'
import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/product/PageHeader'
import { Icon } from '@/components/product/Icon'
import { Badge, DataState, ActionDialog, Pagination } from './AdminUI'
import { adminRequest, useAdminData } from './admin-api'
import type { AdminCourse, AdminTopic } from './admin-types'
export function AdminCourseDetail({ id }: { id: string }) {
  const [page, setPage] = useState(1)
  const state = useAdminData<AdminCourse>(`courses/${id}?page=${page}&limit=20`)
  const [editing, setEditing] = useState<AdminTopic | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const d = state.data
  async function save(event: React.FormEvent<HTMLFormElement>, topic = false) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const form = event.currentTarget
    const values = new FormData(form)
    const payload = topic
      ? {
          name: values.get('name'),
          description: values.get('description'),
          estimatedMinutes: Number(values.get('estimatedMinutes')) || undefined,
          ...(editing
            ? { order: Number(values.get('order')) }
            : { parentTopicId: values.get('parentTopicId') || undefined }),
        }
      : {
          title: values.get('title'),
          description: values.get('description'),
          courseCode: values.get('courseCode'),
          subject: values.get('subject'),
          creditUnits: values.get('creditUnits') === '' ? null : Number(values.get('creditUnits')),
          level: values.get('level') === '' ? null : Number(values.get('level')),
          semester: values.get('semester') || null,
        }
    try {
      await adminRequest(
        topic ? (editing ? `topics/${editing.id}` : `courses/${id}/topics`) : `courses/${id}`,
        { method: topic && !editing ? 'POST' : 'PATCH', body: JSON.stringify(payload) },
      )
      setNotice(topic ? 'Topic saved.' : 'Course details saved.')
      setEditing(null)
      state.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save')
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <Link
        href="/admin/courses"
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-violet-800"
      >
        <Icon name="back" />
        Courses
      </Link>
      <DataState {...state} />
      {d && (
        <>
          <PageHeader
            eyebrow={`Learner course · ${d.owner.name}`}
            title={d.title}
            description={d.courseCode ?? 'Personal Nightklass course'}
            icon="book"
          />
          <div className="mt-5 flex flex-wrap gap-3">
            {['lessons', 'questions', 'materials'].map((s) => (
              <Link
                key={s}
                href={`/admin/${s}?courseId=${id}`}
                className="btn-secondary inline-flex items-center gap-2 px-4 text-sm"
              >
                {s}
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
            ))}
          </div>
          {notice && (
            <p role="status" className="mt-5 text-sm text-violet-800">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-5 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_1.5fr]">
            <section className="card p-6">
              <h2 className="text-lg font-semibold">Course details</h2>
              <form className="admin-form mt-5 space-y-4" onSubmit={save} key={d.id + d.title}>
                <label>
                  Title
                  <input
                    name="title"
                    className="input-base"
                    required
                    minLength={2}
                    maxLength={100}
                    defaultValue={d.title}
                  />
                </label>
                <label>
                  Subject
                  <input
                    name="subject"
                    className="input-base"
                    required
                    minLength={2}
                    maxLength={100}
                    defaultValue={d.subject}
                  />
                </label>
                <label>
                  Course code
                  <input
                    name="courseCode"
                    className="input-base"
                    maxLength={20}
                    defaultValue={d.courseCode ?? ''}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    name="description"
                    className="input-base"
                    rows={3}
                    defaultValue={d.description ?? ''}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    Level
                    <select name="level" className="input-base" defaultValue={d.level ?? ''}>
                      <option value="">Not set</option>
                      {[100, 200, 300, 400, 500, 600].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Semester
                    <select name="semester" className="input-base" defaultValue={d.semester ?? ''}>
                      <option value="">Not set</option>
                      <option value="FIRST">First</option>
                      <option value="SECOND">Second</option>
                    </select>
                  </label>
                </div>
                <label>
                  Credit units
                  <input
                    name="creditUnits"
                    type="number"
                    min={0}
                    max={12}
                    className="input-base"
                    defaultValue={d.creditUnits ?? ''}
                  />
                </label>
                <button className="btn-primary px-5" disabled={saving}>
                  {saving ? 'Saving…' : 'Save course'}
                </button>
              </form>
            </section>
            <div className="min-w-0 space-y-6">
              <section className="card overflow-hidden">
                <div className="p-6">
                  <h2 className="text-lg font-semibold">Topic outline</h2>
                  <p className="mt-2 text-xs leading-relaxed text-[#716778]">
                    Archive topics and descendants without deleting progress. Restore parents before
                    children.
                  </p>
                </div>
                <ul className="divide-y divide-[#eae6ef]">
                  {d.topics.items.map((t) => (
                    <li key={t.id} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{t.name}</p>
                          <p className="mt-2 text-xs text-[#716778]">
                            Position {t.order + 1} · {t._count.lessons} lesson versions ·{' '}
                            {t._count.questions} questions
                          </p>
                        </div>
                        <Badge value={t.archivedAt ? 'ARCHIVED' : t.source} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className="btn-secondary px-4 text-sm"
                          onClick={() => setEditing(t)}
                        >
                          Edit topic
                        </button>
                        <Link
                          href={`/admin/questions/new?courseId=${id}&topicId=${t.id}`}
                          className="btn-secondary inline-flex items-center px-4 text-sm"
                        >
                          Add question
                        </Link>
                        <ActionDialog
                          label={t.archivedAt ? 'Restore' : 'Archive'}
                          title={`${t.archivedAt ? 'Restore' : 'Archive'} this topic?`}
                          description="This affects the topic and its descendants. Existing study history is preserved."
                          method="POST"
                          endpoint={`topics/${t.id}/${t.archivedAt ? 'restore' : 'archive'}`}
                          payload={{}}
                          onSuccess={() => {
                            setNotice('Topic visibility updated.')
                            state.reload()
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                {!d.topics.items.length && (
                  <p className="px-6 pb-6 text-sm text-[#716778]">No topics yet.</p>
                )}
                <Pagination page={page} total={d.topics.total} onPage={setPage} />
              </section>
              <section className="card p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">
                    {editing ? 'Edit topic' : 'Add a topic'}
                  </h2>
                  {editing && (
                    <button className="btn-secondary px-4" onClick={() => setEditing(null)}>
                      Cancel edit
                    </button>
                  )}
                </div>
                <form
                  key={editing?.id ?? 'new'}
                  className="admin-form mt-5 space-y-4"
                  onSubmit={(e) => save(e, true)}
                >
                  <label>
                    Topic name
                    <input
                      name="name"
                      className="input-base"
                      required
                      maxLength={200}
                      defaultValue={editing?.name}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      name="description"
                      className="input-base"
                      rows={3}
                      defaultValue={editing?.description ?? ''}
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      Estimated minutes
                      <input
                        name="estimatedMinutes"
                        type="number"
                        min={1}
                        className="input-base"
                        defaultValue={editing?.estimatedMinutes ?? ''}
                      />
                    </label>
                    {editing ? (
                      <label>
                        Order (starts at zero)
                        <input
                          name="order"
                          type="number"
                          min={0}
                          required
                          className="input-base"
                          defaultValue={editing.order}
                        />
                      </label>
                    ) : (
                      <label>
                        Parent topic (optional)
                        <select name="parentTopicId" className="input-base">
                          <option value="">Top-level topic</option>
                          {d.topics.items
                            .filter((t) => !t.archivedAt)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <button className="btn-primary px-5" disabled={saving}>
                    {saving ? 'Saving…' : editing ? 'Save topic' : 'Add topic'}
                  </button>
                </form>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  )
}
