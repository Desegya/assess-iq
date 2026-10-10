import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class NightklassAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest()
    if (!req.user?.id) throw new ForbiddenException('Nightklass administrator access required')
    const grant = await this.prisma.nightklassAdmin.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { status: true, organizationId: true } } },
    })
    if (!grant || grant.user.status !== 'ACTIVE' || grant.user.organizationId !== null) {
      throw new ForbiddenException('Nightklass administrator access required')
    }
    req.adminRole = grant.role
    return true
  }
}
