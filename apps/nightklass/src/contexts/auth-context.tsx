'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { UserRole } from '@assessiq/types'

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
  /** Resolves to a fresh access token, or null when the session has ended or the network is unavailable. */
  refreshAccessToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const REFRESH_KEY = 'nightklass:refreshToken'
const USER_KEY = 'nightklass:user'
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days, matches server

// Tokens are never written to cookies: cookies travel with every page request
// and end up in hosting logs. The middleware only needs to know a session may
// exist, so it gets a non-secret marker. The refresh token stays in this
// origin's storage and is rotated (with server-side reuse detection) on use.
const SESSION_MARKER = 'nk_session'

function setSessionMarker() {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${SESSION_MARKER}=1; path=/; max-age=${REFRESH_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
  // Remove token cookies written by earlier versions.
  document.cookie = 'accessToken=; path=/; max-age=0'
  document.cookie = 'refreshToken=; path=/; max-age=0'
}

function clearSessionCookies() {
  document.cookie = `${SESSION_MARKER}=; path=/; max-age=0`
  document.cookie = 'accessToken=; path=/; max-age=0'
  document.cookie = 'refreshToken=; path=/; max-age=0'
}

type RefreshResult =
  | { kind: 'ok'; accessToken: string; user: AuthUser }
  | { kind: 'ended' }
  | { kind: 'unreachable' }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, accessToken: null, isLoading: true })
  const router = useRouter()
  // Concurrent 401s (autosave plus page requests) share one rotation of the refresh token.
  const inflight = useRef<Promise<RefreshResult> | null>(null)

  function refreshOnce(): Promise<RefreshResult> {
    const stored = localStorage.getItem(REFRESH_KEY)
    if (!stored) return Promise.resolve({ kind: 'ended' })
    if (!inflight.current)
      inflight.current = doRefresh(stored).finally(() => {
        inflight.current = null
      })
    return inflight.current
  }

  useEffect(() => {
    const storedUser = localStorage.getItem(USER_KEY)
    const storedRefresh = localStorage.getItem(REFRESH_KEY)

    if (!storedUser || !storedRefresh) {
      setState(s => ({ ...s, isLoading: false }))
      return
    }

    refreshOnce().then(result => {
      if (result.kind === 'ok') {
        setState({ user: result.user, accessToken: result.accessToken, isLoading: false })
      } else if (result.kind === 'unreachable') {
        // Show the signed-in shell from the cached profile; requests retry the refresh.
        setState({ user: JSON.parse(storedUser) as AuthUser, accessToken: null, isLoading: false })
      } else {
        clearStoredAuth()
        setState({ user: null, accessToken: null, isLoading: false })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function doRefresh(refreshTok: string): Promise<RefreshResult> {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshTok }),
      })
      // Only an explicit rejection ends the session; throttling or outages do not.
      if (res.status === 401) return { kind: 'ended' }
      if (!res.ok) return { kind: 'unreachable' }
      const data = (await res.json()) as { accessToken: string; refreshToken: string; expiresIn: number }
      localStorage.setItem(REFRESH_KEY, data.refreshToken)
      setSessionMarker()

      const meRes = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      })
      if (meRes.status === 401) return { kind: 'ended' }
      if (!meRes.ok) return { kind: 'unreachable' }
      const freshUser = (await meRes.json()) as AuthUser
      localStorage.setItem(USER_KEY, JSON.stringify(freshUser))

      return { kind: 'ok', accessToken: data.accessToken, user: freshUser }
    } catch {
      // Network failure (offline, dropped connection): keep the session for a retry.
      return { kind: 'unreachable' }
    }
  }

  function clearStoredAuth() {
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
    clearSessionCookies()
  }

  const login = useCallback(
    (user: AuthUser, accessToken: string, refreshToken: string, expiresIn: number) => {
      localStorage.setItem(REFRESH_KEY, refreshToken)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      setSessionMarker()
      void expiresIn
      setState({ user, accessToken, isLoading: false })
    },
    [],
  )

  const logout = useCallback(async () => {
    const refreshTok = localStorage.getItem(REFRESH_KEY)
    const { accessToken } = state

    if (refreshTok && accessToken) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ refreshToken: refreshTok }),
      }).catch(() => undefined)
    }

    clearStoredAuth()
    setState({ user: null, accessToken: null, isLoading: false })
    router.push('/login')
  }, [state, router])

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const result = await refreshOnce()
    if (result.kind === 'ok') {
      setState(s => ({ ...s, accessToken: result.accessToken, user: result.user }))
      return result.accessToken
    }
    if (result.kind === 'ended') {
      clearStoredAuth()
      setState({ user: null, accessToken: null, isLoading: false })
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshAccessToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
