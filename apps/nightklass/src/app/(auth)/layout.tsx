import { Logo } from '@/components/ui/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size="md" theme="dark" />
        </div>
        <div className="animate-fade-in">{children}</div>
        <p className="text-center text-xs text-slate-400 mt-8">
          &copy; {new Date().getFullYear()} Nightklass. All rights reserved.
        </p>
      </div>
    </div>
  )
}
