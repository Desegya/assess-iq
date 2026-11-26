import type { Metadata } from 'next'
import { LecturerSignupForm } from '@/components/auth/SignupForms'

export const metadata: Metadata = { title: 'Lecturer sign-up' }

export default function RegisterPage() {
  return <LecturerSignupForm />
}
