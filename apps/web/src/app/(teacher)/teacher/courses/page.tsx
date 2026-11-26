'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApi } from '@/hooks/use-api'
import { useAuth } from '@/contexts/auth-context'
import { Notice } from '@/components/auth/FormParts'
import { POLICY_OPTIONS, schoolDomainOf, type JoinPolicy } from '@/lib/classes'

interface ClassItem {
  id: string
  title: string
  subject: string
  courseCode?: string | null
  joinPolicy: JoinPolicy
  allowedEmailDomains: string[]
  joiningOpen: boolean
  _count?: { questions?: number; assessments?: number; enrollments?: number }
}

const policyLabel = (c: ClassItem) =>
  c.joinPolicy === 'EMAIL_DOMAIN' && c.allowedEmailDomains.length
    ? `School email (${c.allowedEmailDomains.map(d => `@${d}`).join(', ')})`
    : POLICY_OPTIONS.find(o => o.value === c.joinPolicy)?.label ?? c.joinPolicy

export default function ClassesPage() {
  return (
    <Suspense fallback={null}>
      <Classes />
    </Suspense>
  )
}

function Classes() {
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api
  const router = useRouter()
  const params = useSearchParams()
  const welcome = params.get('welcome') === '1'
  const { user } = useAuth()

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    void apiRef.current
      .get<ClassItem[]>('/courses')
      .then(setClasses)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (welcome && !loading && classes.length === 0) setOpen(true)
  }, [welcome, loading, classes.length])

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Classes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Each class has its own link. Students join with it, then see every test you publish for that class.
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">
          New class
        </button>
      </div>

      {welcome && classes.length === 0 && !loading && (
        <div className="mb-6">
          <Notice kind="info">
            Welcome! Start by creating your first class. You will get a link to share with your students.
          </Notice>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="card h-44 p-5">
              <div className="skeleton mb-3 h-5 w-32" />
              <div className="skeleton h-3 w-20" />
            </div>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="product-display !text-[32px]">No classes yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Create a class for each course you teach. Tests and question banks are organised by class.
          </p>
          <button onClick={() => setOpen(true)} className="btn-primary mx-auto mt-6">
            Create your first class
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map(c => (
            <Link key={c.id} href={`/teacher/courses/${c.id}`} className="card flex flex-col p-5 hover:border-violet-200">
              <p className="text-xs font-medium text-violet-700">{c.courseCode || c.subject}</p>
              <h2 className="mt-1 text-base font-semibold text-slate-900">{c.title}</h2>
              <p className="mt-3 text-xs text-slate-500">{policyLabel(c)}</p>
              {!c.joiningOpen && <p className="mt-1 text-xs font-medium text-amber-700">Joining closed</p>}
              <div className="mt-auto flex gap-4 pt-5 text-xs text-slate-500">
                <span>{c._count?.enrollments ?? 0} students</span>
                <span>{c._count?.assessments ?? 0} tests</span>
                <span>{c._count?.questions ?? 0} questions</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {open && (
        <CreateClassDialog
          suggestedDomain={schoolDomainOf(user?.email)}
          onClose={() => setOpen(false)}
          onCreated={id => router.push(`/teacher/courses/${id}?created=1`)}
        />
      )}
    </div>
  )
}

function CreateClassDialog({
  suggestedDomain,
  onClose,
  onCreated,
}: {
  suggestedDomain: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const api = useApi()
  const [title, setTitle] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [policy, setPolicy] = useState<JoinPolicy>(suggestedDomain ? 'EMAIL_DOMAIN' : 'APPROVAL')
  const [domains, setDomains] = useState(suggestedDomain)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const domainList = domains.split(/[\s,]+/).map(d => d.trim()).filter(Boolean)
    if (policy === 'EMAIL_DOMAIN' && domainList.length === 0) {
      setError('Enter your school email domain, for example ug.edu.gh')
      return
    }
    setSaving(true)
    try {
      const course = await api.post<{ id: string }>('/courses', {
        title: title.trim(),
        courseCode: courseCode.trim() || undefined,
      })
      try {
        await api.patch(`/classes/${course.id}/access`, {
          joinPolicy: policy,
          ...(policy === 'EMAIL_DOMAIN' ? { allowedEmailDomains: domainList } : {}),
        })
      } catch (err) {
        // The class exists; let the lecturer fix the rule on its page instead of creating a duplicate
        onCreated(course.id)
        throw err
      }
      onCreated(course.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the class')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="new-class-title">
      <form onSubmit={e => void create(e)} className="w-full max-w-lg rounded-3xl bg-white shadow-modal animate-scale-in">
        <div className="border-b border-slate-100 p-6">
          <h2 id="new-class-title" className="text-lg font-semibold text-slate-900">New class</h2>
          <p className="mt-1 text-sm text-slate-500">You can change who can join at any time.</p>
        </div>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
          {error && <Notice kind="error">{error}</Notice>}
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <div>
              <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-slate-700">Class name</label>
              <input id="title" required minLength={2} value={title} onChange={e => setTitle(e.target.value)} placeholder="Introduction to Biology" className="input-base" />
            </div>
            <div>
              <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-slate-700">Course code</label>
              <input id="code" value={courseCode} onChange={e => setCourseCode(e.target.value)} placeholder="BIOL 101" className="input-base" />
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">Who can join?</legend>
            <div className="space-y-2">
              {POLICY_OPTIONS.map(o => (
                <label key={o.value} className={`flex cursor-pointer gap-3 rounded-2xl border p-3 ${policy === o.value ? 'border-violet-300 bg-violet-50' : 'border-slate-200'}`}>
                  <input type="radio" name="policy" value={o.value} checked={policy === o.value} onChange={() => setPolicy(o.value)} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{o.label}</span>
                    <span className="block text-xs text-slate-500">{o.help}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {policy === 'EMAIL_DOMAIN' && (
            <div>
              <label htmlFor="domains" className="mb-1.5 block text-sm font-medium text-slate-700">School email domain</label>
              <input id="domains" value={domains} onChange={e => setDomains(e.target.value)} placeholder="ug.edu.gh" className="input-base" />
              <p className="mt-1.5 text-xs text-slate-500">
                Separate several with commas. Sub-domains count too: ug.edu.gh also lets in st.ug.edu.gh.
              </p>
            </div>
          )}
          {policy === 'EMAIL_LIST' && (
            <p className="text-xs text-slate-500">You will add the student emails on the next screen.</p>
          )}
        </div>
        <div className="flex gap-3 border-t border-slate-100 p-6">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Creating…' : 'Create class'}</button>
        </div>
      </form>
    </div>
  )
}
