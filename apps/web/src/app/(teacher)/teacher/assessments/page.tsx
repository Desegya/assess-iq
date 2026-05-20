import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Assessments' }

export default function AssessmentsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
          <p className="text-gray-500 text-sm mt-0.5">Create and manage tests for your students.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + New assessment
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500 font-medium">No assessments yet</p>
        <p className="text-gray-400 text-sm mt-1">
          Build your question bank first, then create an assessment.
        </p>
        <a
          href="/teacher/questions"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
        >
          Go to Question Bank →
        </a>
      </div>
    </div>
  )
}
