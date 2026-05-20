import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Route prefixes and their access requirements
const PROTECTED_PREFIXES = ['/teacher', '/student', '/admin']
const AUTH_ONLY_ROUTES = ['/login', '/register']

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

  // Authenticated user hitting login/register → send to teacher dashboard
  // (actual role-based redirect happens client-side in the auth context)
  if (isAuthRoute && accessToken) {
    return NextResponse.redirect(new URL('/teacher/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Run on all routes except Next.js internals, static files, and images
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
