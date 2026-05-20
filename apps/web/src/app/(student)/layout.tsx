// Student portal layout — lighter nav, mobile-friendly
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <span className="text-xl font-bold text-indigo-700">AssessIQ</span>
          <span className="block text-xs text-gray-400 mt-0.5">Student Portal</span>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6">
          <span className="text-sm text-gray-500">Student Portal</span>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
