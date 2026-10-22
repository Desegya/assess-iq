import { NextRequest, NextResponse } from 'next/server'
import { authenticated, sameOrigin } from '@/lib/admin/server'

// Keep the privileged proxy limited to the admin contract, never arbitrary API paths.
const ALLOWED =
  /^(exam-content\/(?:calendars(?:\/[a-zA-Z0-9_-]+\/(?:state|upload|file))?|generation-jobs|syllabuses(?:\/[a-zA-Z0-9_-]+\/state)?|waec-papers|mock-templates|materials|upload|questions|generate|materials\/[a-zA-Z0-9_-]+|questions\/[a-zA-Z0-9_-]+(?:\/(?:state|correction|objectives|similar))?|question-reports(?:\/[a-zA-Z0-9_-]+)?)|operations\/(?:settings|ai-usage|summary|exam-cohort(?:\/[a-zA-Z0-9_-]+)?)|me|overview|access|users|users\/[a-zA-Z0-9_-]+(?:\/(?:status|admin-access|courses))?|courses|courses\/[a-zA-Z0-9_-]+(?:\/topics)?|topics\/[a-zA-Z0-9_-]+(?:\/(?:archive|restore))?|lessons|lessons\/[a-zA-Z0-9_-]+(?:\/correct)?|questions|questions\/[a-zA-Z0-9_-]+|materials|reports|reports\/[a-zA-Z0-9_-]+|activity|audit)$/
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const target = path.join('/')
  if (!ALLOWED.test(target)) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (request.method !== 'GET' && !sameOrigin(request))
    return NextResponse.json({ message: 'Invalid request origin' }, { status: 403 })
  try {
    const upload = target === 'exam-content/upload' || /^exam-content\/calendars\/[a-zA-Z0-9_-]+\/upload$/.test(target)
    if (upload && Number(request.headers.get('content-length') ?? 0) > 6 * 1024 * 1024)
      return NextResponse.json({ message: 'Upload exceeds 5 MB' }, { status: 413 })
    const body = request.method === 'GET' ? undefined : upload ? await request.formData() : await request.text()
    if (typeof body === 'string' && body.length > (target === 'exam-content/calendars' ? 1800000 : 200000))
      return NextResponse.json({ message: 'Request too large' }, { status: 413 })
    return await authenticated(request, `/admin/nightklass/${target}${request.nextUrl.search}`, {
      method: request.method,
      body,
      signal: AbortSignal.timeout(target === 'exam-content/generate' ? 120000 : 30000),
    })
  } catch {
    return NextResponse.json(
      { message: 'Unable to reach the service. Please try again.' },
      { status: 503 },
    )
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE }
