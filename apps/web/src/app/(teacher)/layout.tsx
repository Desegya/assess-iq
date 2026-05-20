import { TeacherSidebar } from '@/components/teacher/TeacherSidebar'

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <TeacherSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
