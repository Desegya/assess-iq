import { NextRequest, NextResponse } from 'next/server'
import { authenticated, sameOrigin } from '@/lib/admin/server'

// Keep the privileged proxy limited to the admin contract, never arbitrary API paths.
const ALLOWED =
  /^(me|overview|access|users|users\/[a-zA-Z0-9_-]+(?:\/(?:status|admin-access|courses))?|courses|courses\/[a-zA-Z0-9_-]+(?:\/topics)?|topics\/[a-zA-Z0-9_-]+(?:\/(?:archive|restore))?|lessons|lessons\/[a-zA-Z0-9_-]+(?:\/correct)?|questions|questions\/[a-zA-Z0-9_-]+|materials|reports|reports\/[a-zA-Z0-9_-]+|activity|audit)$/
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const target = path.join('/')
  if (!ALLOWED.test(target)) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (request.method !== 'GET' && !sameOrigin(request))
    return NextResponse.json({ message: 'Invalid request origin' }, { status: 403 })
  try {
    const body = request.method === 'GET' ? undefined : await request.text()
    if (body && body.length > 200000)
      return NextResponse.json({ message: 'Request too large' }, { status: 413 })
    return await authenticated(request, `/admin/nightklass/${target}${request.nextUrl.search}`, {
      method: request.method,
      body,
    })
  } catch {
    return NextResponse.json(
      { message: 'Unable to reach the service. Please try again.' },
      { status: 503 },
    )
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH }
