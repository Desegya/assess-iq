'use client'
import Link from 'next/link'
import { PageHeader } from '@/components/product/PageHeader'
import { Icon, type IconName } from '@/components/product/Icon'
import { Badge, DataState } from './AdminUI'
import { date, useAdminData } from './admin-api'
interface Overview { since: string; asOf: string; users: number; newUsers: number; activeLearners: number; courses: number; lessons: number; questions: number; openReports: number; completedSessions: number; quizAttempts: number; averageQuizScore: number | null; aiRequests: number; aiCostUsd: number; recent: { id: string; action: string; resourceType: string; createdAt: string; actor: { name: string } }[] }
export function AdminOverview() {
  const state = useAdminData<Overview>('overview')
  const d = state.data
  const cards: { label: string; value: number; detail: string; icon: IconName; href: string }[] = d ? [
    { label: 'Registered learners', value: d.users, detail: `${d.newUsers} joined in the last 30 days`, icon: 'user', href: '/admin/users' },
    { label: 'Active learners', value: d.activeLearners, detail: 'Studied, took a quiz, or reviewed cards in 30 days', icon: 'flame', href: '/admin/activity' },
    { label: 'Personal courses', value: d.courses, detail: `${d.lessons} lesson versions · ${d.questions} questions`, icon: 'book', href: '/admin/courses' },
    { label: 'Reports to review', value: d.openReports, detail: 'Open reports on learner lesson content', icon: 'chat', href: '/admin/reports?status=OPEN' },
  ] : []
  return <>
    <PageHeader eyebrow="Nightklass administration" title="A clear view of your platform." description="Keep learners supported and learning content useful." icon="chart" action={<button className="btn-secondary px-5" onClick={state.reload}>Refresh data</button>} />
    <DataState {...state} />
    {d && <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(c => <Link key={c.label} href={c.href} className="card p-6"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3edff] text-violet-700"><Icon name={c.icon} /></span><p className="mt-5 text-xs font-medium text-[#716778]">{c.label}</p><p className="mt-2 text-4xl font-semibold tracking-tight">{c.value.toLocaleString()}</p><p className="mt-3 text-xs leading-relaxed text-[#716778]">{c.detail}</p></Link>)}</div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <section className="card p-6"><h2 className="text-lg font-semibold">Learning in the last 30 days</h2><p className="mt-2 text-xs text-[#716778]">{date(d.since)} – {date(d.asOf)} · rolling UTC window</p><dl className="mt-6 space-y-5">{[['Completed study sessions',d.completedSessions.toLocaleString()],['Graded self-quiz attempts',d.quizAttempts.toLocaleString()],['Average quiz score',d.averageQuizScore === null ? 'No graded attempts yet' : `${Math.round(d.averageQuizScore)}%`],['AI requests',d.aiRequests.toLocaleString()],['Recorded AI cost',`$${d.aiCostUsd.toFixed(2)}`]].map(([label,value]) => <div key={label} className="flex justify-between gap-4 border-b border-[#eae6ef] pb-4 text-sm"><dt className="text-[#716778]">{label}</dt><dd className="text-right font-medium">{value}</dd></div>)}</dl></section>
        <section className="card p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Recent administrative activity</h2><Link href="/admin/audit" className="inline-flex min-h-11 items-center text-xs font-medium text-violet-800">View history →</Link></div>{d.recent.length ? <ul className="mt-4 divide-y divide-[#eae6ef]">{d.recent.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="text-sm font-medium">{a.action.toLowerCase().replaceAll('_',' ')}</p><p className="mt-1 text-xs text-[#716778]">{a.actor.name} · {date(a.createdAt)}</p></div><Badge value={a.resourceType} /></li>)}</ul> : <p className="py-8 text-sm text-[#716778]">Administrative actions will appear here as your team works.</p>}</section>
      </div>
    </>}
  </>
}
