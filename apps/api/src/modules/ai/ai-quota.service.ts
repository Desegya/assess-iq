import { HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { AIAction } from '@assessiq/db'
import { PrismaService } from '../prisma/prisma.service'
import { RuntimeSettingsService } from '../operations/runtime-settings.service'

export class AiQuotaExceededException extends HttpException {
  constructor(message: string) {
    super({ statusCode: HttpStatus.TOO_MANY_REQUESTS, error: 'AI quota exceeded', message }, HttpStatus.TOO_MANY_REQUESTS)
  }
}

export class AiPausedException extends ServiceUnavailableException {
  constructor() {
    super('AI features are temporarily paused. Your saved work is safe; please try again later.')
  }
}

const WINDOW_MS = 24 * 60 * 60_000
// Arbitrary constants namespacing the advisory locks used by quota reservation.
const GLOBAL_LOCK = 4_172_001
const USER_LOCK_NAMESPACE = 4_172_002

interface UsageTotals {
  cost: number
  requests: number
}

/**
 * Durable AI budget enforcement. Each call reserves its estimated maximum cost
 * as a pending AIUsageLog row before reaching the provider; measured usage then
 * replaces the estimate. Reservation runs under transaction-scoped advisory
 * locks, so concurrent requests (from any API instance) cannot all pass a
 * nearly-exhausted quota, and restarts lose nothing because state is the log.
 */
@Injectable()
export class AiQuotaService {
  private readonly logger = new Logger(AiQuotaService.name)
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: RuntimeSettingsService,
  ) {}

  async isPaused() {
    return this.settings.get<boolean>('ai.paused')
  }

  /** Pending rows count at their reservation; finished rows at measured cost. */
  private async totals(tx: PrismaService | any, userId?: string): Promise<UsageTotals> {
    const since = new Date(Date.now() - WINDOW_MS)
    const rows: { cost: number | null; requests: bigint }[] = userId
      ? await tx.$queryRaw`SELECT COALESCE(SUM(GREATEST("costUsd", CASE WHEN "pending" THEN "reservedCostUsd" ELSE 0 END)), 0)::float8 AS cost,
          COUNT(*) AS requests FROM "ai_usage_logs" WHERE "userId" = ${userId} AND "createdAt" > ${since}`
      : await tx.$queryRaw`SELECT COALESCE(SUM(GREATEST("costUsd", CASE WHEN "pending" THEN "reservedCostUsd" ELSE 0 END)), 0)::float8 AS cost,
          COUNT(*) AS requests FROM "ai_usage_logs" WHERE "createdAt" > ${since}`
    return { cost: Number(rows[0]?.cost ?? 0), requests: Number(rows[0]?.requests ?? 0) }
  }

  /**
   * Reserves budget and returns the pending usage-log id. `userBudget: false`
   * is for work a learner has already been granted (marking a submitted paper):
   * it still honours the kill switch and the global budget.
   */
  async reserve(input: {
    userId: string
    organizationId?: string
    action: AIAction
    estimateUsd: number
    relatedEntityId?: string
    userBudget?: boolean
  }): Promise<string> {
    if (await this.isPaused()) throw new AiPausedException()
    const [globalBudget, userBudgetUsd, adminBudgetUsd, userRequests] = await Promise.all([
      this.settings.get<number>('ai.globalDailyBudgetUsd'),
      this.settings.get<number>('ai.userDailyBudgetUsd'),
      this.settings.get<number>('ai.adminDailyBudgetUsd'),
      this.settings.get<number>('ai.userDailyRequests'),
    ])
    const estimate = Math.max(0, input.estimateUsd)
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${USER_LOCK_NAMESPACE}::int, hashtext(${input.userId}))`
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GLOBAL_LOCK}::bigint)`
        const global = await this.totals(tx)
        if (global.cost + estimate > globalBudget) {
          this.logger.error(`event=ai_global_budget_reached spentUsd=${global.cost.toFixed(4)} budgetUsd=${globalBudget}`)
          throw new AiPausedException()
        }
        if (input.userBudget !== false) {
          const isAdmin = !!(await tx.nightklassAdmin.findUnique({ where: { userId: input.userId } }))
          const budget = isAdmin ? adminBudgetUsd : userBudgetUsd
          const user = await this.totals(tx, input.userId)
          if (user.requests >= (isAdmin ? userRequests * 10 : userRequests) || user.cost + estimate > budget) {
            this.logger.warn(`event=ai_user_quota_reached userId=${input.userId} action=${input.action}`)
            throw new AiQuotaExceededException(
              'You have reached today’s AI study allowance. It refreshes over the next 24 hours; your saved materials, practice and mocks remain available.',
            )
          }
        }
        const row = await tx.aIUsageLog.create({
          data: {
            userId: input.userId,
            organizationId: input.organizationId,
            action: input.action,
            model: 'pending',
            inputTokens: 0,
            outputTokens: 0,
            costUsd: 0,
            durationMs: 0,
            pending: true,
            reservedCostUsd: estimate,
            relatedEntityId: input.relatedEntityId,
          },
        })
        return row.id
      },
      { timeout: 10_000 },
    )
  }

  /** Replaces the reservation with measured usage. Never throws: accounting must not fail a completed call. */
  async settle(
    id: string,
    usage: { model: string; inputTokens: number; outputTokens: number; costUsd: number; durationMs: number; errorMessage?: string },
  ) {
    await this.prisma.aIUsageLog
      .update({
        where: { id },
        data: {
          pending: false,
          model: usage.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          costUsd: usage.costUsd,
          durationMs: usage.durationMs,
          success: !usage.errorMessage,
          errorMessage: usage.errorMessage?.slice(0, 500),
        },
      })
      // An unsettled row stays pending and keeps counting at its reserved
      // estimate, so a failure here can only over-count, never under-count.
      .catch((e) => this.logger.error(`event=ai_usage_settle_failed id=${id} reason=${e instanceof Error ? e.message : 'unknown'}`))
  }

  async usageSummary() {
    const since = new Date(Date.now() - WINDOW_MS)
    const [global, byAction, failures, topUsers] = await Promise.all([
      this.totals(this.prisma),
      this.prisma.aIUsageLog.groupBy({
        by: ['action'],
        where: { createdAt: { gt: since } },
        _sum: { costUsd: true, inputTokens: true, outputTokens: true },
        _count: true,
      }),
      this.prisma.aIUsageLog.count({ where: { createdAt: { gt: since }, success: false, pending: false } }),
      this.prisma.aIUsageLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gt: since } },
        _sum: { costUsd: true },
        _count: true,
        orderBy: { _sum: { costUsd: 'desc' } },
        take: 10,
      }),
    ])
    return {
      windowHours: 24,
      measuredAndReservedUsd: global.cost,
      requests: global.requests,
      failures,
      byAction: byAction.map((a) => ({ action: a.action, requests: a._count, costUsd: a._sum.costUsd ?? 0, inputTokens: a._sum.inputTokens ?? 0, outputTokens: a._sum.outputTokens ?? 0 })),
      topUsers: topUsers.map((u) => ({ userId: u.userId, requests: u._count, costUsd: u._sum.costUsd ?? 0 })),
      note: 'Costs are computed from provider-reported token usage and the configured price table; pending calls count at their reserved estimate.',
    }
  }
}
