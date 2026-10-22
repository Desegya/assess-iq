'use client'
import { useCallback, useEffect, useState } from 'react'

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}
export async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, {
    ...options,
    cache: 'no-store',
    headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
  })
  const body = await response.json().catch(() => ({ message: 'Unable to read the response' }))
  if (!response.ok) {
    const message = Array.isArray(body.message)
      ? body.message.join('. ')
      : (body.message ?? 'Unable to complete this request')
    if (response.status === 401 && path !== 'auth') window.location.assign('/admin/login')
    throw new AdminApiError(message, response.status)
  }
  return body as T
}
export function useAdminData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  useEffect(() => {
    let current = true
    setLoading(true)
    setError('')
    setData(null)
    if (!path) {
      setLoading(false)
      return
    }
    adminRequest<T>(path)
      .then((value) => {
        if (current) setData(value)
      })
      .catch((err) => {
        if (current) setError(err instanceof Error ? err.message : 'Unable to load this page')
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [path, version])
  return { data, error, loading, reload }
}
export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
}
export interface AdminIdentity {
  role: 'OWNER' | 'ADMIN'
  user: { id: string; name: string; email: string }
}
export function date(value?: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—'
}
