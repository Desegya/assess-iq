import { applyDecorators, ExecutionContext, Injectable } from '@nestjs/common'
import { Throttle, ThrottlerGuard, ThrottlerLimitDetail, ThrottlerOptions } from '@nestjs/throttler'

// Authenticated traffic is tracked per account, so learners sharing a school,
// carrier-NAT or proxy address never consume each other's budget. Anonymous
// traffic falls back to the client address (see TRUST_PROXY in configure-app).
export function trackRequest(req: Record<string, any>) {
  return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`
}

const MINUTE = 60_000

// Default budget for every route. Generous enough for an active mock
// (autosave is debounced client-side) while still capping runaway clients.
export const THROTTLERS: ThrottlerOptions[] = [
  { name: 'short', ttl: 1000, limit: 20 },
  { name: 'medium', ttl: MINUTE, limit: 300 },
]

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>) {
    return trackRequest(req)
  }
  protected override async getErrorMessage(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ) {
    const seconds = Math.max(1, Math.ceil(detail.timeToBlockExpire || detail.timeToExpire))
    return `Too many requests. Please wait ${seconds} second${seconds === 1 ? '' : 's'} and try again.`
  }
}

/**
 * Anonymous credential endpoints (login, registration, refresh) are keyed by
 * client address. Limits are sized for a classroom signing in together from one
 * network; per-account failed-login limits live in LoginAttemptLimiter.
 */
export const AnonymousCredentialThrottle = (perFifteenMinutes: number) =>
  Throttle({
    short: { limit: 10, ttl: 1000 },
    medium: { limit: perFifteenMinutes, ttl: 15 * MINUTE },
  })

/** Per-account cap for routes that call the AI provider; quotas are enforced separately. */
export const AiThrottle = () =>
  applyDecorators(Throttle({ short: { limit: 2, ttl: 1000 }, medium: { limit: 20, ttl: MINUTE } }))
