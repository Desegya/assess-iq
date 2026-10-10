import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminShell } from '@/components/admin/AdminShell'
export default async function AdminWorkspace({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  if (!cookieStore.has('nightklass_admin_access') && !cookieStore.has('nightklass_admin_refresh')) redirect('/admin/login')
  return <AdminShell>{children}</AdminShell>
}
