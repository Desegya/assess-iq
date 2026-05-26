import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Analytics' }

export default function AnalyticsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">
          Student performance and weak topic insights.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="font-heading font-semibold text-slate-700 text-lg">No data yet</p>
        <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
          Analytics will appear once students start completing assessments.
        </p>
        <a href="/teacher/assessments"
           className="mt-5 inline-block text-sm font-semibold text-violet-600
                      hover:text-violet-700 transition-colors">
          View Assessments →
        </a>
      </div>
    </div>
  )
}
