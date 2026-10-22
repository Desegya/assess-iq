'use client'

import { useState } from 'react'
import { Icon } from '@/components/product/Icon'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth, type AuthUser } from '@/contexts/auth-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthUser
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()

  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message ?? 'Login failed')
      }

      const data = (await res.json()) as LoginResponse
      login(data.user, data.accessToken, data.refreshToken, data.expiresIn)
      router.push(searchParams.get('redirect') ?? '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[.12em] text-violet-700">
          <Icon name="spark" className="h-4 w-4" />
          Your study space
        </p>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="text-slate-500 text-sm mt-1.5">Sign in to continue your study plan</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
          >
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={loading}
            className="input-base"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
            Password
          </label>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            className="input-base"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          aria-pressed={showPassword}
          className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-slate-500 hover:text-violet-700"
        >
          <Icon name={showPassword ? 'eyeOff' : 'eye'} className="h-4 w-4" />
          {showPassword ? 'Hide password' : 'Show password'}
        </button>
        <a href="/forgot-password" className="ml-4 inline-flex min-h-11 items-center text-xs font-medium text-violet-600 hover:text-violet-700">
          Forgot password?
        </a>

        <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        New to Nightklass?{' '}
        <a
          href="/register"
          className="text-violet-600 hover:text-violet-700 font-semibold transition-colors"
        >
          Create an account
        </a>
      </p>
    </div>
  )
}
