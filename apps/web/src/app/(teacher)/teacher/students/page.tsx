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

interface BulkResult {
  total: number
  created: number
  skipped: number
  results: { name: string; email: string; status: 'created' | 'skipped'; reason?: string }[]
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
      bg-[length:200%_100%] animate-shimmer rounded-lg ${className ?? ''}`} />
  )
}

const inputClass =
  'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 ' +
  'focus:border-violet-500 transition-all duration-150'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const api    = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [students,     setStudents]     = useState<Student[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [joinCode,     setJoinCode]     = useState<string | null>(null)
  const [orgName,      setOrgName]      = useState<string | null>(null)
  const [copied,       setCopied]       = useState(false)

  // Single-add modal
  const [showModal,    setShowModal]    = useState(false)
  const [creating,     setCreating]     = useState(false)
  const [createError,  setCreateError]  = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  // CSV import
  const [showCsv,      setShowCsv]      = useState(false)
  const [csvText,      setCsvText]      = useState('')
  const [importing,    setImporting]    = useState(false)
  const [importResult, setImportResult] = useState<BulkResult | null>(null)
  const [importError,  setImportError]  = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      apiRef.current.get<Student[]>('/users/students').catch(() => []),
      apiRef.current.get<{ joinCode: string; name: string }>('/users/org/join-code').catch(() => null),
    ]).then(([s, org]) => {
      setStudents(s)
      if (org) { setJoinCode(org.joinCode); setOrgName(org.name) }
    }).finally(() => setLoading(false))
  }, [])

  // ── Single create ────────────────────────────────────────────────────────

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

  // ── CSV import ───────────────────────────────────────────────────────────

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCsvText((ev.target?.result as string) ?? '')
    reader.readAsText(file)
  }

  function parseCsv(raw: string) {
    const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean)
    const rows: { name: string; email: string }[] = []
    const errors: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      // Skip header line if it looks like one
      if (i === 0 && /name|email/i.test(line) && !line.includes('@')) continue

      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''))
      const name  = parts[0] ?? ''
      const email = parts[1] ?? ''

      if (!name || !email.includes('@')) {
        errors.push(`Row ${i + 1}: invalid — "${line}"`)
      } else {
        rows.push({ name, email })
      }
    }
    return { rows, errors }
  }

  async function handleImport() {
    const { rows, errors } = parseCsv(csvText)
    if (errors.length > 0) {
      setImportError(`Fix these rows first:\n${errors.slice(0, 5).join('\n')}`)
      return
    }
    if (rows.length === 0) { setImportError('No valid rows found'); return }
    if (rows.length > 500) { setImportError('Maximum 500 students per import'); return }

    setImporting(true); setImportError(null); setImportResult(null)
    try {
      const result = await api.post<BulkResult>('/users/students/bulk', { students: rows })
      setImportResult(result)
      // Refresh the student list
      const fresh = await api.get<Student[]>('/users/students').catch(() => students)
      setStudents(fresh)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // ── Copy join link ────────────────────────────────────────────────────────

  function copyJoinLink() {
    if (!joinCode) return
    const url = `${window.location.origin}/join?code=${joinCode}`
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = students.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()),
  )
  const activeCount = students.filter(s => s.status === 'ACTIVE').length
  const joinUrl = joinCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${joinCode}` : ''

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500 text-sm mt-1">
            {loading ? '—' : `${students.length} total · ${activeCount} active`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowCsv(true); setImportResult(null); setImportError(null) }}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 bg-white
                       hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl
                       transition-all shadow-card"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import CSV
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white
                       font-semibold px-5 py-2.5 rounded-xl text-sm transition-all
                       shadow-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Student
          </button>
        </div>
      </div>

      {/* ── Join code panel ── */}
      {!loading && joinCode && (
        <div className="bg-gradient-to-br from-violet-600 to-violet-700 rounded-2xl p-5 mb-6
                        text-white shadow-glow animate-slide-up">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-violet-200 text-xs font-semibold uppercase tracking-wide mb-1">
                Student Join Code · {orgName}
              </p>
              <p className="text-3xl font-heading font-bold tracking-widest">{joinCode}</p>
              <p className="text-violet-200 text-xs mt-1.5">
                Students go to{' '}
                <span className="text-white font-mono">/join</span>
                {' '}and enter this code to self-register
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Copy link */}
              <button
                onClick={copyJoinLink}
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25
                           text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy link
                  </>
                )}
              </button>

              {/* Open join page */}
              <a
                href={joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25
                           text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Preview
              </a>
            </div>
          </div>
        </div>
      )}

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
            <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
              Share the join code above, add students manually, or import a CSV.
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
                {['Name', 'Email', 'Status', 'Last Login', 'Joined', ''].map(h => (
                  <th key={h} className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
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
                      {s.status === 'ACTIVE' ? 'Active' : 'Inactive'}
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

      {/* ── Single Create Modal ── */}
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
                <input type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Amaka Obi" required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                <input type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="amaka@greenfield.edu.ng" required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Temporary Password</label>
                <input type="password" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 characters" required minLength={8} className={inputClass} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button"
                  onClick={() => { setShowModal(false); setCreateError(null) }}
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium
                             text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60
                             text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98]">
                  {creating ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CSV Import Modal ── */}
      {showCsv && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center
                        justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-modal w-full max-w-lg animate-scale-in">
            <div className="p-6 border-b border-slate-100">
              <h2 className="font-heading text-lg font-bold text-slate-900">Import Students via CSV</h2>
              <p className="text-sm text-slate-400 mt-1">
                Upload a CSV file or paste the data directly. Max 500 rows.
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Format hint */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                <p className="text-xs font-semibold text-slate-600 mb-1.5">Expected format:</p>
                <code className="text-xs text-slate-500 font-mono leading-relaxed">
                  name,email<br />
                  Amaka Obi,amaka@school.edu.ng<br />
                  Chidi Eze,chidi@school.edu.ng
                </code>
                <p className="text-xs text-slate-400 mt-2">
                  Password defaults to <code className="bg-white px-1 rounded border">Student123!</code> if omitted.
                  Students should change it on first login.
                </p>
              </div>

              {/* File upload */}
              <div>
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileUpload}
                       className="hidden" />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-200 rounded-xl p-5
                             hover:border-violet-300 hover:bg-violet-50/30 transition-all
                             flex flex-col items-center gap-2 text-slate-400 hover:text-violet-600"
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-sm font-medium">Click to upload CSV file</span>
                  <span className="text-xs">or paste below</span>
                </button>
              </div>

              {/* Paste area */}
              <textarea
                value={csvText}
                onChange={e => { setCsvText(e.target.value); setImportError(null); setImportResult(null) }}
                placeholder="name,email&#10;Amaka Obi,amaka@school.edu.ng"
                rows={6}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm
                           font-mono placeholder:text-slate-300 focus:outline-none focus:ring-2
                           focus:ring-violet-500/20 focus:border-violet-500 transition-all resize-none"
              />

              {/* Preview count */}
              {csvText.trim() && (
                <p className="text-xs text-slate-500">
                  {(() => {
                    const { rows } = parseCsv(csvText)
                    return `${rows.length} valid row${rows.length !== 1 ? 's' : ''} detected`
                  })()}
                </p>
              )}

              {/* Error */}
              {importError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-xs text-red-600 whitespace-pre-wrap">{importError}</p>
                </div>
              )}

              {/* Success result */}
              {importResult && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm font-semibold text-emerald-800">
                      Import complete — {importResult.created} created, {importResult.skipped} skipped
                    </p>
                  </div>
                  {importResult.skipped > 0 && (
                    <div className="space-y-1">
                      {importResult.results
                        .filter(r => r.status === 'skipped')
                        .slice(0, 3)
                        .map((r, i) => (
                          <p key={i} className="text-xs text-emerald-700">
                            Skipped {r.email} — {r.reason}
                          </p>
                        ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowCsv(false); setCsvText(''); setImportResult(null); setImportError(null) }}
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium
                             text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {importResult ? 'Close' : 'Cancel'}
                </button>
                {!importResult && (
                  <button
                    onClick={() => void handleImport()}
                    disabled={importing || !csvText.trim()}
                    className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60
                               text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98]
                               flex items-center justify-center gap-2"
                  >
                    {importing ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Importing…
                      </>
                    ) : 'Import Students'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
