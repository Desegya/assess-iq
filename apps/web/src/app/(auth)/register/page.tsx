import type { Metadata } from 'next'
import { RegisterOrgForm } from '@/components/auth/RegisterOrgForm'

export const metadata: Metadata = { title: 'Register Institution' }

export default function RegisterPage() {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-1">Register your institution</h2>
      <p className="text-gray-500 text-sm mb-6">
        Get 30 days free — no credit card required.
      </p>
      <RegisterOrgForm />
      <p className="text-center text-xs text-gray-400 mt-6">
        Already have an account?{' '}
        <a href="/login" className="text-indigo-600 hover:underline font-medium">
          Sign in
        </a>
      </p>
    </div>
  )
}
