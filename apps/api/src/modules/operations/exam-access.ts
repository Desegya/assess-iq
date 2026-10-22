import { CanActivate, ExecutionContext, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { AuthUser } from '@assessiq/types'
import { PrismaService } from '../prisma/prisma.service'
import { RuntimeSettingsService } from './runtime-settings.service'

@Injectable()
export class ExamAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: RuntimeSettingsService,
  ) {}

  async status(user: Pick<AuthUser, 'id'>) {
    const [mode, newAttemptsPaused] = await Promise.all([
      this.settings.get<'OPEN' | 'COHORT'>('exam.access'),
      this.settings.get<boolean>('exam.newAttemptsPaused'),
    ])
    const member =
      mode === 'OPEN' || !!(await this.prisma.examCohortMember.findUnique({ where: { userId: user.id } }))
    return {
      available: member,
      mode,
      newAttemptsPaused,
      message: member
        ? null
        : 'WAEC and JAMB preparation is currently open to invited pilot learners only. Your other Nightklass study tools are unaffected.',
    }
  }

  async assertAvailable(user: Pick<AuthUser, 'id'>) {
    const status = await this.status(user)
    if (!status.available) throw new ForbiddenException(status.message)
  }

  /** Emergency brake for new mocks; in-progress attempts can still be saved, submitted and reviewed. */
  async assertCanStartAttempt() {
    if (await this.settings.get<boolean>('exam.newAttemptsPaused'))
      throw new ServiceUnavailableException(
        'New mock exams are paused for maintenance. Any mock you already started is saved and can still be completed.',
      )
  }
}

/**
 * Server-side pilot boundary for every learner exam route. Applied per
 * controller; hiding navigation in the frontend is not relied on.
 */
@Injectable()
export class ExamAccessGuard implements CanActivate {
  constructor(private readonly access: ExamAccessService) {}
  async canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined
    if (!user?.id) return false
    await this.access.assertAvailable(user)
    return true
  }
}
