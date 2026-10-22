import { BadRequestException } from '@nestjs/common'

/**
 * Operator-adjustable switches. Each has an environment default; an OWNER can
 * override it at runtime (stored in runtime_settings) without a redeploy.
 */
export const SETTINGS = {
  'ai.paused': { env: 'AI_PAUSED', type: 'boolean', default: false },
  'ai.userDailyBudgetUsd': { env: 'AI_USER_DAILY_BUDGET_USD', type: 'number', default: 0.5, min: 0, max: 100 },
  'ai.adminDailyBudgetUsd': { env: 'AI_ADMIN_DAILY_BUDGET_USD', type: 'number', default: 5, min: 0, max: 500 },
  'ai.userDailyRequests': { env: 'AI_USER_DAILY_REQUESTS', type: 'number', default: 200, min: 0, max: 10000 },
  'ai.globalDailyBudgetUsd': { env: 'AI_GLOBAL_DAILY_BUDGET_USD', type: 'number', default: 25, min: 0, max: 10000 },
  // OPEN: every standalone learner; COHORT: only learners on the pilot allowlist.
  'exam.access': { env: 'EXAM_ACCESS', type: 'enum', values: ['OPEN', 'COHORT'], default: 'COHORT' },
  // Emergency brake: blocks new mock/paper starts; in-progress attempts can still be saved and submitted.
  'exam.newAttemptsPaused': { env: 'EXAM_NEW_ATTEMPTS_PAUSED', type: 'boolean', default: false },
} as const

export type SettingKey = keyof typeof SETTINGS
export type SettingValue = boolean | number | string

export function parseSetting(key: SettingKey, raw: unknown): SettingValue {
  const spec = SETTINGS[key] as {
    type: string
    min?: number
    max?: number
    values?: readonly string[]
  }
  if (spec.type === 'boolean') {
    if (typeof raw === 'boolean') return raw
    if (raw === 'true' || raw === '1') return true
    if (raw === 'false' || raw === '0') return false
  } else if (spec.type === 'number') {
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN
    if (Number.isFinite(n) && n >= spec.min! && n <= spec.max!) return n
  } else if (typeof raw === 'string' && spec.values!.includes(raw)) return raw
  throw new BadRequestException(`Invalid value for ${key}`)
}

export function environmentDefault(key: SettingKey, env: Record<string, string | undefined>) {
  const spec = SETTINGS[key]
  const raw = env[spec.env]
  if (raw === undefined || raw === '') return spec.default as SettingValue
  try {
    return parseSetting(key, raw)
  } catch {
    throw new Error(`${spec.env} has an invalid value`)
  }
}
