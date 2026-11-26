import { NotFoundException } from '@nestjs/common'
import { AuthUser, UserRole } from '@assessiq/types'

/**
 * Prisma filter restricting institutional records to the caller's organisation.
 *
 * Never write `organizationId: user.organizationId ?? undefined`: Prisma treats
 * `undefined` as "no filter", so an account without an organisation (every
 * Nightklass learner) would match every organisation's records. Here a missing
 * organisation is a hard "not found"; only a super-admin reads across organisations.
 */
export function orgScope(user: AuthUser, notFound = 'Not found'): { organizationId?: string } {
  if (user.role === UserRole.SUPER_ADMIN) return {}
  if (!user.organizationId) throw new NotFoundException(notFound)
  return { organizationId: user.organizationId }
}

/** Submissions this soon after the deadline still count (network latency, the client's own auto-submit). */
export const DEADLINE_GRACE_MS = 30_000

/**
 * When an attempt must be finished: the earlier of its timer (startedAt + duration)
 * and the assessment's closing time. `null` means no limit.
 */
export function attemptDeadline(
  startedAt: Date,
  durationMinutes: number | null | undefined,
  endTime: Date | null | undefined,
): Date | null {
  const candidates: number[] = []
  if (durationMinutes && durationMinutes > 0) candidates.push(startedAt.getTime() + durationMinutes * 60_000)
  if (endTime) candidates.push(new Date(endTime).getTime())
  return candidates.length ? new Date(Math.min(...candidates)) : null
}

export function isPastDeadline(deadline: Date | null, now = new Date()): boolean {
  return !!deadline && now.getTime() > deadline.getTime() + DEADLINE_GRACE_MS
}
