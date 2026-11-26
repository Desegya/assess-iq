'use client'

import { useEffect, useState } from 'react'

/** Small building blocks shared by the KwikEval sign-in and sign-up forms. */

// Until React hydrates, a submit would fall back to a native form post; keep buttons
// disabled so a fast tap on a slow phone never loses or exposes input.
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated
}

export function Notice({ kind, children }: { kind: 'error' | 'ok' | 'info'; children: React.ReactNode }) {
  const tone =
    kind === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : kind === 'ok'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-violet-200 bg-violet-50 text-violet-800'
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${tone}`}>
      {children}
    </div>
  )
}

export function Field({
  id,
  label,
  hint,
  ...input
}: { id: string; label: string; hint?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input id={id} name={id} className="input-base" aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  )
}

export function PasswordField({
  id = 'password',
  label = 'Password',
  autoComplete,
  value,
  onChange,
  disabled,
  extra,
}: {
  id?: string
  label?: string
  autoComplete: 'current-password' | 'new-password'
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  extra?: React.ReactNode
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        minLength={autoComplete === 'new-password' ? 8 : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="input-base"
      />
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="inline-flex min-h-11 items-center text-xs font-medium text-slate-500 hover:text-violet-700"
        >
          {show ? 'Hide password' : 'Show password'}
        </button>
        {extra}
      </div>
    </div>
  )
}

export function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 text-sm text-slate-600">
      <input type="checkbox" required checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5" />
      <span>
        I agree to the{' '}
        <a href="/terms" target="_blank" className="font-medium text-violet-700 hover:underline">
          Terms
        </a>{' '}
        and{' '}
        <a href="/privacy" target="_blank" className="font-medium text-violet-700 hover:underline">
          Privacy notice
        </a>
        .
      </span>
    </label>
  )
}

export interface SessionResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: { id: string; name: string; email: string; role: string; organizationId: string | null; emailVerifiedAt?: string | null }
}
