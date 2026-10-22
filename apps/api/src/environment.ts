import { Logger } from '@nestjs/common'
import { trustProxySetting } from './configure-app'

type Env = Record<string, string | undefined>

/**
 * Production fails closed on configuration that would expose private data or
 * weaken authentication. Optional integrations only warn so a missing key
 * disables that feature instead of taking the API down.
 */
export function productionEnvironmentProblems(env: Env) {
  const problems: string[] = []
  const secret = (name: string) => {
    const value = env[name] ?? ''
    if (value.length < 32) problems.push(`${name} must be at least 32 characters`)
    return value
  }
  if (!env.DATABASE_URL) problems.push('DATABASE_URL is required')
  if (secret('JWT_SECRET') && secret('JWT_REFRESH_SECRET') && env.JWT_SECRET === env.JWT_REFRESH_SECRET)
    problems.push('JWT_SECRET and JWT_REFRESH_SECRET must differ')
  // Disk storage is allowed only by explicit opt-in (a persistent volume mounted at
  // STORAGE_LOCAL_DIR); files are then served solely through signed, expiring links.
  if (env.STORAGE_DRIVER === 'local') {
    if (!env.STORAGE_LOCAL_DIR) problems.push('STORAGE_LOCAL_DIR must point at a persistent volume when STORAGE_DRIVER=local')
  } else
    for (const name of ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT', 'R2_BUCKET_NAME'])
      if (!env[name]) problems.push(`${name} is required (or set STORAGE_DRIVER=local with a persistent volume)`)
  if (env.R2_PUBLIC_URL)
    problems.push('R2_PUBLIC_URL must be unset: private uploads are served only through short-lived signed URLs')
  const origins = (env.APP_URL ?? '').split(',').map((o) => o.trim()).filter(Boolean)
  if (!origins.length) problems.push('APP_URL must list the allowed frontend origins')
  if (origins.some((o) => !o.startsWith('https://')))
    problems.push('APP_URL origins must use https in production')
  try {
    trustProxySetting(env.TRUST_PROXY)
  } catch (err) {
    problems.push((err as Error).message)
  }
  return problems
}

export function productionEnvironmentWarnings(env: Env) {
  const warnings: string[] = []
  if (!env.TRUST_PROXY) warnings.push('TRUST_PROXY is unset; anonymous rate limits will key on the proxy address')
  if (!env.OPENAI_API_KEY) warnings.push('OPENAI_API_KEY is unset; AI features will be unavailable')
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !env.PASSWORD_RESET_URL)
    warnings.push('RESEND_API_KEY, EMAIL_FROM and PASSWORD_RESET_URL are required for password-reset email')
  return warnings
}

export function assertProductionEnvironment(env: Env) {
  if (env.NODE_ENV !== 'production') return
  const problems = productionEnvironmentProblems(env)
  if (problems.length)
    throw new Error(`Refusing to start with unsafe production configuration:\n- ${problems.join('\n- ')}`)
  const logger = new Logger('Environment')
  for (const warning of productionEnvironmentWarnings(env)) logger.warn(warning)
}
