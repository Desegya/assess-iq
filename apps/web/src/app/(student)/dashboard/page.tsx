import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Student Dashboard' }

export default function StudentDashboardPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Your upcoming tests and recent results.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Courses', value: '0' },
          { label: 'Upcoming tests', value: '0' },
          { label: 'Completed', value: '0' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm">
          Your teacher will enrol you in a course and assign assessments. Check back soon!
        </p>
      </div>
    </div>
  )
}
