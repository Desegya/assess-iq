'use client'
import Link from 'next/link'
import { useState } from 'react'
import { PageHeader } from '@/components/product/PageHeader'
import { ActionDialog, Badge, DataState, Pagination } from './AdminUI'
import { date, useAdminData, type PageResult } from './admin-api'
import type { AdminUser } from './admin-types'
import { useAdminIdentity } from './AdminShell'
export function AdminAccess() {
  const state = useAdminData<
    {
      role: string
      createdAt: string
      user: { id: string; name: string; email: string; status: string }
    }[]
  >('access')
  const identity = useAdminIdentity()
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [role, setRole] = useState('ADMIN')
  const [notice, setNotice] = useState('')
  const candidates = useAdminData<PageResult<AdminUser>>(
    adding && identity.role === 'OWNER'
      ? `users?status=ACTIVE&search=${encodeURIComponent(query)}&page=${page}&limit=20`
      : null,
  )
  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="A trusted team."
        description="Nightklass access is separate from institutional roles. Only owners can grant or revoke administration access."
        icon="user"
        action={identity.role === 'OWNER' && (
          <button className="btn-primary px-5" onClick={() => {
            setAdding(!adding)
            setSelected(null)
            setNotice('')
          }} aria-expanded={adding} aria-controls="add-administrator">
            {adding ? 'Close' : 'Add administrator'}
          </button>
        )}
      />
      {notice && <p role="status" className="mb-5 text-sm text-violet-800">{notice}</p>}
      {adding && identity.role === 'OWNER' && (
        <section id="add-administrator" aria-labelledby="add-admin-title" className="rounded-2xl border border-[#e5d8fb] bg-white p-5 sm:p-6">
          <h2 id="add-admin-title" className="text-lg font-semibold">Add an administrator</h2>
          <p className="mt-2 text-sm text-[#716778]">Choose an existing active Nightklass account. They will sign in with their current password.</p>
          <form className="mt-5 flex flex-wrap gap-3" onSubmit={(event) => {
            event.preventDefault()
            setQuery(search.trim())
            setPage(1)
            setSelected(null)
          }}>
            <label className="min-w-0 flex-1 text-sm font-medium">
              Name or email
              <input className="input-base mt-2 w-full" value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} placeholder="Search Nightklass accounts" />
            </label>
            <button className="btn-secondary self-end px-5">Search</button>
          </form>
          <DataState {...candidates} />
          {candidates.data && (
            <>
              <ul className="mt-4 divide-y divide-[#eae6ef]">
                {candidates.data.items.filter((user) => user.id !== identity.user.id).map((user) => (
                  <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0"><p className="font-medium">{user.name}</p><p className="break-all text-sm text-[#716778]">{user.email}</p></div>
                    {user.nightklassAdmin ? <Badge value={user.nightklassAdmin.role} /> : (
                      <button className="btn-secondary px-4" aria-label={`Select ${user.email}`} aria-pressed={selected?.id === user.id} onClick={() => { setSelected(user); setRole('ADMIN') }}>
                        {selected?.id === user.id ? 'Selected' : 'Select'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!candidates.data.items.some((user) => user.id !== identity.user.id) && <p className="py-5 text-sm text-[#716778]">No other active accounts found. Ask the person to create a Nightklass account first.</p>}
              <Pagination page={page} total={candidates.data.total} onPage={(next) => { setPage(next); setSelected(null) }} />
            </>
          )}
          {selected && (
            <div className="mt-5 rounded-xl bg-[#f3edff] p-4">
              <p className="break-all text-sm font-medium">Grant access to {selected.email}</p>
              <label className="mt-4 block text-sm font-medium">Permission
                <select className="input-base mt-2 w-full" value={role} onChange={(event) => setRole(event.target.value)}>
                  <option value="ADMIN">Admin — manage learners and content</option>
                  <option value="OWNER">Owner — also manage administrators</option>
                </select>
              </label>
              <div className="mt-4"><ActionDialog label="Grant access" title="Grant administrative access?" description={`${selected.email} will receive ${role.toLowerCase()} access. Owners can also grant and revoke administrative permissions.`} endpoint={`users/${selected.id}/admin-access`} payload={{ role }} onSuccess={() => {
                setNotice(`Administrative access granted to ${selected.email}.`)
                setSelected(null)
                setAdding(false)
                state.reload()
              }} /></div>
            </div>
          )}
        </section>
      )}
      <div className="mt-8 rounded-2xl border border-[#e5d8fb] bg-[#f3edff] p-5 text-sm leading-relaxed text-violet-900">
        {identity.role === 'OWNER' ? (
          <>
            Add administrators above. To change or revoke access, open their{' '}
            <Link className="font-semibold underline" href="/admin/users">
              account page
            </Link>
            . You cannot change your own access or suspend an administrator.
          </>
        ) : (
          'You can review the team. Contact a platform owner to change administrative access.'
        )}
      </div>
      <DataState {...state} />
      {state.data && (
        <div
          className="admin-table mt-6"
          tabIndex={0}
          role="region"
          aria-label="Authorized administrators"
        >
          <table>
            <caption className="sr-only">
              Authorized Nightklass administrators, up to 100 accounts
            </caption>
            <thead>
              <tr>
                <th scope="col">Administrator</th>
                <th scope="col">Permission</th>
                <th scope="col">Account</th>
                <th scope="col">Granted</th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((g) => (
                <tr key={g.user.id}>
                  <td>
                    <Link
                      href={`/admin/users/${g.user.id}`}
                      className="inline-flex min-h-11 items-center font-medium text-violet-800"
                    >
                      {g.user.name}
                    </Link>
                    <p className="text-xs text-[#716778]">{g.user.email}</p>
                  </td>
                  <td>
                    <Badge value={g.role} />
                  </td>
                  <td>
                    <Badge value={g.user.status} />
                  </td>
                  <td>{date(g.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
