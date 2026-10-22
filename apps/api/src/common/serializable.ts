import { Prisma } from '@assessiq/db'

type Client = { $transaction: (...args: any[]) => Promise<any> }

/**
 * Runs a Serializable transaction, retrying PostgreSQL serialization failures
 * (Prisma P2034) with jittered backoff. Under SSI these failures also occur
 * between unrelated rows (index-page predicate locks), so without retries
 * concurrent learners—e.g. a class onboarding together—see spurious conflicts.
 * Business-level conflicts (version checks) are unaffected: they throw their own errors.
 */
export async function serializable<T>(
  client: Client,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number } = {},
  attempts = 5,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await client.$transaction(fn, { ...options, isolationLevel: 'Serializable' })
    } catch (err) {
      if ((err as { code?: string })?.code !== 'P2034' || attempt >= attempts) throw err
      await new Promise((r) => setTimeout(r, Math.random() * 25 * 2 ** attempt))
    }
  }
}

/**
 * Read Committed transaction retried on unique-key races (P2002) and
 * serialization failures (P2034). For per-user writes that never touch other
 * users' rows, this avoids Serializable's cross-user false conflicts while a
 * user's own concurrent requests still resolve to a consistent result.
 */
export async function retryingTransaction<T>(
  client: Client,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  attempts = 4,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await client.$transaction(fn)
    } catch (err) {
      const code = (err as { code?: string })?.code
      if ((code !== 'P2002' && code !== 'P2034') || attempt >= attempts) throw err
      await new Promise((r) => setTimeout(r, Math.random() * 25 * 2 ** attempt))
    }
  }
}
