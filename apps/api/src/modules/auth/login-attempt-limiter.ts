import { HttpException, HttpStatus, Injectable } from '@nestjs/common'

const WINDOW_MS = 15 * 60_000
const MAX_FAILURES = 10
const MAX_TRACKED = 50_000

/**
 * Counts failed sign-ins per email address so password guessing against one
 * account is capped regardless of how many addresses an attacker uses, while
 * successful sign-ins from a shared classroom network are never counted.
 *
 * State is per API process. With N instances an attacker gets at most
 * N × MAX_FAILURES guesses per window, which is acceptable for the current
 * single-instance deployment; move to shared storage before scaling out.
 */
@Injectable()
export class LoginAttemptLimiter {
  private readonly failures = new Map<string, { count: number; resetAt: number }>()

  private key(email: string) {
    return email.trim().toLowerCase()
  }

  assertAllowed(email: string, now = Date.now()) {
    const entry = this.failures.get(this.key(email))
    if (entry && entry.resetAt > now && entry.count >= MAX_FAILURES) {
      const minutes = Math.ceil((entry.resetAt - now) / 60_000)
      throw new HttpException(
        `Too many failed sign-in attempts for this account. Try again in ${minutes} minute${minutes === 1 ? '' : 's'} or reset your password.`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
  }

  recordFailure(email: string, now = Date.now()) {
    const key = this.key(email)
    const entry = this.failures.get(key)
    if (!entry || entry.resetAt <= now) {
      if (this.failures.size >= MAX_TRACKED) this.prune(now)
      this.failures.set(key, { count: 1, resetAt: now + WINDOW_MS })
    } else entry.count++
  }

  reset(email: string) {
    this.failures.delete(this.key(email))
  }

  private prune(now: number) {
    for (const [key, entry] of this.failures) if (entry.resetAt <= now) this.failures.delete(key)
    // Under a flood of distinct addresses, drop the oldest entries rather than grow unbounded.
    while (this.failures.size >= MAX_TRACKED) this.failures.delete(this.failures.keys().next().value!)
  }
}
