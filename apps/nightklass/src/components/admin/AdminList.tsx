'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/product/PageHeader'
import { Icon, type IconName } from '@/components/product/Icon'
import { Badge, DataState, AdminEmpty, Pagination, ActionDialog } from './AdminUI'
import { date, useAdminData, type PageResult } from './admin-api'
import type { AdminRecord } from './admin-types'
const CONFIG: Record<
  string,
  { title: string; description: string; icon: IconName; statuses: string[]; columns: string[] }
> = {
  users: {
    title: 'Learners',
    description: 'Support standalone Nightklass accounts and review their learning activity.',
    icon: 'user',
    statuses: ['ACTIVE', 'SUSPENDED', 'INACTIVE', 'PENDING'],
    columns: ['Learner', 'Account', 'Joined', 'Last login'],
  },
  courses: {
    title: 'Courses & topics',
    description: 'Manage personal course details and preserve learner-owned outlines.',
    icon: 'book',
    statuses: [],
    columns: ['Course', 'Learner', 'Subject', 'Created'],
  },
  lessons: {
    title: 'Lessons',
    description: 'Review generated lessons and publish corrections as new versions.',
    icon: 'cards',
    statuses: [],
    columns: ['Topic', 'Course', 'Version', 'Created'],
  },
  questions: {
    title: 'Questions',
    description: 'Review formative quiz content, answer keys, and question difficulty.',
    icon: 'target',
    statuses: ['DRAFT', 'APPROVED', 'ARCHIVED', 'PENDING_REVIEW', 'REJECTED'],
    columns: ['Question', 'Course', 'Type', 'Status'],
  },
  materials: {
    title: 'Study materials',
    description:
      'Inspect upload processing without exposing private storage URLs or extracted text.',
    icon: 'upload',
    statuses: ['READY', 'FAILED', 'PROCESSING', 'UPLOADING'],
    columns: ['Material', 'Learner', 'Processing', 'Size'],
  },
  activity: {
    title: 'Learning activity',
    description: 'Scheduled and completed study sessions. Search by learner name.',
    icon: 'chart',
    statuses: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'RESCHEDULED'],
    columns: ['Learner', 'Course / topic', 'Session', 'Scheduled'],
  },
  reports: {
    title: 'Content reports',
    description: 'Review reported lessons, record your decision, and resolve quality issues.',
    icon: 'chat',
    statuses: ['OPEN', 'RESOLVED', 'DISMISSED'],
    columns: ['Report', 'Lesson', 'Status', 'Review'],
  },
  audit: {
    title: 'Audit history',
    description:
      'Server-recorded history of security and content changes. Search actions, actors, or resource IDs.',
    icon: 'clock',
    statuses: [],
    columns: ['Action', 'Actor', 'Resource', 'Details / time'],
  },
}
export const ADMIN_SECTIONS = Object.keys(CONFIG)
export function AdminList({ section }: { section: string }) {
  const config = CONFIG[section]!
  const params = useSearchParams()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(params.get('status') ?? '')
  const courseId = params.get('courseId') ?? ''
  const qs = new URLSearchParams({
    page: String(page),
    limit: '20',
    search: query,
    status,
    ...(courseId ? { courseId } : {}),
  })
  const state = useAdminData<PageResult<AdminRecord>>(`${section}?${qs}`)
  const [notice, setNotice] = useState('')
  function cells(r: AdminRecord): React.ReactNode[] {
    const primary = (text: string | undefined, href?: string, detail?: string) => (
      <div className="max-w-[350px]">
        <p className="font-medium">
          {href ? (
            <Link
              className="inline-flex min-h-11 items-center text-violet-800 hover:underline"
              href={href}
            >
              {text}
            </Link>
          ) : (
            text
          )}
        </p>
        {detail && <p className="mt-1 text-xs leading-relaxed text-[#716778]">{detail}</p>}
      </div>
    )
    if (section === 'users')
      return [
        primary(r.name, `/admin/users/${r.id}`, r.email),
        <div key="status" className="space-y-2">
          <Badge key="status" value={r.status!} />
          {r.nightklassAdmin && (
            <p className="text-xs text-violet-800">
              Admin · {r.nightklassAdmin.role.toLowerCase()}
            </p>
          )}
        </div>,
        date(r.createdAt),
        date(r.lastLoginAt),
      ]
    if (section === 'courses')
      return [
        primary(r.title, `/admin/courses/${r.id}`, r.courseCode),
        r.owner?.name,
        r.subject,
        date(r.createdAt),
      ]
    if (section === 'lessons')
      return [
        primary(r.topic?.name, `/admin/lessons/${r.id}`),
        r.topic?.course?.title,
        <div key="status" className="space-y-2">
          <p>Version {r.version}</p>
          <Badge value={r.mode!} />
        </div>,
        date(r.createdAt),
      ]
    if (section === 'questions')
      return [
        primary(r.questionText, `/admin/questions/${r.id}`, r.difficulty),
        r.course?.title,
        r.questionType?.replaceAll('_', ' '),
        <Badge key="status" value={r.status!} />,
      ]
    if (section === 'materials')
      return [
        primary(r.fileName, undefined, r.course?.title),
        r.uploadedBy?.name,
        <div key="processing">
          <Badge key="status" value={r.status!} />
          <p className="mt-2 text-xs text-[#716778]">{r.chunkCount ?? 0} passages indexed</p>
        </div>,
        `${((r.fileSizeBytes ?? 0) / 1024 / 1024).toFixed(2)} MB`,
      ]
    if (section === 'activity')
      return [
        r.student?.name,
        primary(r.course?.title, undefined, r.topic?.name),
        <Badge key="status" value={r.status!} />,
        date(r.scheduledDate),
      ]
    if (section === 'reports')
      return [
        primary(r.reason, undefined, r.resolution ?? date(r.createdAt)),
        primary(
          r.lesson?.topic.name,
          `/admin/lessons/${r.lesson?.id}`,
          `Version ${r.lesson?.version}`,
        ),
        <Badge key="status" value={r.status!} />,
        <div key="actions" className="flex flex-wrap gap-2">
          {(r.status === 'OPEN' ? ['RESOLVED', 'DISMISSED'] : ['OPEN']).map((next) => (
            <ActionDialog
              key={next}
              label={next === 'OPEN' ? 'Reopen' : next === 'RESOLVED' ? 'Resolve' : 'Dismiss'}
              title={`${next === 'OPEN' ? 'Reopen' : next === 'RESOLVED' ? 'Resolve' : 'Dismiss'} this report?`}
              description="Record the review outcome. Resolving a report does not change its lesson; make any correction on the lesson page first."
              endpoint={`reports/${r.id}`}
              payload={{ status: next }}
              onSuccess={() => {
                setNotice('Report updated.')
                state.reload()
              }}
            />
          ))}
        </div>,
      ]
    return [
      primary(r.action?.toLowerCase().replaceAll('_', ' ')),
      r.actor?.name,
      primary(r.resourceType, undefined, r.resourceId),
      <div key="metadata" className="max-w-[320px] text-xs leading-relaxed text-[#716778]">
        <p>
          {typeof r.metadata?.reason === 'string'
            ? r.metadata.reason
            : Object.entries(r.metadata ?? {})
                .map(
                  ([key, value]) =>
                    `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`,
                )
                .join(' · ')}
        </p>
        <p className="mt-2">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</p>
      </div>,
    ]
  }
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title={config.title}
        description={config.description}
        icon={config.icon}
        action={
          section === 'questions' ? (
            <Link
              href="/admin/questions/new"
              className="btn-primary inline-flex items-center gap-2 px-5"
            >
              <Icon name="plus" />
              New question
            </Link>
          ) : undefined
        }
      />
      <form
        className="mt-8 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setQuery(search)
          setPage(1)
        }}
      >
        <label className="min-w-0 flex-1 text-xs font-medium text-[#716778]">
          Search
          <div className="relative mt-2">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-[#716778]"
            />
            <input
              className="input-base w-full !pl-10"
              type="search"
              maxLength={100}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${config.title.toLowerCase()}`}
            />
          </div>
        </label>
        {config.statuses.length > 0 && (
          <label className="w-full text-xs font-medium text-[#716778] sm:w-48">
            Status
            <select
              className="input-base mt-2 w-full"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All statuses</option>
              {config.statuses.map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase().replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="btn-secondary px-5">Search</button>
      </form>
      {notice && (
        <p role="status" className="mt-4 text-sm text-violet-800">
          {notice}
        </p>
      )}
      <DataState {...state} />
      {state.data && (
        <div className="admin-table mt-6" tabIndex={0} role="region" aria-label={config.title}>
          {state.data.items.length ? (
            <table>
              <caption className="sr-only">{config.title}</caption>
              <thead>
                <tr>
                  {config.columns.map((c) => (
                    <th scope="col" key={c}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((r) => (
                  <tr key={r.id}>
                    {cells(r).map((cell, i) => (
                      <td key={i}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <AdminEmpty />
          )}
          <Pagination page={page} total={state.data.total} onPage={setPage} />
        </div>
      )}
    </>
  )
}
