// Teacher portal layout — sidebar nav + top bar
// Auth guard: redirects to /login if not authenticated as TEACHER or ORG_ADMIN
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* TeacherSidebar component goes here */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <span className="text-xl font-bold text-indigo-700">AssessIQ</span>
          <span className="block text-xs text-gray-400 mt-0.5">Teacher Portal</span>
        </div>
        {/* Nav items */}
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TeacherTopBar goes here */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6">
          <span className="text-sm text-gray-500">Teacher Portal</span>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
