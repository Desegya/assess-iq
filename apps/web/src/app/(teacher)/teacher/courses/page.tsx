import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'My Courses' }

export default function CoursesPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Courses</h1>
          <p className="text-gray-500 text-sm mt-0.5">Organise your subjects and topics.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + New course
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500 font-medium">No courses yet</p>
        <p className="text-gray-400 text-sm mt-1">Create a course to start organising your documents and assessments.</p>
      </div>
    </div>
  )
}
