import type { Metadata } from 'next'
import { Suspense } from 'react'
import { StudentSignupForm } from '@/components/auth/SignupForms'

export const metadata: Metadata = { title: 'Student sign-up' }

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <StudentSignupForm />
    </Suspense>
  )
}
