'use client'
import Link from 'next/link'
import { PageHeader } from '@/components/product/PageHeader'
import { Badge, DataState } from './AdminUI'
import { date, useAdminData } from './admin-api'
import { useAdminIdentity } from './AdminShell'
export function AdminAccess() {
  const state = useAdminData<{ role: string; createdAt: string; user: { id: string; name: string; email: string; status: string } }[]>('access')
  const identity = useAdminIdentity()
  return <><PageHeader eyebrow="Security" title="A trusted team." description="Nightklass access is separate from institutional roles. Only owners can grant or revoke administration access." icon="user" />
    <div className="mt-8 rounded-2xl border border-[#e5d8fb] bg-[#f3edff] p-5 text-sm leading-relaxed text-violet-900">{identity.role === 'OWNER' ? <>Manage access from a <Link className="font-semibold underline" href="/admin/users">learner’s account page</Link>. You cannot change your own access or suspend an administrator.</> : 'You can review the team. Contact a platform owner to change administrative access.'}</div>
    <DataState {...state} />{state.data && <div className="admin-table mt-6"><table><caption className="sr-only">Authorized Nightklass administrators, up to 100 accounts</caption><thead><tr><th scope="col">Administrator</th><th scope="col">Permission</th><th scope="col">Account</th><th scope="col">Granted</th></tr></thead><tbody>{state.data.map(g => <tr key={g.user.id}><td><Link href={`/admin/users/${g.user.id}`} className="inline-flex min-h-11 items-center font-medium text-violet-800">{g.user.name}</Link><p className="text-xs text-[#716778]">{g.user.email}</p></td><td><Badge value={g.role} /></td><td><Badge value={g.user.status} /></td><td>{date(g.createdAt)}</td></tr>)}</tbody></table></div>}</>
}
