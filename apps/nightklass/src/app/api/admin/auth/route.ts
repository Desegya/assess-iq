import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_REFRESH,
  authenticated,
  backend,
  clearSession,
  sameOrigin,
  setSession,
} from '@/lib/admin/server'

export async function GET(request: NextRequest) {
  try {
    return await authenticated(request, '/admin/nightklass/me')
  } catch {
    return NextResponse.json(
      { message: 'Unable to reach the service. Please try again.' },
      { status: 503 },
    )
  }
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json({ message: 'Invalid request origin' }, { status: 403 })
  try {
    const raw = await request.text()
    if (raw.length > 4096)
      return NextResponse.json({ message: 'Request too large' }, { status: 413 })
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return NextResponse.json({ message: 'Invalid request' }, { status: 400 })
    }
    const result = await backend('/admin/nightklass-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!result.ok)
      return NextResponse.json(
        {
          message:
            result.status === 429
              ? 'Too many attempts. Please try again later.'
              : 'Unable to sign in. Check your credentials and administrator access.',
        },
        { status: result.status },
      )
    const data = await result.json()
    const response = NextResponse.json(
      { user: { name: data.user.name, email: data.user.email }, role: data.adminRole },
      { headers: { 'Cache-Control': 'no-store' } },
    )
    setSession(response, data)
    return response
  } catch {
    return NextResponse.json(
      { message: 'Unable to reach the service. Please try again.' },
      { status: 503 },
    )
  }
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json({ message: 'Invalid request origin' }, { status: 403 })
  const refreshToken = request.cookies.get(ADMIN_REFRESH)?.value
  if (refreshToken) {
    try {
      await authenticated(request, '/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      })
    } catch {
      /* Local cookies are still cleared when the API is unavailable. */
    }
  }
  const response = NextResponse.json(
    { message: 'Signed out' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
  clearSession(response)
  return response
}
