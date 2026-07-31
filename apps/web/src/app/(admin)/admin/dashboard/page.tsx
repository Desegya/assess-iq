import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin Dashboard' }

export default function AdminDashboardPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
        <p className="text-gray-500 text-sm mt-1">KwikEval super-admin console.</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        {[
          { label: 'Organisations', value: '0' },
          { label: 'Users', value: '0' },
          { label: 'Assessments run', value: '0' },
          { label: 'AI tokens used', value: '0' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
