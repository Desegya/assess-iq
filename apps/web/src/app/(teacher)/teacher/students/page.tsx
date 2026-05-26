'use client'

import { useState, useEffect, useRef } from 'react'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string
  name: string
  email: string
  status: 'ACTIVE' | 'INACTIVE'
  lastLoginAt: string | null
  createdAt: string
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
      bg-[length:200%_100%] animate-shimmer rounded-lg ${className ?? ''}`} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const api    = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [students,     setStudents]     = useState<Student[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')

  const [showModal,    setShowModal]    = useState(false)
  const [creating,     setCreating]     = useState(false)
  const [createError,  setCreateError]  = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  useEffect(() => {
    void apiRef.current
      .get<Student[]>('/users/students')
      .then(setStudents)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setCreateError(null)
    try {
      const student = await api.post<Student>('/users/students', form)
      setStudents(prev => [student, ...prev])
      setShowModal(false)
      setForm({ name: '', email: '', password: '' })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create student')
    } finally {
      setCreating(false)
    }
  }

  async function handleDeactivate(id: string) {
    await api.patch(`/users/${id}/deactivate`, {}).catch(() => undefined)
    setStudents(prev =>
      prev.map(s => (s.id === id ? { ...s, status: 'INACTIVE' as const } : s)),
    )
  }

  const filtered = students.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = students.filter(s => s.status === 'ACTIVE').length

  const inputClass =
    'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 ' +
    'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 ' +
    'focus:border-violet-500 transition-all duration-150'

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500 text-sm mt-1">
            {students.length} total · {activeCount} active
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white
                     font-semibold px-5 py-2.5 rounded-xl text-sm transition-all duration-150
                     shadow-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Student
        </button>
      </div>

      {/* ── Search ── */}
      {students.length > 0 && (
        <div className="relative mb-4">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
               fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm
                       placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20
                       focus:border-violet-500 transition-all shadow-card"
          />
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        {loading ? (
          <div>
            <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/60 flex gap-6">
              {['Name', 'Email', 'Status', 'Last Login', 'Joined'].map(h => (
                <Skeleton key={h} className="h-3 w-16" />
              ))}
            </div>
            <div className="divide-y divide-slate-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        ) : students.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="font-heading font-semibold text-slate-700 text-lg">No students yet</p>
            <p className="text-slate-400 text-sm mt-2">
              Click &quot;Add Student&quot; to create the first account.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-slate-500 font-medium">No students match &quot;{search}&quot;</p>
            <button onClick={() => setSearch('')}
                    className="mt-2 text-sm text-violet-600 hover:underline">Clear search</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700
                                      flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-800">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{s.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full
                                      text-xs font-semibold ${
                      s.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {s.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleDeactivate(s.id)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium
                                   transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create Student Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center
                        justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-modal w-full max-w-md animate-scale-in">
            <div className="p-6 border-b border-slate-100">
              <h2 className="font-heading text-lg font-bold text-slate-900">Add Student Account</h2>
              <p className="text-sm text-slate-400 mt-1">
                The student will log in with these credentials.
              </p>
            </div>

            <form onSubmit={e => void handleCreate(e)} className="p-6 space-y-4">
              {createError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5 border border-red-100">
                  {createError}
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Amaka Obi"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="amaka@greenfield.edu.ng"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Temporary Password
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  required minLength={8}
                  className={inputClass}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setCreateError(null) }}
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium
                             text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60
                             text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                >
                  {creating ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
