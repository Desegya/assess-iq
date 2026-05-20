import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Teacher Dashboard' }

export default function TeacherDashboardPage() {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Welcome back! Here&apos;s what&apos;s happening in your classes.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Courses', value: '0', sub: 'Active', color: 'bg-indigo-50 text-indigo-700' },
          { label: 'Questions', value: '0', sub: 'In bank', color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Assessments', value: '0', sub: 'Published', color: 'bg-amber-50 text-amber-700' },
          { label: 'Students', value: '0', sub: 'Enrolled', color: 'bg-sky-50 text-sky-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color.split(' ')[1]}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Getting started */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Get started</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              step: '1',
              title: 'Upload your notes',
              desc: 'Upload a PDF or DOCX — our AI will read and understand the content.',
              href: '/teacher/documents',
              cta: 'Upload notes →',
            },
            {
              step: '2',
              title: 'Generate questions',
              desc: 'Let AI create MCQ, True/False, and short-answer questions from your material.',
              href: '/teacher/questions',
              cta: 'Generate questions →',
            },
            {
              step: '3',
              title: 'Create an assessment',
              desc: 'Pick questions, set a time limit, and publish for your students.',
              href: '/teacher/assessments',
              cta: 'Create assessment →',
            },
          ].map(card => (
            <a
              key={card.step}
              href={card.href}
              className="block group rounded-lg border border-gray-100 hover:border-indigo-200 bg-gray-50 hover:bg-indigo-50 p-4 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mb-3">
                {card.step}
              </div>
              <h3 className="font-medium text-gray-800 text-sm mb-1">{card.title}</h3>
              <p className="text-xs text-gray-500 mb-3">{card.desc}</p>
              <span className="text-xs font-medium text-indigo-600 group-hover:underline">
                {card.cta}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
