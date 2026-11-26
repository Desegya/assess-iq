'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** For students who were given a class code instead of a link. */
export default function EnterClassCodePage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-slate-900">Join a class</h1>
        <p className="mt-1.5 text-sm text-slate-500">Enter the class code your lecturer shared, for example K7QP-3MXD.</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault()
          const clean = code.trim().toUpperCase().replace(/\s+/g, '')
          if (clean) router.push(`/join/${encodeURIComponent(clean)}`)
        }}
      >
        <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-slate-700">
          Class code
        </label>
        <input
          id="code"
          required
          autoCapitalize="characters"
          autoComplete="off"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="XXXX-XXXX"
          className="input-base font-mono tracking-widest uppercase"
        />
        <button type="submit" className="btn-primary w-full">
          Continue
        </button>
      </form>
    </div>
  )
}
