import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { AuthService } from '../auth/auth.service'
import { LoginDto } from '../auth/dto/login.dto'
import { Public } from '../auth/decorators/public.decorator'
import { PrismaService } from '../prisma/prisma.service'

@Controller('admin/nightklass-auth')
export class AdminAuthController {
  constructor(private readonly auth: AuthService, private readonly prisma: PrismaService) {}
  @Public()
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ short: { limit: 2, ttl: 1000 }, medium: { limit: 10, ttl: 15 * 60 * 1000 } })
  async login(@Body() dto: LoginDto) {
    const result = await this.auth.login(dto)
    const user = result.user as { id: string; status: string; organizationId: string | null }
    const grant = await this.prisma.nightklassAdmin.findUnique({ where: { userId: user.id } })
    if (!grant || user.status !== 'ACTIVE' || user.organizationId !== null) {
      await this.auth.logout(result.refreshToken)
      throw new ForbiddenException('Nightklass administrator access required')
    }
    await this.prisma.nightklassAdminAudit.create({ data: { actorId: user.id, action: 'ADMIN_LOGIN', resourceType: 'user', resourceId: user.id } })
    return { ...result, adminRole: grant.role }
  }
}
