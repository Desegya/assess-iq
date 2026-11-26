'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth, type AuthUser } from '@/contexts/auth-context'
import { publicApi } from '@/lib/api/client'
import { safeRedirect } from '@/lib/auth-routes'
import { Field, Notice, PasswordField, TermsCheckbox, useHydrated, type SessionResponse } from './FormParts'

function useSignup(path: string, next: string) {
  const router = useRouter()
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  async function submit(body: Record<string, unknown>) {
    setError(null)
    setLoading(true)
    try {
      const data = await publicApi<SessionResponse>(path, body)
      login(data.user as AuthUser, data.accessToken, data.refreshToken, data.expiresIn)
      router.push(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }
  return { submit, error, loading }
}

export function LecturerSignupForm() {
  const hydrated = useHydrated()
  const [form, setForm] = useState({ name: '', email: '', institution: '', password: '' })
  const [agreed, setAgreed] = useState(false)
  const { submit, error, loading } = useSignup('/auth/register-lecturer', '/teacher/courses?welcome=1')
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <div>
      <div className="mb-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-[.12em] text-violet-700">For lecturers · free while we grow</p>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Start teaching with KwikEval</h1>
        <p className="mt-1.5 text-sm text-slate-500">You only need an account for yourself. No school sign-up needed.</p>
      </div>
      <form
        method="post"
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault()
          void submit({ ...form, institution: form.institution.trim() || undefined })
        }}
      >
        {error && <Notice kind="error">{error}</Notice>}
        <Field id="name" label="Your name" autoComplete="name" required minLength={2} placeholder="Dr Ama Mensah" value={form.name} onChange={set('name')} disabled={loading} />
        <Field
          id="email"
          label="Work email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@university.edu"
          hint="Use your school email: we suggest its domain when you choose who can join your classes."
          value={form.email}
          onChange={set('email')}
          disabled={loading}
        />
        <Field id="institution" label="Where you teach (optional)" autoComplete="organization" placeholder="University of Ghana" value={form.institution} onChange={set('institution')} disabled={loading} />
        <PasswordField autoComplete="new-password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} disabled={loading} />
        <TermsCheckbox checked={agreed} onChange={setAgreed} />
        <button type="submit" disabled={loading || !hydrated || !agreed} className="btn-primary mt-2 w-full">
          {loading ? 'Creating your account…' : 'Create lecturer account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-violet-600 hover:text-violet-700">
          Sign in
        </Link>
      </p>
    </div>
  )
}

export function StudentSignupForm() {
  const params = useSearchParams()
  const hydrated = useHydrated()
  const redirect = safeRedirect(params.get('redirect'))
  const domain = params.get('domain')?.toLowerCase().replace(/[^a-z0-9.-]/g, '') || null
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [agreed, setAgreed] = useState(false)
  const { submit, error, loading } = useSignup('/auth/register-student', redirect ?? '/student/dashboard')
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value }))
  const emailDomain = form.email.trim().toLowerCase().split('@')[1] ?? ''
  const wrongDomain =
    !!domain && emailDomain.includes('.') && emailDomain !== domain && !emailDomain.endsWith(`.${domain}`)

  return (
    <div>
      <div className="mb-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-[.12em] text-violet-700">Student account</p>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          You will use it for every class you join. We will email you a link to confirm your address.
        </p>
      </div>
      <form
        method="post"
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault()
          void submit({ ...form, app: 'kwikeval' })
        }}
      >
        {error && <Notice kind="error">{error}</Notice>}
        <Field id="name" label="Full name" autoComplete="name" required minLength={2} hint="As your lecturer knows you." value={form.name} onChange={set('name')} disabled={loading} />
        <Field
          id="email"
          label={domain ? 'School email' : 'Email address'}
          type="email"
          autoComplete="email"
          required
          placeholder={domain ? `you@${domain}` : 'you@school.edu'}
          hint={domain ? `Your class accepts emails ending in @${domain}.` : 'Use your school email if your lecturer asked you to.'}
          value={form.email}
          onChange={set('email')}
          disabled={loading}
        />
        {wrongDomain && <Notice kind="info">This class only accepts @{domain} emails. Use your school email or you will not be able to join.</Notice>}
        <PasswordField autoComplete="new-password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} disabled={loading} />
        <TermsCheckbox checked={agreed} onChange={setAgreed} />
        <button type="submit" disabled={loading || !hydrated || !agreed} className="btn-primary mt-2 w-full">
          {loading ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-semibold text-violet-600 hover:text-violet-700">
          Sign in
        </Link>
      </p>
    </div>
  )
}
