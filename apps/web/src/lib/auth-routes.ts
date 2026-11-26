/** Where each role lands after signing in. Keep in sync with middleware.ts. */
export const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: '/admin/dashboard',
  ORG_ADMIN: '/teacher/dashboard',
  TEACHER: '/teacher/dashboard',
  STUDENT: '/student/dashboard',
}

export const homeFor = (role: string | undefined) => (role && ROLE_HOME[role]) || '/student/dashboard'

/** Only follow same-site paths after sign-in, never `//evil.com` or full URLs. */
export function safeRedirect(target: string | null | undefined): string | null {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return null
  return target
}
