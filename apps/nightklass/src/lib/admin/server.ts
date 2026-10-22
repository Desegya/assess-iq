import 'server-only'
import { NextRequest, NextResponse } from 'next/server'

export const ADMIN_ACCESS = 'nightklass_admin_access'
export const ADMIN_REFRESH = 'nightklass_admin_refresh'
const API_URL =
  process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  if (origin === request.nextUrl.origin) return true
  // Next can normalize a loopback/custom hostname. Compare the actual request
  // authority as well, without trusting caller-supplied forwarded-host headers.
  try {
    const supplied = new URL(origin)
    return (
      supplied.origin === origin &&
      supplied.host === request.headers.get('host') &&
      supplied.protocol === new URL(request.url).protocol
    )
  } catch {
    return false
  }
}
export function clearSession(response: NextResponse) {
  for (const name of [ADMIN_ACCESS, ADMIN_REFRESH])
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    })
}
export function setSession(
  response: NextResponse,
  data: { accessToken: string; refreshToken: string; expiresIn: number },
) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  }
  response.cookies.set(ADMIN_ACCESS, data.accessToken, { ...options, maxAge: data.expiresIn })
  response.cookies.set(ADMIN_REFRESH, data.refreshToken, { ...options, maxAge: 7 * 86400 })
}
export function backend(path: string, options: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    cache: 'no-store',
    signal: options.signal ?? AbortSignal.timeout(15000),
  })
}
export async function authenticated(request: NextRequest, path: string, options: RequestInit = {}) {
  let token = request.cookies.get(ADMIN_ACCESS)?.value
  const send = () =>
    backend(path, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  let upstream = token ? await send() : null
  let rotated: { accessToken: string; refreshToken: string; expiresIn: number } | undefined
  if (!upstream || upstream.status === 401) {
    const refresh = request.cookies.get(ADMIN_REFRESH)?.value
    if (refresh) {
      const result = await backend('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      })
      if (result.ok) {
        rotated = await result.json()
        token = rotated!.accessToken
        upstream = await send()
      }
    }
  }
  const status = upstream?.status ?? 401
  const body =
    status >= 500
      ? { message: 'The service is temporarily unavailable. Please try again.' }
      : ((await upstream?.json().catch(() => ({ message: 'Unable to complete this request' }))) ?? {
          message: 'Please sign in again',
        })
  const response = NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  })
  if ([401, 403].includes(status)) clearSession(response)
  else if (rotated) setSession(response, rotated)
  return response
}
