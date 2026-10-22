import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@assessiq/db'
import { PrismaService } from '../prisma/prisma.service'
import { environmentDefault, parseSetting, SettingKey, SETTINGS, SettingValue } from './runtime-settings'

const CACHE_MS = 5_000

@Injectable()
export class RuntimeSettingsService {
  private readonly logger = new Logger(RuntimeSettingsService.name)
  private cache: { at: number; values: Map<string, unknown> } | null = null
  constructor(private readonly prisma: PrismaService) {
    // Validate environment defaults at startup rather than on first use.
    for (const key of Object.keys(SETTINGS) as SettingKey[]) environmentDefault(key, process.env)
  }

  private async overrides() {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.values
    try {
      const rows = await this.prisma.runtimeSetting.findMany()
      this.cache = { at: Date.now(), values: new Map(rows.map((r) => [r.key, r.value])) }
    } catch (err) {
      // Keep the last known values; with none, environment defaults apply.
      this.logger.error(`event=runtime_settings_unavailable reason=${err instanceof Error ? err.message : 'unknown'}`)
      if (!this.cache) return new Map<string, unknown>()
    }
    return this.cache!.values
  }

  async get<T extends SettingValue>(key: SettingKey): Promise<T> {
    const overrides = await this.overrides()
    if (overrides.has(key)) {
      try {
        return parseSetting(key, overrides.get(key)) as T
      } catch {
        this.logger.error(`event=runtime_setting_invalid key=${key}`)
      }
    }
    return environmentDefault(key, process.env) as T
  }

  async list() {
    const overrides = await this.overrides()
    return Promise.all(
      (Object.keys(SETTINGS) as SettingKey[]).map(async (key) => ({
        key,
        value: await this.get(key),
        overridden: overrides.has(key),
        default: environmentDefault(key, process.env),
      })),
    )
  }

  /** null clears the override so the environment default applies again. */
  async set(key: SettingKey, value: unknown, actorId: string) {
    const parsed = value === null ? null : parseSetting(key, value)
    await this.prisma.$transaction(async (tx) => {
      if (parsed === null) await tx.runtimeSetting.deleteMany({ where: { key } })
      else
        await tx.runtimeSetting.upsert({
          where: { key },
          create: { key, value: parsed as Prisma.InputJsonValue, updatedById: actorId },
          update: { value: parsed as Prisma.InputJsonValue, updatedById: actorId },
        })
      await tx.nightklassAdminAudit.create({
        data: { actorId, action: 'runtime-setting.' + key, resourceType: 'runtime-setting', resourceId: key },
      })
    })
    this.cache = null
    this.logger.warn(`event=runtime_setting_changed key=${key} value=${JSON.stringify(parsed)} actor=${actorId}`)
    return this.list()
  }
}
