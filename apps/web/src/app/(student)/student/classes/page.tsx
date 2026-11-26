'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/use-api'

interface MyClass {
  id: string
  status: 'ACTIVE' | 'PENDING'
  course: { id: string; title: string; courseCode: string | null; lecturer: string | null; openAssessments: number }
}

export default function MyClassesPage() {
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api
  const router = useRouter()
  const [classes, setClasses] = useState<MyClass[] | null>(null)
  const [code, setCode] = useState('')

  useEffect(() => {
    void apiRef.current.get<MyClass[]>('/classes/mine').then(setClasses).catch(() => setClasses([]))
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">My classes</h1>
        <p className="mt-1 text-sm text-slate-500">Tests your lecturers publish for these classes appear under Tests.</p>
      </div>

      <form
        className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
        onSubmit={e => {
          e.preventDefault()
          const clean = code.trim().toUpperCase().replace(/\s+/g, '')
          if (clean) router.push(`/join/${encodeURIComponent(clean)}`)
        }}
      >
        <div className="flex-1">
          <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-slate-700">Join another class</label>
          <input id="code" value={code} onChange={e => setCode(e.target.value)} placeholder="Class code, e.g. K7QP-3MXD" className="input-base font-mono uppercase" />
        </div>
        <button type="submit" className="btn-primary">Join</button>
      </form>

      {classes === null ? (
        <p role="status" className="text-sm text-slate-500">Loading…</p>
      ) : classes.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="product-display !text-[30px]">No classes yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Open the class link your lecturer shared, or enter its code above.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map(c => (
            <div key={c.id} className="card p-5">
              <p className="text-xs font-medium text-violet-700">{c.course.courseCode ?? 'Class'}</p>
              <h2 className="mt-1 text-base font-semibold text-slate-900">{c.course.title}</h2>
              {c.course.lecturer && <p className="mt-1 text-xs text-slate-500">{c.course.lecturer}</p>}
              {c.status === 'PENDING' ? (
                <p className="mt-4 text-sm text-amber-700">Waiting for your lecturer to let you in.</p>
              ) : (
                <Link href="/student/assessments" className="mt-4 inline-flex text-sm font-medium text-violet-700 hover:underline">
                  {c.course.openAssessments} open test{c.course.openAssessments === 1 ? '' : 's'} →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
