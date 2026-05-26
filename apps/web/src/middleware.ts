import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Route prefixes and their access requirements
const PROTECTED_PREFIXES = ['/teacher', '/student', '/admin']
const AUTH_ONLY_ROUTES = ['/login', '/register']

// Role → home page mapping (must match LoginForm.tsx ROLE_REDIRECTS)
const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: '/admin/dashboard',
  ORG_ADMIN: '/teacher/dashboard',
  TEACHER: '/teacher/dashboard',
  STUDENT: '/student/dashboard',
}

/**
 * Decode the role claim from a JWT without verifying the signature.
 * This is intentionally unverified — it's only used for a UX redirect.
 * The actual security check still happens in NestJS via the JwtAuthGuard.
 */
function getRoleFromToken(token: string): string | null {
  try {
    const payloadB64 = token.split('.')[1]
    if (!payloadB64) return null
    // atob is available in the Edge Runtime
    const decoded = JSON.parse(atob(payloadB64)) as { role?: string }
    return decoded.role ?? null
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const accessToken = request.cookies.get('accessToken')?.value

  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
  const isAuthRoute = AUTH_ONLY_ROUTES.some(r => pathname.startsWith(r))

  // Unauthenticated user trying to reach a protected route → login
  if (isProtected && !accessToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated user hitting login/register → redirect to their own portal
  if (isAuthRoute && accessToken) {
    const role = getRoleFromToken(accessToken) ?? ''
    const home = ROLE_HOME[role] ?? '/teacher/dashboard'
    return NextResponse.redirect(new URL(home, request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Run on all routes except Next.js internals, static files, and images
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
