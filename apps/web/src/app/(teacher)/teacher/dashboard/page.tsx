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

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, color, href,
}: {
  label: string; value: number | string; sub: string
  icon: React.ReactNode; color: string; href: string
}) {
  const router = useRouter()
  return (
    <div
      onClick={() => router.push(href)}
      className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer
                 hover:border-indigo-200 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center
                        ${color.replace('text-', 'bg-').replace('600', '100')}
                        group-hover:scale-105 transition-transform`}>
          <span className={color}>{icon}</span>
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

  const [courses, setCourses] = useState<Course[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiRef.current.get<Course[]>('/courses').catch(() => []),
      apiRef.current.get<Assessment[]>('/assessments').catch(() => []),
      apiRef.current.get<Question[]>('/questions').catch(() => []),
      apiRef.current.get<Student[]>('/users/students').catch(() => []),
    ]).then(([c, a, q, s]) => {
      setCourses(c)
      setAssessments(a)
      setQuestions(q)
      setStudents(s)
    }).finally(() => setLoading(false))
  }, [])

  const publishedAssessments = assessments.filter(
    a => a.status === 'PUBLISHED' || a.status === 'ACTIVE',
  )
  const approvedQuestions = questions.filter(q => q.status === 'APPROVED')
  const draftQuestions = questions.filter(q => q.status === 'DRAFT')
  const recentAssessments = assessments.slice(0, 5)

  const firstName = user?.name?.split(' ')[0] ?? 'Teacher'

  return (
    <div className="max-w-6xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {loading ? 'Dashboard' : `Welcome back, ${firstName} 👋`}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Here&apos;s what&apos;s happening in your classes.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Courses"
          value={loading ? '—' : courses.length}
          sub="Active subjects"
          color="text-indigo-600"
          href="/teacher/courses"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />
        <StatCard
          label="Questions"
          value={loading ? '—' : approvedQuestions.length}
          sub={loading ? '' : `${draftQuestions.length} awaiting review`}
          color="text-emerald-600"
          href="/teacher/questions"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Assessments"
          value={loading ? '—' : publishedAssessments.length}
          sub={loading ? '' : `${assessments.length - publishedAssessments.length} drafts`}
          color="text-amber-600"
          href="/teacher/assessments"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
        />
        <StatCard
          label="Students"
          value={loading ? '—' : students.length}
          sub={loading ? '' : `${students.filter(s => s.status === 'ACTIVE').length} active`}
          color="text-sky-600"
          href="/teacher/students"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Recent assessments */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Recent Assessments</h2>
            <a href="/teacher/assessments" className="text-xs text-indigo-600 hover:underline">
              View all →
            </a>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
          ) : recentAssessments.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-gray-500">No assessments yet.</p>
              <a href="/teacher/assessments" className="text-xs text-indigo-600 hover:underline mt-1 inline-block">
                Create one →
              </a>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentAssessments.map(a => {
                const statusColor =
                  a.status === 'PUBLISHED' || a.status === 'ACTIVE'
                    ? 'text-emerald-600 bg-emerald-50'
                    : 'text-gray-500 bg-gray-100'
                return (
                  <a
                    key={a.id}
                    href={`/teacher/assessments/${a.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{a.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {a.course.title} · {a.totalQuestions} questions · {a._count.attempts} attempts
                      </p>
                    </div>
                    <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded ${statusColor}`}>
                      {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                    </span>
                  </a>
                )
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Draft questions action */}
          {!loading && draftQuestions.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {draftQuestions.length} question{draftQuestions.length !== 1 ? 's' : ''} need review
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Approve them before adding to assessments.
                  </p>
                  <a
                    href="/teacher/questions?status=DRAFT"
                    className="mt-2 inline-block text-xs font-medium text-amber-700 hover:underline"
                  >
                    Review now →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Get started steps */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Quick actions</h2>
            </div>
            <div className="divide-y divide-gray-50">
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
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs
                                  font-bold flex-shrink-0 ${
                    step.done
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {step.done ? '✓' : step.n}
                  </div>
                  <span className={`text-sm flex-1 ${step.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {step.title}
                  </span>
                  <span className={`text-xs font-medium flex-shrink-0 ${
                    step.done ? 'text-emerald-600' : 'text-indigo-600'
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
