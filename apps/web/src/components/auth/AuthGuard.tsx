'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Logo } from '@/components/ui/Logo'
import { homeFor } from '@/lib/auth-routes'

export function AuthGuard({ children, allow }: { children: React.ReactNode; allow?: string[] }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const allowed = !!user && (!allow || allow.includes(user.role))

  useEffect(() => {
    if (isLoading) return
    if (!user) router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
    else if (!allowed) router.replace(homeFor(user.role))
  }, [isLoading, user, allowed, router, pathname])

  // Full-page loading screen while the silent refresh is in flight, so a protected
  // page never flashes and nobody is redirected prematurely.
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fcfbfe] flex flex-col items-center justify-center gap-4">
        <Logo size="md" />
        <div className="flex items-center gap-2 mt-2" role="status" aria-label="Loading">
          {[0, 150, 300].map(delay => (
            <div key={delay} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!allowed) return null
  return <>{children}</>
}
