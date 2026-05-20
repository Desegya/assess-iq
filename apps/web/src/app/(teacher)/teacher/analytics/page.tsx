import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Analytics' }

export default function AnalyticsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-0.5">Student performance and weak topic insights.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500 font-medium">No data yet</p>
        <p className="text-gray-400 text-sm mt-1">
          Analytics will appear once students start completing assessments.
        </p>
      </div>
    </div>
  )
}
