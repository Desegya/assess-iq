'use client'
import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/product/PageHeader'
import { Icon } from '@/components/product/Icon'
import { Badge, DataState, ActionDialog } from './AdminUI'
import { adminRequest, date, useAdminData } from './admin-api'
import { useAdminIdentity } from './AdminShell'
import type { AdminUser } from './admin-types'
export function AdminUserDetail({ id }: { id: string }) {
  const state = useAdminData<AdminUser>(`users/${id}`)
  const identity = useAdminIdentity()
  const [status, setStatus] = useState('SUSPENDED')
  const [role, setRole] = useState('ADMIN')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const d = state.data
  return <><Link href="/admin/users" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-violet-800"><Icon name="back" />Learners</Link><DataState {...state} />{d && <>
    <PageHeader eyebrow="Learner account" title={d.name} description={d.email} icon="user" />
    {notice && <p role="status" className="mt-5 text-sm text-violet-800">{notice}</p>}
    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <section className="card p-6"><h2 className="text-lg font-semibold">Account details</h2><dl className="mt-6 grid grid-cols-2 gap-5 text-sm">{[['Status',<Badge key="status" value={d.status} />],['Joined',date(d.createdAt)],['Last login',date(d.lastLoginAt)],['Programme',d.programme ?? 'Not provided'],['Institution',d.institution ?? 'Not provided'],['Level',d.currentLevel ?? 'Not provided']].map(([key,value]) => <div key={String(key)}><dt className="text-xs text-[#716778]">{key}</dt><dd className="mt-2">{value}</dd></div>)}</dl><div className="mt-6 grid grid-cols-2 gap-4">{Object.entries(d._count).map(([key,value]) => <div key={key} className="rounded-xl bg-[#faf8fd] p-4"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-[#716778]">{key.replace(/([A-Z])/g,' $1').toLowerCase()}</p></div>)}</div></section>
      <section className="card p-6"><h2 className="text-lg font-semibold">Account access</h2><p className="mt-3 text-sm leading-relaxed text-[#716778]">Status changes revoke refresh sessions. Suspended and inactive learners cannot make authenticated Nightklass requests.</p>
        {d.nightklassAdmin ? <p className="mt-5 rounded-xl bg-[#f3edff] p-4 text-sm text-violet-900">This account has {d.nightklassAdmin.role.toLowerCase()} access. Revoke it before changing account status.</p> : <div className="mt-5 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm">New status<select className="input-base mt-2 w-full" value={status} onChange={e => setStatus(e.target.value)}>{['ACTIVE','SUSPENDED','INACTIVE'].map(s => <option key={s} value={s}>{s.toLowerCase()}</option>)}</select></label><ActionDialog label="Change status" title="Change this learner’s account status?" description={`Set this account to ${status.toLowerCase()}. The learner will need to sign in again.`} endpoint={`users/${id}/status`} payload={{ status }} onSuccess={() => { setNotice('Account status updated.'); state.reload() }} /></div>}
        {identity.role === 'OWNER' && identity.user.id !== id && d.status === 'ACTIVE' && <div className="mt-8 border-t border-[#eae6ef] pt-6"><h3 className="text-sm font-semibold">Administrative permission</h3><div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm">Permission<select className="input-base mt-2 w-full" value={role} onChange={e => setRole(e.target.value)}><option value="ADMIN">Administrator</option><option value="OWNER">Owner — can manage access</option><option value="NONE">No administrative access</option></select></label><ActionDialog label="Update access" title="Update administrative access?" description="This grants or revokes access to learner information and content management. Owner access also permits managing other administrators." endpoint={`users/${id}/admin-access`} payload={{ role }} onSuccess={() => { setNotice('Administrative access updated.'); state.reload() }} /></div></div>}
      </section>
      <section className="card p-6"><h2 className="text-lg font-semibold">Recent courses</h2><ul className="mt-4 divide-y divide-[#eae6ef]">{d.courses.map(c => <li key={c.id}><Link className="flex min-h-14 items-center justify-between gap-4 text-sm text-violet-800" href={`/admin/courses/${c.id}`}>{c.title}<Icon name="arrow" /></Link></li>)}</ul>{!d.courses.length && <p className="mt-5 text-sm text-[#716778]">No courses yet.</p>}
        <h3 className="mt-7 text-sm font-semibold">Create a course for this learner</h3><form className="admin-form mt-4 space-y-4" onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; const values = new FormData(form); setSaving(true); setError(''); try { await adminRequest(`users/${id}/courses`, { method: 'POST', body: JSON.stringify({ title: values.get('title'), courseCode: values.get('courseCode') || undefined }) }); form.reset(); setNotice('Course created.'); state.reload() } catch(err) { setError(err instanceof Error ? err.message : 'Unable to create course') } finally { setSaving(false) } }}><label>Course title<input name="title" className="input-base" minLength={2} maxLength={100} required /></label><label>Course code (optional)<input name="courseCode" className="input-base" maxLength={20} /></label>{error && <p role="alert" className="text-sm text-red-800">{error}</p>}<button disabled={saving || d.status !== 'ACTIVE'} className="btn-primary px-5">{saving ? 'Creating…' : 'Create course'}</button></form>
      </section>
      <section className="card p-6"><h2 className="text-lg font-semibold">Recent study sessions</h2><ul className="mt-4 divide-y divide-[#eae6ef]">{d.sessions.map(s => <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="text-sm font-medium">{s.course.title}</p><p className="mt-1 text-xs text-[#716778]">{date(s.scheduledDate)}</p></div><Badge value={s.status} /></li>)}</ul>{!d.sessions.length && <p className="mt-5 text-sm text-[#716778]">No study sessions yet.</p>}</section>
    </div>
  </>}</>
}
