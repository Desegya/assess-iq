export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

/** An API failure that keeps the server's status and machine-readable `code` (e.g. DOMAIN_MISMATCH). */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function toApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as { message?: string | string[]; code?: string }
  const message = Array.isArray(body.message) ? body.message.join(' ') : body.message
  return new ApiError(message ?? `Request failed (${res.status})`, res.status, body.code)
}

/** Unauthenticated JSON call (sign-up, password reset, class link preview). */
export async function publicApi<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw await toApiError(res)
  return res.json() as Promise<T>
}
