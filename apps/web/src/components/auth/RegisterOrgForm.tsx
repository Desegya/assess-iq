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
  [OrgType.PRIMARY_SCHOOL]: 'Primary School',
  [OrgType.SECONDARY_SCHOOL]: 'Secondary School',
  [OrgType.UNIVERSITY]: 'University',
  [OrgType.TUTORIAL_CENTER]: 'Tutorial Centre',
  [OrgType.TRAINING_INSTITUTION]: 'Training Institution',
  [OrgType.EXAM_BODY]: 'Exam Body',
  [OrgType.OTHER]: 'Other',
}

export function RegisterOrgForm() {
  const router = useRouter()
  const { login } = useAuth()

  const [form, setForm] = useState({
    orgName: '',
    orgType: OrgType.SECONDARY_SCHOOL as OrgType,
    adminName: '',
    adminEmail: '',
    password: '',
    country: 'Nigeria',
  })
  const [error, setError] = useState<string | null>(null)
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

      // Org admins land on teacher dashboard initially
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
    'w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ' +
    'disabled:bg-gray-50 disabled:text-gray-400'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Institution ────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Institution Details
        </p>

        <div>
          <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-1">
            Institution name
          </label>
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

        <div>
          <label htmlFor="orgType" className="block text-sm font-medium text-gray-700 mb-1">
            Institution type
          </label>
          <select
            id="orgType"
            required
            value={form.orgType}
            onChange={set('orgType')}
            disabled={loading}
            className={inputClass}
          >
            {Object.entries(ORG_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
            Country
          </label>
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

      {/* ── Admin account ───────────────────────────────────── */}
      <div className="space-y-3 pt-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Your Admin Account
        </p>

        <div>
          <label htmlFor="adminName" className="block text-sm font-medium text-gray-700 mb-1">
            Full name
          </label>
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
          <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
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
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-gray-400 font-normal">(min 8 characters)</span>
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
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
                   text-white font-medium py-2.5 px-4 rounded-lg text-sm
                   transition-colors duration-150 flex items-center justify-center gap-2"
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

      <p className="text-center text-xs text-gray-400">
        By registering you agree to our{' '}
        <a href="/terms" className="text-indigo-600 hover:underline">
          Terms of Service
        </a>
        .
      </p>
    </form>
  )
}
