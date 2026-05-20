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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  // Create modal state
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
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
    setCreating(true)
    setCreateError(null)
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

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage student accounts in your organisation
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium
                     px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Student
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading students…</div>
        ) : students.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-2xl mb-2">🎓</p>
            <p className="text-gray-500 font-medium">No students yet</p>
            <p className="text-gray-400 text-sm mt-1">Click "Add Student" to create the first account.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Last Login</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3.5 font-medium text-gray-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center
                                      text-indigo-700 font-semibold text-xs flex-shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      {s.name}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{s.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      s.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-400">
                    {s.lastLoginAt
                      ? new Date(s.lastLoginAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {s.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleDeactivate(s.id)}
                        className="text-xs text-red-500 hover:underline"
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

      {/* Create Student Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Add Student Account</h2>
              <p className="text-sm text-gray-400 mt-1">
                The student will log in with these credentials.
              </p>
            </div>

            <form onSubmit={e => void handleCreate(e)} className="p-6 space-y-4">
              {createError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Amaka Obi"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="amaka@greenfield.edu.ng"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Temporary Password
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setCreateError(null) }}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium
                             text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
                             text-white rounded-lg text-sm font-medium transition-colors"
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
