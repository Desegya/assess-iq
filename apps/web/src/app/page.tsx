import { redirect } from 'next/navigation'

// Root redirects to login — role-based routing handled in each portal layout
export default function RootPage() {
  redirect('/login')
}
