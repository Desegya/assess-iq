'use client'

import { Suspense, use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApi } from '@/hooks/use-api'
import { Notice } from '@/components/auth/FormParts'
import { ExportButtons } from '@/components/assessments/ExportButtons'
import { POLICY_OPTIONS, classLink, parseEmails, type JoinPolicy } from '@/lib/classes'

interface Access {
  id: string
  title: string
  courseCode: string | null
  joinCode: string
  joinPolicy: JoinPolicy
  allowedEmailDomains: string[]
  allowedEmails: string[]
  joiningOpen: boolean
  suggestedDomain: string | null
  students: { active: number; pending: number; removed: number }
}
interface Enrollment {
  id: string
  status: 'PENDING' | 'ACTIVE' | 'REMOVED'
  createdAt: string
  student: { id: string; name: string; email: string; emailVerified: boolean }
}

export default function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <Suspense fallback={null}>
      <ClassDetail id={id} />
    </Suspense>
  )
}

function ClassDetail({ id }: { id: string }) {
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api
  const router = useRouter()
  const created = useSearchParams().get('created') === '1'

  const [access, setAccess] = useState<Access | null>(null)
  const [roster, setRoster] = useState<Enrollment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        apiRef.current.get<Access>(`/classes/${id}/access`),
        apiRef.current.get<Enrollment[]>(`/classes/${id}/students`),
      ])
      setAccess(a)
      setRoster(r)
    } catch {
      setNotFound(true)
    }
  }, [id])
  useEffect(() => void load(), [load])

  async function act<T>(fn: () => Promise<T>) {
    setError(null)
    try {
      return await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl">
        <Notice kind="error">This class was not found.</Notice>
        <Link href="/teacher/courses" className="btn-secondary mt-4 inline-flex">Back to classes</Link>
      </div>
    )
  }
  if (!access) return <p role="status" className="text-sm text-slate-500">Loading class…</p>

  const pending = roster.filter(e => e.status === 'PENDING')
  const active = roster.filter(e => e.status === 'ACTIVE')
  const removed = roster.filter(e => e.status === 'REMOVED')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/teacher/courses" className="text-sm text-slate-500 hover:text-violet-700">← Classes</Link>
        <h1 className="mt-3 font-heading text-2xl font-bold text-slate-900">{access.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {[access.courseCode, `${access.students.active} students`, pending.length ? `${pending.length} waiting` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {created && <Notice kind="ok">Class created. Share the link below with your students.</Notice>}
      {error && <Notice kind="error">{error}</Notice>}

      <ShareCard access={access} onReset={() => act(async () => setAccess(await api.post<Access>(`/classes/${id}/access/reset-link`, {})))} />

      <AccessCard
        access={access}
        onSave={body => act(async () => setAccess(await api.patch<Access>(`/classes/${id}/access`, body)))}
      />

      {(access.joinPolicy === 'EMAIL_LIST' || access.allowedEmails.length > 0) && (
        <EmailListCard
          emails={access.allowedEmails}
          onAdd={emails =>
            act(async () => {
              setAccess(await api.post<Access>(`/classes/${id}/emails`, { emails }))
              setRoster(await api.get<Enrollment[]>(`/classes/${id}/students`))
            })
          }
          onRemove={email => act(async () => setAccess(await api.del<Access>(`/classes/${id}/emails/${encodeURIComponent(email)}`)))}
        />
      )}

      <section className="card p-6">
        <h2 className="product-section-title">Students</h2>
        {pending.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-[.12em] text-amber-700">Waiting for you ({pending.length})</p>
            <RosterList
              rows={pending}
              actions={e => (
                <>
                  <button className="btn-primary !min-h-9 !px-3 !py-1.5 !text-xs" onClick={() => act(async () => setRoster(await api.patch<Enrollment[]>(`/classes/${id}/students/${e.id}`, { status: 'ACTIVE' })))}>
                    Let in
                  </button>
                  <button className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs" onClick={() => act(async () => setRoster(await api.patch<Enrollment[]>(`/classes/${id}/students/${e.id}`, { status: 'REMOVED' })))}>
                    Decline
                  </button>
                </>
              )}
            />
          </div>
        )}
        <div className="mt-4">
          {active.length === 0 ? (
            <p className="text-sm text-slate-500">No students yet. Share the class link to get started.</p>
          ) : (
            <RosterList
              rows={active}
              actions={e => (
                <button
                  className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs"
                  onClick={() => {
                    if (confirm(`Remove ${e.student.name} from this class? They will no longer see its tests.`))
                      void act(async () => setRoster(await api.patch<Enrollment[]>(`/classes/${id}/students/${e.id}`, { status: 'REMOVED' })))
                  }}
                >
                  Remove
                </button>
              )}
            />
          )}
        </div>
        {removed.length > 0 && (
          <details className="mt-5">
            <summary className="cursor-pointer text-sm text-slate-500">Removed or declined ({removed.length})</summary>
            <div className="mt-3">
              <RosterList
                rows={removed}
                actions={e => (
                  <button className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs" onClick={() => act(async () => setRoster(await api.patch<Enrollment[]>(`/classes/${id}/students/${e.id}`, { status: 'ACTIVE' })))}>
                    Add back
                  </button>
                )}
              />
            </div>
          </details>
        )}
      </section>

      <section className="card p-6">
        <h2 className="product-section-title">Tests and questions</h2>
        <p className="mt-1 text-sm text-slate-500">Build a test from this class&rsquo;s question bank, then publish it to the class.</p>
        <div className="mt-4">
          <ExportButtons path={`/classes/${id}/results/export`} label="Download gradebook" />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/teacher/questions?courseId=${id}`} className="btn-secondary">Question bank</Link>
          <Link href={`/teacher/assessments?courseId=${id}`} className="btn-primary">Tests for this class</Link>
          <button
            className="btn-secondary text-red-700"
            onClick={() => {
              if (!confirm(`Delete "${access.title}"? Its question bank and class list will be deleted. A class with tests cannot be deleted, so results are never lost.`)) return
              void act(async () => {
                await api.del(`/courses/${id}`)
                router.push('/teacher/courses')
              })
            }}
          >
            Delete class
          </button>
        </div>
      </section>
    </div>
  )
}

function ShareCard({ access, onReset }: { access: Access; onReset: () => void }) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const link = classLink(access.joinCode)
  const copy = async (what: 'link' | 'code', text: string) => {
    await navigator.clipboard.writeText(text).catch(() => undefined)
    setCopied(what)
    setTimeout(() => setCopied(null), 2000)
  }
  return (
    <section className="card p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="product-section-title">Class link</h2>
          <p className="mt-1 text-sm text-slate-500">Send this to your students (WhatsApp, email, your course page).</p>
          <p className="mt-3 break-all rounded-xl bg-violet-50 px-3 py-2 font-mono text-sm text-violet-800">{link}</p>
          <p className="mt-2 text-xs text-slate-500">
            Or they can enter the code <span className="font-mono font-semibold text-slate-700">{access.joinCode}</span> at {typeof window === 'undefined' ? '' : window.location.host}/join
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button className="btn-primary" onClick={() => void copy('link', link)}>{copied === 'link' ? 'Copied' : 'Copy link'}</button>
          <button className="btn-secondary" onClick={() => void copy('code', access.joinCode)}>{copied === 'code' ? 'Copied' : 'Copy code'}</button>
          <button
            className="btn-secondary"
            onClick={() => {
              if (confirm('Make a new link? The old link and code will stop working. Students already in the class stay in.')) onReset()
            }}
          >
            New link
          </button>
        </div>
      </div>
    </section>
  )
}

function AccessCard({ access, onSave }: { access: Access; onSave: (body: Record<string, unknown>) => Promise<unknown> }) {
  const [policy, setPolicy] = useState<JoinPolicy>(access.joinPolicy)
  const [domains, setDomains] = useState(
    access.allowedEmailDomains.join(', ') || access.suggestedDomain || '',
  )
  const [saving, setSaving] = useState(false)
  const dirty =
    policy !== access.joinPolicy ||
    (policy === 'EMAIL_DOMAIN' && domains.split(/[\s,]+/).filter(Boolean).join(',') !== access.allowedEmailDomains.join(','))

  async function save(body: Record<string, unknown>) {
    setSaving(true)
    await onSave(body)
    setSaving(false)
  }

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="product-section-title">Who can join</h2>
          <p className="mt-1 text-sm text-slate-500">Changing this does not remove students already in the class.</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={access.joiningOpen}
            onChange={e => void save({ joiningOpen: e.target.checked })}
            disabled={saving}
          />
          Accepting new students
        </label>
      </div>
      <div className="mt-4 space-y-2">
        {POLICY_OPTIONS.map(o => (
          <label key={o.value} className={`flex cursor-pointer gap-3 rounded-2xl border p-3 ${policy === o.value ? 'border-violet-300 bg-violet-50' : 'border-slate-200'}`}>
            <input type="radio" name="policy" value={o.value} checked={policy === o.value} onChange={() => setPolicy(o.value)} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium text-slate-900">{o.label}</span>
              <span className="block text-xs text-slate-500">{o.help}</span>
            </span>
          </label>
        ))}
      </div>
      {policy === 'EMAIL_DOMAIN' && (
        <div className="mt-4">
          <label htmlFor="domains" className="mb-1.5 block text-sm font-medium text-slate-700">School email domains</label>
          <input id="domains" value={domains} onChange={e => setDomains(e.target.value)} placeholder="ug.edu.gh" className="input-base" />
          <p className="mt-1.5 text-xs text-slate-500">Separate several with commas. ug.edu.gh also lets in st.ug.edu.gh.</p>
        </div>
      )}
      {dirty && (
        <button
          className="btn-primary mt-4"
          disabled={saving}
          onClick={() =>
            void save({
              joinPolicy: policy,
              ...(policy === 'EMAIL_DOMAIN' ? { allowedEmailDomains: domains.split(/[\s,]+/).filter(Boolean) } : {}),
            })
          }
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      )}
    </section>
  )
}

function EmailListCard({
  emails,
  onAdd,
  onRemove,
}: {
  emails: string[]
  onAdd: (emails: string[]) => Promise<unknown>
  onRemove: (email: string) => Promise<unknown>
}) {
  const [text, setText] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const parsed = parseEmails(text)
  return (
    <section className="card p-6">
      <h2 className="product-section-title">Email list ({emails.length})</h2>
      <p className="mt-1 text-sm text-slate-500">
        Paste student emails, or a column copied from a spreadsheet. Anyone already waiting with a listed email is let in.
      </p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={4}
        placeholder={'kofi.mensah@st.ug.edu.gh\nama.owusu@st.ug.edu.gh'}
        className="input-base mt-4 font-mono !text-xs"
      />
      {parsed.invalid.length > 0 && (
        <p className="mt-2 text-xs text-red-700">Not valid emails: {parsed.invalid.slice(0, 5).join(', ')}</p>
      )}
      {note && <p className="mt-2 text-xs text-emerald-700">{note}</p>}
      <button
        className="btn-primary mt-3"
        disabled={parsed.emails.length === 0}
        onClick={async () => {
          await onAdd(parsed.emails)
          setNote(`Added ${parsed.emails.length} email${parsed.emails.length === 1 ? '' : 's'}.`)
          setText('')
        }}
      >
        Add {parsed.emails.length || ''} email{parsed.emails.length === 1 ? '' : 's'}
      </button>
      {emails.length > 0 && (
        <ul className="mt-5 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-100">
          {emails.map(email => (
            <li key={email} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="truncate font-mono text-xs text-slate-700">{email}</span>
              <button className="text-xs text-slate-500 hover:text-red-700" onClick={() => void onRemove(email)} aria-label={`Remove ${email}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RosterList({ rows, actions }: { rows: Enrollment[]; actions: (e: Enrollment) => React.ReactNode }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
      {rows.map(e => (
        <li key={e.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{e.student.name}</p>
            <p className="truncate text-xs text-slate-500">
              {e.student.email}
              {!e.student.emailVerified && <span className="ml-2 text-amber-700">email not confirmed</span>}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">{actions(e)}</div>
        </li>
      ))}
    </ul>
  )
}
