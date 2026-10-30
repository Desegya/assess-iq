import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/dashboard', '/courses', '/today', '/topics', '/weak-topics', '/flashcards', '/exam-preparation', '/onboarding', '/gpa', '/account', '/guide']
const AUTH_ONLY_ROUTES = ['/login', '/register']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  // A non-secret marker set by the auth context; tokens themselves never travel in cookies.
  // Legacy token cookies still count until the client rewrites them on next load.
  const hasSession =
    request.cookies.has('nk_session') ||
    request.cookies.has('refreshToken') ||
    request.cookies.has('accessToken')

  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
  const isAuthRoute = AUTH_ONLY_ROUTES.some(r => pathname.startsWith(r))

  // Without any session the client could not refresh either, so go straight to login.
  if (isProtected && !hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Likely signed in: send login/register to the dashboard (the client re-checks the session).
  if (isAuthRoute && hasSession) {
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
