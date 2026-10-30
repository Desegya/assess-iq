'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { Course } from '@/components/courses/CourseGrid'
import { useApi } from './use-api'

/** Read the complete server list again on return navigation, focus and tab restore. */
export function useCourses() {
  const api = useApi()
  const pathname = usePathname()
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)
  const reload = useCallback(async () => {
    const request = ++sequence.current
    try {
      const list = await api.get<Course[]>('/courses', { cache: 'no-store' })
      if (request === sequence.current) {
        setCourses(list)
        setError(null)
      }
    } catch (err) {
      if (request === sequence.current)
        setError(err instanceof Error ? err.message : 'Failed to load courses')
    }
  }, [api])
  useEffect(() => {
    void reload()
    const visible = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    window.addEventListener('focus', visible)
    window.addEventListener('pageshow', visible)
    document.addEventListener('visibilitychange', visible)
    return () => {
      ++sequence.current
      window.removeEventListener('focus', visible)
      window.removeEventListener('pageshow', visible)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [reload, pathname])
  const remove = useCallback((id: string) => {
    ++sequence.current // Ignore any list response that began before deletion completed.
    setCourses((previous) => previous?.filter((course) => course.id !== id) ?? null)
  }, [])
  return { courses, error, reload, remove }
}
