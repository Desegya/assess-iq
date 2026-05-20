import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Question Bank' }

export default function QuestionsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
          <p className="text-gray-500 text-sm mt-0.5">All AI-generated and manually created questions.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500 font-medium">No questions yet</p>
        <p className="text-gray-400 text-sm mt-1">
          Upload a document and generate questions from it.
        </p>
        <a
          href="/teacher/documents"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
        >
          Upload a document →
        </a>
      </div>
    </div>
  )
}
