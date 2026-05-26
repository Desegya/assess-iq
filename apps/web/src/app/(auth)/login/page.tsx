import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = { title: 'Sign In' }

export default function LoginPage() {
  return (
    <div>
      {/* Card */}
      <div className="bg-white rounded-3xl shadow-card border border-slate-200 p-8 animate-scale-in">
        <div className="mb-8">
          <h2 className="font-heading text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="text-slate-500 text-sm mt-1.5">
            Sign in to your account to continue
          </p>
        </div>

        <LoginForm />
      </div>

      <p className="text-center text-sm text-slate-500 mt-6">
        Setting up a new school?{' '}
        <Link href="/register" className="text-violet-600 hover:text-violet-700 font-semibold transition-colors">
          Register your institution
        </Link>
      </p>
    </div>
  )
}
