'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useApi } from '@/hooks/use-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Course {
  id: string; title: string; subject: string
  _count: { documents: number; questions: number; assessments: number }
}

interface Assessment {
  id: string; title: string; status: string; totalQuestions: number
  course: { id: string; title: string }
  _count: { attempts: number }
}

interface Question {
  id: string; status: string
}

interface Student {
  id: string; name: string; email: string; status: string
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
      bg-[length:200%_100%] animate-shimmer rounded-lg ${className ?? ''}`} />
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, iconBg, href, delay = 0,
}: {
  label: string; value: number | string; sub: string
  icon: React.ReactNode; iconBg: string; href: string; delay?: number
}) {
  const router = useRouter()
  return (
    <div
      onClick={() => router.push(href)}
      className="bg-white rounded-2xl border border-slate-200 shadow-card hover:shadow-card-hover
                 p-5 cursor-pointer transition-all duration-200 group animate-slide-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-3xl font-heading font-bold text-slate-900 mt-1 tracking-tight">{value}</p>
          <p className="text-xs text-slate-400 mt-1">{sub}</p>
        </div>
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0
                        ${iconBg} group-hover:scale-110 transition-transform duration-200`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const { user } = useAuth()
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const [courses,     setCourses]     = useState<Course[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [questions,   setQuestions]   = useState<Question[]>([])
  const [students,    setStudents]    = useState<Student[]>([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      apiRef.current.get<Course[]>('/courses').catch(() => []),
      apiRef.current.get<Assessment[]>('/assessments').catch(() => []),
      apiRef.current.get<Question[]>('/questions').catch(() => []),
      apiRef.current.get<Student[]>('/users/students').catch(() => []),
    ]).then(([c, a, q, s]) => {
      setCourses(c); setAssessments(a); setQuestions(q); setStudents(s)
    }).finally(() => setLoading(false))
  }, [])

  const publishedAssessments = assessments.filter(
    a => a.status === 'PUBLISHED' || a.status === 'ACTIVE',
  )
  const approvedQuestions = questions.filter(q => q.status === 'APPROVED')
  const draftQuestions    = questions.filter(q => q.status === 'DRAFT')
  const recentAssessments = assessments.slice(0, 5)

  const firstName = user?.name?.split(' ')[0] ?? 'Teacher'

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Greeting ── */}
      <div className="mb-8 animate-slide-up">
        <h1 className="font-heading text-2xl font-bold text-slate-900">
          {loading ? 'Dashboard' : `Welcome back, ${firstName}`}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Here&apos;s what&apos;s happening in your classes.
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
              <Skeleton className="h-4 w-20 mb-3" />
              <Skeleton className="h-8 w-12 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="Courses" value={courses.length} sub="Active subjects"
              iconBg="bg-violet-50" href="/teacher/courses" delay={0}
              icon={
                <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              }
            />
            <StatCard
              label="Questions" value={approvedQuestions.length}
              sub={`${draftQuestions.length} awaiting review`}
              iconBg="bg-emerald-50" href="/teacher/questions" delay={75}
              icon={
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="Assessments" value={publishedAssessments.length}
              sub={`${assessments.length - publishedAssessments.length} drafts`}
              iconBg="bg-amber-50" href="/teacher/assessments" delay={150}
              icon={
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
            />
            <StatCard
              label="Students" value={students.length}
              sub={`${students.filter(s => s.status === 'ACTIVE').length} active`}
              iconBg="bg-sky-50" href="/teacher/students" delay={225}
              icon={
                <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* ── Recent assessments ── */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-card
                        animate-slide-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-heading font-semibold text-slate-800">Recent Assessments</h2>
            <a href="/teacher/assessments"
               className="text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors">
              View all →
            </a>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-50">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : recentAssessments.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-700">No assessments yet</p>
              <a href="/teacher/assessments"
                 className="text-xs text-violet-600 hover:underline mt-1.5 inline-block">
                Create your first assessment →
              </a>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentAssessments.map(a => {
                const isLive = a.status === 'PUBLISHED' || a.status === 'ACTIVE'
                return (
                  <a
                    key={a.id}
                    href={`/teacher/assessments/${a.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {a.course.title} · {a.totalQuestions} questions · {a._count.attempts} attempts
                      </p>
                    </div>
                    <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                    </span>
                  </a>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Draft questions alert */}
          {!loading && draftQuestions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 animate-slide-up"
                 style={{ animationDelay: '350ms', animationFillMode: 'both' }}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {draftQuestions.length} question{draftQuestions.length !== 1 ? 's' : ''} need review
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Approve them before adding to assessments.
                  </p>
                  <a
                    href="/teacher/questions?status=DRAFT"
                    className="mt-2 inline-block text-xs font-semibold text-amber-700
                               hover:text-amber-900 transition-colors"
                  >
                    Review now →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card animate-slide-up"
               style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-heading font-semibold text-slate-800">Getting started</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                {
                  n: '1', done: courses.length > 0,
                  title: 'Create a course',
                  href: '/teacher/courses',
                  cta: courses.length > 0 ? `${courses.length} created` : 'Create →',
                },
                {
                  n: '2', done: questions.length > 0,
                  title: 'Generate questions from notes',
                  href: '/teacher/documents',
                  cta: questions.length > 0 ? `${questions.length} in bank` : 'Upload notes →',
                },
                {
                  n: '3', done: publishedAssessments.length > 0,
                  title: 'Publish an assessment',
                  href: '/teacher/assessments',
                  cta: publishedAssessments.length > 0 ? `${publishedAssessments.length} live` : 'Build one →',
                },
                {
                  n: '4', done: students.length > 0,
                  title: 'Add students',
                  href: '/teacher/students',
                  cta: students.length > 0 ? `${students.length} added` : 'Add students →',
                },
              ].map(step => (
                <a
                  key={step.n}
                  href={step.href}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/80 transition-colors"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs
                                  font-bold flex-shrink-0 ${
                    step.done
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-violet-100 text-violet-700'
                  }`}>
                    {step.done ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : step.n}
                  </div>
                  <span className={`text-sm flex-1 ${step.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {step.title}
                  </span>
                  <span className={`text-xs font-semibold flex-shrink-0 ${
                    step.done ? 'text-emerald-600' : 'text-violet-600'
                  }`}>
                    {step.cta}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
