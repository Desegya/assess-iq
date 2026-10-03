import { redirect } from 'next/navigation'

// Notes became full lessons; keep old links working
export default async function NotesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/topics/${id}/learn`)
}
