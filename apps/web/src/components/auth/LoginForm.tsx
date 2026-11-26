'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth, type AuthUser } from '@/contexts/auth-context'
import { publicApi } from '@/lib/api/client'
import { homeFor, safeRedirect } from '@/lib/auth-routes'
import { Field, Notice, PasswordField, useHydrated, type SessionResponse } from './FormParts'

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { login } = useAuth()
  const hydrated = useHydrated()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const redirect = safeRedirect(params.get('redirect'))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await publicApi<SessionResponse>('/auth/login', { email, password })
      login(data.user as AuthUser, data.accessToken, data.refreshToken, data.expiresIn)
      router.push(redirect ?? homeFor(data.user.role))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1.5 text-sm text-slate-500">Sign in to your classes and tests.</p>
      </div>
      <form method="post" onSubmit={e => void handleSubmit(e)} className="space-y-4">
        {error && <Notice kind="error">{error}</Notice>}
        <Field id="email" label="Email address" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
        <PasswordField
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          disabled={loading}
          extra={
            <Link href="/forgot-password" className="ml-auto inline-flex min-h-11 items-center text-xs font-medium text-violet-600 hover:text-violet-700">
              Forgot password?
            </Link>
          }
        />
        <button type="submit" disabled={loading || !hydrated} className="btn-primary mt-2 w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="mt-6 space-y-2 text-center text-sm text-slate-500">
        <p>
          New student?{' '}
          <Link href={`/signup${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-semibold text-violet-600 hover:text-violet-700">
            Create a student account
          </Link>
        </p>
        <p>
          Lecturer?{' '}
          <Link href="/register" className="font-semibold text-violet-600 hover:text-violet-700">
            Start teaching with KwikEval
          </Link>
        </p>
      </div>
    </div>
  )
}
