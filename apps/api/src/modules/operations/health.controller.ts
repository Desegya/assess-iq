import { Controller, Get, HttpCode, ServiceUnavailableException, Version, VERSION_NEUTRAL } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { Public } from '../auth/decorators/public.decorator'
import { PrismaService } from '../prisma/prisma.service'

/**
 * /health is liveness (the process answers). /health/ready also proves the
 * database is reachable within 2 s. Responses carry no diagnostics, versions or
 * error text, so they are safe to expose to the platform's health checker.
 */
@Controller('health')
@SkipThrottle({ short: true, medium: true })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @Version(VERSION_NEUTRAL)
  live() {
    return { status: 'ok' }
  }

  @Public()
  @Get('ready')
  @Version(VERSION_NEUTRAL)
  @HttpCode(200)
  async ready() {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000).unref())
    try {
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout])
      return { status: 'ready' }
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable' })
    }
  }
}
