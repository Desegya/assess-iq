// Platform admin layout — full-width tables, detailed stats
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-900">
      <aside className="w-64 bg-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <span className="text-xl font-bold text-white">KwikEval</span>
          <span className="block text-xs text-slate-400 mt-0.5">Platform Admin</span>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center px-6">
          <span className="text-sm text-slate-300">Admin Console</span>
        </header>
        <main className="flex-1 overflow-auto p-6 bg-slate-50">{children}</main>
      </div>
    </div>
  )
}
