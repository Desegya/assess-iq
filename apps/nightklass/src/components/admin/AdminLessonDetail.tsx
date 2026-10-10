'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/product/PageHeader'
import { Icon } from '@/components/product/Icon'
import { DataState, Badge } from './AdminUI'
import { adminRequest, useAdminData } from './admin-api'
import type { AdminLesson } from './admin-types'
export function AdminLessonDetail({ id }: { id: string }) {
  const state = useAdminData<AdminLesson>(`lessons/${id}`)
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)
  const d = state.data
  return (
    <>
      <Link
        href="/admin/lessons"
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-violet-800"
      >
        <Icon name="back" />
        Lessons
      </Link>
      <DataState {...state} />
      {d && (
        <>
          <PageHeader
            eyebrow={`Lesson version ${d.version}`}
            title={d.topic.name}
            description="Corrections create a new version. Earlier lessons, reports, and source references remain intact."
            icon="cards"
            action={
              <button className="btn-secondary px-5" onClick={() => setPreview(!preview)}>
                {preview ? 'Edit lesson' : 'Read original version'}
              </button>
            }
          />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Badge value={d.mode} />
            <Link
              className="inline-flex min-h-11 items-center text-sm text-violet-800"
              href={`/admin/courses/${d.topic.courseId}`}
            >
              View course →
            </Link>
          </div>
          {preview ? (
            <article className="card mt-7 max-w-4xl p-6 sm:p-8">
              <p className="whitespace-pre-wrap text-sm leading-loose">{d.content.introduction}</p>
              {d.content.sections.map((s, i) => (
                <section key={i} className="lesson-section">
                  <h2>{s.heading}</h2>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-loose">{s.body}</p>
                </section>
              ))}
              <h2 className="mt-7 text-lg font-semibold">Summary</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
                {d.content.summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </article>
          ) : (
            <form
              className="admin-form card mt-7 max-w-4xl space-y-6 p-6 sm:p-8"
              key={id}
              onSubmit={async (e) => {
                e.preventDefault()
                setSaving(true)
                setError('')
                const values = new FormData(e.currentTarget)
                try {
                  const next = await adminRequest<{ id: string }>(`lessons/${id}/correct`, {
                    method: 'POST',
                    body: JSON.stringify({
                      introduction: values.get('introduction'),
                      sections: d.content.sections.map((_, i) => ({
                        heading: values.get(`heading-${i}`),
                        body: values.get(`body-${i}`),
                      })),
                      summary: String(values.get('summary'))
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                      reason: values.get('reason'),
                      expectedVersion: d.version,
                    }),
                  })
                  router.push(`/admin/lessons/${next.id}`)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Unable to correct lesson')
                } finally {
                  setSaving(false)
                }
              }}
            >
              <label>
                Introduction
                <textarea
                  name="introduction"
                  rows={5}
                  className="input-base"
                  required
                  maxLength={10000}
                  defaultValue={d.content.introduction}
                />
              </label>
              {d.content.sections.map((s, i) => (
                <fieldset key={i} className="space-y-4 rounded-xl border border-[#eae6ef] p-5">
                  <legend className="px-2 text-xs font-semibold text-violet-800">
                    Section {i + 1}
                  </legend>
                  <label>
                    Heading
                    <input
                      name={`heading-${i}`}
                      className="input-base"
                      required
                      maxLength={200}
                      defaultValue={s.heading}
                    />
                  </label>
                  <label>
                    Content
                    <textarea
                      name={`body-${i}`}
                      className="input-base"
                      required
                      rows={8}
                      maxLength={20000}
                      defaultValue={s.body}
                    />
                  </label>
                </fieldset>
              ))}
              <label>
                Summary (one point per line)
                <textarea
                  name="summary"
                  className="input-base"
                  rows={4}
                  defaultValue={d.content.summary.join('\n')}
                />
              </label>
              <label>
                Correction notes
                <textarea
                  name="reason"
                  className="input-base"
                  required
                  minLength={5}
                  maxLength={500}
                  rows={3}
                  placeholder="Explain what changed and why"
                />
              </label>
              <p className="text-xs leading-relaxed text-[#716778]">
                Check formulas, citation markers and source accuracy before saving. Objectives,
                examples and other existing lesson fields are preserved.
              </p>
              {error && (
                <p role="alert" className="text-sm text-red-800">
                  {error}
                </p>
              )}
              <button disabled={saving} className="btn-primary px-5">
                {saving ? 'Saving correction…' : 'Save as a new version'}
              </button>
            </form>
          )}
        </>
      )}
    </>
  )
}
