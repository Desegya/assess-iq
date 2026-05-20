'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { UserRole } from '@assessiq/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  organizationId: string | null
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (user: AuthUser, accessToken: string, refreshToken: string, expiresIn: number) => void
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<boolean>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Storage helpers ──────────────────────────────────────────────────────────

const REFRESH_KEY = 'assessiq:refreshToken'
const USER_KEY = 'assessiq:user'
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

function setTokenCookie(token: string, maxAge: number) {
  document.cookie = `accessToken=${token}; path=/; max-age=${maxAge}; SameSite=Strict`
}

function clearTokenCookie() {
  document.cookie = 'accessToken=; path=/; max-age=0'
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
  })
  const router = useRouter()

  // On mount: read stored user + refresh the access token
  useEffect(() => {
    const storedUser = localStorage.getItem(USER_KEY)
    const storedRefresh = localStorage.getItem(REFRESH_KEY)

    if (!storedUser || !storedRefresh) {
      setState(s => ({ ...s, isLoading: false }))
      return
    }

    const user = JSON.parse(storedUser) as AuthUser

    // Silently refresh access token (old one has likely expired)
    doRefresh(storedRefresh).then(newAccessToken => {
      if (newAccessToken) {
        setState({ user, accessToken: newAccessToken, isLoading: false })
      } else {
        clearStoredAuth()
        setState({ user: null, accessToken: null, isLoading: false })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Internal refresh helper (no dependency on state) ─────────────────────
  async function doRefresh(refreshTok: string): Promise<string | null> {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshTok }),
      })
      if (!res.ok) return null
      const data = (await res.json()) as {
        accessToken: string
        refreshToken: string
        expiresIn: number
      }
      // Rotate: store the new refresh token
      localStorage.setItem(REFRESH_KEY, data.refreshToken)
      setTokenCookie(data.accessToken, data.expiresIn)
      return data.accessToken
    } catch {
      return null
    }
  }

  function clearStoredAuth() {
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
    clearTokenCookie()
  }

  // ── Public methods ────────────────────────────────────────────────────────

  const login = useCallback(
    (user: AuthUser, accessToken: string, refreshToken: string, expiresIn: number) => {
      localStorage.setItem(REFRESH_KEY, refreshToken)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      setTokenCookie(accessToken, expiresIn)
      setState({ user, accessToken, isLoading: false })
    },
    [],
  )

  const logout = useCallback(async () => {
    const refreshTok = localStorage.getItem(REFRESH_KEY)
    const { accessToken } = state

    // Best-effort server-side revocation
    if (refreshTok && accessToken) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken: refreshTok }),
      }).catch(() => {
        /* ignore */
      })
    }

    clearStoredAuth()
    setState({ user: null, accessToken: null, isLoading: false })
    router.push('/login')
  }, [state, router])

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    const storedRefresh = localStorage.getItem(REFRESH_KEY)
    if (!storedRefresh) return false

    const newToken = await doRefresh(storedRefresh)
    if (newToken) {
      setState(s => ({ ...s, accessToken: newToken }))
      return true
    }

    clearStoredAuth()
    setState({ user: null, accessToken: null, isLoading: false })
    return false
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshAccessToken }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
