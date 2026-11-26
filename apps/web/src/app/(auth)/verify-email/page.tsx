import type { Metadata } from 'next'
import { VerifyEmail } from '@/components/auth/AccountRecovery'

export const metadata: Metadata = { title: 'Confirm your email' }

export default function Page() {
  return <VerifyEmail />
}
