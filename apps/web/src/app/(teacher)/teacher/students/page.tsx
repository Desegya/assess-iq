'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
import { Notice } from '@/components/auth/FormParts'

interface ClassItem { id: string; title: string; courseCode?: string | null }
interface Enrollment {
  id: string
  status: 'PENDING' | 'ACTIVE' | 'REMOVED'
  createdAt: string
  student: { id: string; name: string; email: string; emailVerified: boolean }
}
type Row = Enrollment & { classId: string; classTitle: string }

/** Everyone across the lecturer's classes. Students join through each class's link. */
export default function StudentsPage() {
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const list = await apiRef.current.get<ClassItem[]>('/courses').catch(() => [] as ClassItem[])
    setClasses(list)
    const rosters = await Promise.all(
      list.map(c =>
        apiRef.current
          .get<Enrollment[]>(`/classes/${c.id}/students`)
          .then(r => r.map(e => ({ ...e, classId: c.id, classTitle: c.title })))
          .catch(() => [] as Row[]),
      ),
    )
    setRows(rosters.flat())
    setLoading(false)
  }, [])
  useEffect(() => void load(), [load])

  async function decide(row: Row, status: 'ACTIVE' | 'REMOVED') {
    setError(null)
    try {
      const updated = await api.patch<Enrollment[]>(`/classes/${row.classId}/students/${row.id}`, { status })
      setRows(prev => [
        ...prev.filter(r => r.classId !== row.classId),
        ...updated.map(e => ({ ...e, classId: row.classId, classTitle: row.classTitle })),
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the student')
    }
  }

  const q = query.trim().toLowerCase()
  const match = (r: Row) => !q || r.student.name.toLowerCase().includes(q) || r.student.email.toLowerCase().includes(q)
  const pending = rows.filter(r => r.status === 'PENDING' && match(r))
  const active = useMemo(
    () => rows.filter(r => r.status === 'ACTIVE' && match(r)).sort((a, b) => a.student.name.localeCompare(b.student.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, q],
  )
  const uniqueStudents = new Set(rows.filter(r => r.status === 'ACTIVE').map(r => r.student.id)).size

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Students</h1>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? 'Loading…' : `${uniqueStudents} student${uniqueStudents === 1 ? '' : 's'} across ${classes.length} class${classes.length === 1 ? '' : 'es'}.`}{' '}
            Students join through each class&rsquo;s link.
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search name or email"
          aria-label="Search students"
          className="input-base sm:max-w-xs"
        />
      </div>

      {error && <Notice kind="error">{error}</Notice>}

      {!loading && classes.length === 0 && (
        <div className="card p-10 text-center">
          <p className="product-display !text-[30px]">No classes yet</p>
          <p className="mt-2 text-sm text-slate-500">Create a class to get a link your students can join with.</p>
          <Link href="/teacher/courses" className="btn-primary mx-auto mt-5 inline-flex">Create a class</Link>
        </div>
      )}

      {pending.length > 0 && (
        <section className="card p-6">
          <h2 className="product-section-title">Waiting for you ({pending.length})</h2>
          <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {pending.map(r => (
              <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{r.student.name}</p>
                  <p className="truncate text-xs text-slate-500">{r.student.email} · wants to join {r.classTitle}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary !min-h-9 !px-3 !py-1.5 !text-xs" onClick={() => void decide(r, 'ACTIVE')}>Let in</button>
                  <button className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs" onClick={() => void decide(r, 'REMOVED')}>Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {classes.length > 0 && (
        <section className="card overflow-hidden">
          {active.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">{q ? 'No students match your search.' : 'No students have joined yet.'}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Student</th>
                  <th className="hidden px-5 py-3 font-medium sm:table-cell">Class</th>
                  <th className="px-5 py-3 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {active.map(r => (
                  <tr key={r.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{r.student.name}</p>
                      <p className="text-xs text-slate-500">{r.student.email}</p>
                      <p className="text-xs text-slate-500 sm:hidden">{r.classTitle}</p>
                    </td>
                    <td className="hidden px-5 py-3 text-slate-600 sm:table-cell">
                      <Link href={`/teacher/courses/${r.classId}`} className="hover:text-violet-700">{r.classTitle}</Link>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        className="text-xs text-slate-500 hover:text-red-700"
                        onClick={() => {
                          if (confirm(`Remove ${r.student.name} from ${r.classTitle}?`)) void decide(r, 'REMOVED')
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  )
}
