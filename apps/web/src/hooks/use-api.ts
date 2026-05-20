'use client'

import { useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

/**
 * Returns authenticated `get`, `post`, `patch`, `del` helpers that
 * automatically inject the Bearer token and retry once after a token refresh.
 */
export function useApi() {
  const { accessToken, refreshAccessToken } = useAuth()

  const request = useCallback(
    async <T>(path: string, options: ApiOptions = {}): Promise<T> => {
      const { body, headers: extraHeaders, ...rest } = options

      async function doFetch(token: string | null): Promise<Response> {
        const headers: Record<string, string> = {
          ...(extraHeaders as Record<string, string>),
          ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }

        return fetch(`${API_URL}${path}`, {
          ...rest,
          headers,
          body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
        })
      }

      let res = await doFetch(accessToken)

      // 401 → try one token refresh then retry
      if (res.status === 401) {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          // Re-read the token from context isn't possible here (stale closure),
          // so we parse the cookie instead
          const newToken = document.cookie
            .split(';')
            .find(c => c.trim().startsWith('accessToken='))
            ?.split('=')[1]
          res = await doFetch(newToken ?? null)
        }
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
        throw new Error((error as { message?: string }).message ?? `HTTP ${res.status}`)
      }

      // 204 No Content
      if (res.status === 204) return undefined as T

      return res.json() as Promise<T>
    },
    [accessToken, refreshAccessToken],
  )

  return {
    get: <T>(path: string, opts?: Omit<ApiOptions, 'body'>) =>
      request<T>(path, { method: 'GET', ...opts }),

    post: <T>(path: string, body: unknown, opts?: ApiOptions) =>
      request<T>(path, { method: 'POST', body, ...opts }),

    patch: <T>(path: string, body: unknown, opts?: ApiOptions) =>
      request<T>(path, { method: 'PATCH', body, ...opts }),

    del: <T>(path: string, opts?: ApiOptions) =>
      request<T>(path, { method: 'DELETE', ...opts }),

    /** For multipart/form-data uploads */
    upload: <T>(path: string, formData: FormData, opts?: ApiOptions) =>
      request<T>(path, { method: 'POST', body: formData, ...opts }),
  }
}
