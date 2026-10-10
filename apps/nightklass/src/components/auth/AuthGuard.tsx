'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Brand } from '@/components/product/Brand'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login')
    }
  }, [isLoading, user, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fcfbfe] flex flex-col items-center justify-center gap-4">
        <Brand />
        <div className="flex items-center gap-2 mt-2">
          <div
            className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <div
            className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
