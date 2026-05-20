// Auth layout — centered, no sidebar, no nav
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-700">AssessIQ</h1>
          <p className="text-gray-500 text-sm mt-1">Learn + Assess</p>
        </div>
        {children}
      </div>
    </div>
  )
}
