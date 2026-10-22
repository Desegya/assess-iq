'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

/** HTTP failure with its status, so callers can retry 429/5xx and treat 409 as a conflict. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
  /** Worth retrying later: throttled, server/proxy failure, or no response at all (status 0). */
  get transient() {
    return this.status === 0 || this.status === 429 || this.status >= 500
  }
}

/**
 * Returns authenticated `get`, `post`, `patch`, `del` helpers that
 * automatically inject the Bearer token and retry once after a token refresh.
 */
export function useApi() {
  const { accessToken, refreshAccessToken } = useAuth()
  // Long-lived callers (mock autosave) keep one request function; the ref gives them the newest token.
  const tokenRef = useRef(accessToken)
  useEffect(() => {
    tokenRef.current = accessToken
  }, [accessToken])

  const request = useCallback(
    async <T>(path: string, options: ApiOptions = {}): Promise<T> => {
      const { body, headers: extraHeaders, ...rest } = options

      async function doFetch(token: string | null): Promise<Response> {
        const headers: Record<string, string> = {
          ...(extraHeaders as Record<string, string>),
          ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }

        try {
          return await fetch(`${API_URL}${path}`, {
            ...rest,
            headers,
            body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
          })
        } catch {
          throw new ApiError('No connection. Check your internet and try again.', 0)
        }
      }

      let res = await doFetch(tokenRef.current ?? accessToken)

      if (res.status === 401) {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          tokenRef.current = refreshed
          res = await doFetch(refreshed)
        }
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
        const retryAfter = Number(res.headers.get('retry-after') ?? res.headers.get('retry-after-short') ?? res.headers.get('retry-after-medium'))
        const message = (error as { message?: string | string[] }).message
        throw new ApiError(
          Array.isArray(message) ? message.join('. ') : (message ?? `HTTP ${res.status}`),
          res.status,
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
        )
      }

      if (res.status === 204) return undefined as T
      return res.json() as Promise<T>
    },
    [accessToken, refreshAccessToken],
  )

  return useMemo(
    () => ({
      get: <T>(path: string, opts?: Omit<ApiOptions, 'body'>) => request<T>(path, { method: 'GET', ...opts }),
      post: <T>(path: string, body: unknown, opts?: ApiOptions) =>
        request<T>(path, { method: 'POST', body, ...opts }),
      put: <T>(path: string, body: unknown, opts?: ApiOptions) =>
        request<T>(path, { method: 'PUT', body, ...opts }),
      patch: <T>(path: string, body: unknown, opts?: ApiOptions) =>
        request<T>(path, { method: 'PATCH', body, ...opts }),
      del: <T>(path: string, opts?: ApiOptions) => request<T>(path, { method: 'DELETE', ...opts }),
      upload: <T>(path: string, formData: FormData, opts?: ApiOptions) =>
        request<T>(path, { method: 'POST', body: formData, ...opts }),
    }),
    [request],
  )
}
