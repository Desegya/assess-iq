'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OrgType, UserRole } from '@assessiq/types'
import { useAuth, type AuthUser } from '@/contexts/auth-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

interface RegisterResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthUser
  organization: { id: string; name: string }
}

const ORG_TYPE_LABELS: Record<OrgType, string> = {
  [OrgType.PRIMARY_SCHOOL]:       'Primary School',
  [OrgType.SECONDARY_SCHOOL]:     'Secondary School',
  [OrgType.UNIVERSITY]:           'University',
  [OrgType.TUTORIAL_CENTER]:      'Tutorial Centre',
  [OrgType.TRAINING_INSTITUTION]: 'Training Institution',
  [OrgType.EXAM_BODY]:            'Exam Body',
  [OrgType.OTHER]:                'Other',
}

export function RegisterOrgForm() {
  const router   = useRouter()
  const { login } = useAuth()

  const [form, setForm] = useState({
    orgName:    '',
    orgType:    OrgType.SECONDARY_SCHOOL as OrgType,
    adminName:  '',
    adminEmail: '',
    password:   '',
    country:    'Nigeria',
  })
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set(field: keyof typeof form) {
    return (e: { target: { value: string } }) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message ?? 'Registration failed')
      }

      const data = (await res.json()) as RegisterResponse
      login(data.user, data.accessToken, data.refreshToken, data.expiresIn)

      const dest =
        data.user.role === UserRole.SUPER_ADMIN ? '/admin/dashboard' : '/teacher/dashboard'
      router.push(dest)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 ' +
    'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 ' +
    'focus:border-violet-500 transition-all duration-150 disabled:bg-slate-50 disabled:text-slate-400'

  const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700
                        text-sm rounded-xl px-4 py-3 animate-slide-up">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Institution ───────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-px flex-1 bg-slate-100" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
            Institution
          </p>
          <div className="h-px flex-1 bg-slate-100" />
        </div>

        <div>
          <label htmlFor="orgName" className={labelClass}>Institution name</label>
          <input
            id="orgName"
            type="text"
            required
            value={form.orgName}
            onChange={set('orgName')}
            placeholder="Greenfield Academy"
            disabled={loading}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="orgType" className={labelClass}>Type</label>
            <select
              id="orgType"
              required
              value={form.orgType}
              onChange={set('orgType')}
              disabled={loading}
              className={inputClass}
            >
              {Object.entries(ORG_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="country" className={labelClass}>Country</label>
            <input
              id="country"
              type="text"
              value={form.country}
              onChange={set('country')}
              placeholder="Nigeria"
              disabled={loading}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* ── Admin account ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-px flex-1 bg-slate-100" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
            Your Admin Account
          </p>
          <div className="h-px flex-1 bg-slate-100" />
        </div>

        <div>
          <label htmlFor="adminName" className={labelClass}>Full name</label>
          <input
            id="adminName"
            type="text"
            required
            value={form.adminName}
            onChange={set('adminName')}
            placeholder="Dr. Chukwuemeka Obi"
            disabled={loading}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="adminEmail" className={labelClass}>Email address</label>
          <input
            id="adminEmail"
            type="email"
            autoComplete="email"
            required
            value={form.adminEmail}
            onChange={set('adminEmail')}
            placeholder="admin@greenfieldacademy.edu.ng"
            disabled={loading}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            Password{' '}
            <span className="text-slate-400 font-normal">(min 8 characters)</span>
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
            placeholder="••••••••"
            disabled={loading}
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.98] disabled:opacity-60
                   text-white font-semibold py-3 px-5 rounded-xl text-sm transition-all duration-150
                   shadow-sm flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Creating account…
          </>
        ) : (
          'Create institution account'
        )}
      </button>

      <p className="text-center text-xs text-slate-400">
        By registering you agree to our{' '}
        <a href="/terms" className="text-violet-600 hover:underline">Terms of Service</a>.
      </p>
    </form>
  )
}
