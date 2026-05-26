import type { Metadata } from 'next'
import Link from 'next/link'
import { RegisterOrgForm } from '@/components/auth/RegisterOrgForm'

export const metadata: Metadata = { title: 'Register Institution' }

export default function RegisterPage() {
  return (
    <div>
      {/* Card */}
      <div className="bg-white rounded-3xl shadow-card border border-slate-200 p-8 animate-scale-in">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-violet-50 text-violet-700 text-xs font-semibold
                          px-3 py-1.5 rounded-full mb-4">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            30 days free — no credit card required
          </div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Register your institution</h2>
          <p className="text-slate-500 text-sm mt-1.5">
            Get your school set up in under 2 minutes.
          </p>
        </div>

        <RegisterOrgForm />
      </div>

      <p className="text-center text-sm text-slate-500 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-violet-600 hover:text-violet-700 font-semibold transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  )
}
