'use client'

import { AuthProvider } from '@/contexts/auth-context'

/**
 * Client-side providers wrapper — kept separate from the server root layout
 * so we can import client-only context providers without RSC restrictions.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
