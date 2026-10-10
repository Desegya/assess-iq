import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/dashboard', '/courses', '/today', '/topics', '/weak-topics', '/flashcards']
const AUTH_ONLY_ROUTES = ['/login', '/register']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const accessToken = request.cookies.get('accessToken')?.value
  const refreshToken = request.cookies.get('refreshToken')?.value

  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
  const isAuthRoute = AUTH_ONLY_ROUTES.some(r => pathname.startsWith(r))

  // Unauthenticated user trying to reach a protected route → login
  // BUT: if a refreshToken cookie exists, let the request through so the client
  // auth context can silently refresh the access token (avoids logout on tab reopen).
  if (isProtected && !accessToken) {
    if (!refreshToken) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Authenticated user hitting login/register → send to dashboard
  if (isAuthRoute && accessToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const response = NextResponse.next()
  if (pathname !== '/' && !['/robots.txt', '/sitemap.xml', '/opengraph-image'].includes(pathname)) {
    response.headers.set('X-Robots-Tag', 'noindex, follow')
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
