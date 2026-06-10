import { TeacherSidebar } from '@/components/teacher/TeacherSidebar'
import { AuthGuard } from '@/components/auth/AuthGuard'

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-[#F7F8FC]">
        <TeacherSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-auto p-6 lg:p-8">
            <div className="animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
