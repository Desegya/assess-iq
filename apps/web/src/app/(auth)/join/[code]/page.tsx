import type { Metadata } from 'next'
import { JoinClass } from '@/components/classes/JoinClass'

export const metadata: Metadata = { title: 'Join a class' }

export default async function JoinClassPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <JoinClass code={decodeURIComponent(code).toUpperCase()} />
}
