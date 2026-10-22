import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import * as bcrypt from 'bcryptjs'

const derive = promisify(pbkdf2)

// OWASP-recommended PBKDF2-HMAC-SHA256 work factor. Node runs pbkdf2 on the libuv
// thread pool, so hashing no longer blocks the event loop the way pure-JS bcrypt
// did (measured: 100 sign-ins in 20 s pushed login p95 to 12.8 s and stalled mock saves).
const ITERATIONS = 600_000
const KEY_BYTES = 32
const PREFIX = 'pbkdf2-sha256'

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await derive(password, salt, ITERATIONS, KEY_BYTES, 'sha256')
  return `${PREFIX}$${ITERATIONS}$${salt.toString('base64')}$${key.toString('base64')}`
}

/** Verifies PBKDF2 hashes and legacy bcrypt hashes ($2a$/$2b$) created before this scheme. */
export async function verifyPassword(password: string, stored: string) {
  if (stored.startsWith(`${PREFIX}$`)) {
    const [, iterations, salt, key] = stored.split('$')
    const expected = Buffer.from(key ?? '', 'base64')
    const n = Number(iterations)
    if (!Number.isInteger(n) || n < 1 || !salt || !expected.length) return false
    const actual = await derive(password, Buffer.from(salt, 'base64'), n, expected.length, 'sha256')
    return timingSafeEqual(actual, expected)
  }
  if (/^\$2[aby]\$/.test(stored)) return bcrypt.compare(password, stored)
  return false
}

/** True for legacy bcrypt hashes or weaker PBKDF2 settings; re-hash after a successful sign-in. */
export function needsRehash(stored: string) {
  if (!stored.startsWith(`${PREFIX}$`)) return true
  return Number(stored.split('$')[1]) < ITERATIONS
}
