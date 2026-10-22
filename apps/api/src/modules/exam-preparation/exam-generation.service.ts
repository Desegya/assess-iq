import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { Prisma } from '@assessiq/db'
import { PrismaService } from '../prisma/prisma.service'
import { ExamContentService } from './exam-content.service'
import { GenerateBankDto } from './exam-content.dto'
@Injectable()
export class ExamGenerationService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ExamContentService,
  ) {}
  private timer?: ReturnType<typeof setInterval>
  private working = false
  private readonly logger = new Logger(ExamGenerationService.name)
  onModuleInit() {
    this.timer = setInterval(() => void this.process(), 10000)
    this.timer.unref()
    void this.process()
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }
  list(actorId: string) {
    return this.prisma.examGenerationJob.findMany({
      where: { actorId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
  }
  async enqueue(dto: GenerateBankDto, requestKey: string, actorId: string) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const grant = await tx.nightklassAdmin.findUnique({
            where: { userId: actorId },
            include: { user: { select: { status: true, organizationId: true } } },
          })
          if (!grant || grant.user.status !== 'ACTIVE' || grant.user.organizationId)
            throw new ForbiddenException('Administrator access required')
          const repeated = await tx.examGenerationJob.findUnique({
            where: { actorId_requestKey: { actorId, requestKey } },
          })
          if (repeated) return repeated
          if (
            (await tx.examGenerationJob.count({
              where: { actorId, status: { in: ['QUEUED', 'RUNNING'] } },
            })) >= 10
          )
            throw new ConflictException(
              'Wait for a generation batch to finish before queueing more; at most 10 batches can be pending.',
            )
          const job = await tx.examGenerationJob.create({
            data: {
              actorId,
              requestKey,
              payload: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
            },
          })
          await tx.nightklassAdminAudit.create({
            data: {
              actorId,
              action: 'exam.generation.queue',
              resourceType: 'exam-generation',
              resourceId: job.id,
            },
          })
          return job
        },
        { isolationLevel: 'Serializable' },
      )
    } catch (err) {
      if (['P2002', 'P2034'].includes((err as { code: string })?.code))
        throw new ConflictException('Concurrent queue change. Please retry.')
      throw err
    }
  }
  private async process() {
    if (this.working) return
    this.working = true
    try {
      const due = {
        OR: [
          { status: 'QUEUED', nextAt: { lte: new Date() } },
          { status: 'RUNNING', leaseUntil: { lt: new Date() } },
        ],
      }
      const job = await this.prisma.examGenerationJob.findFirst({
        where: due,
        orderBy: { createdAt: 'asc' },
      })
      if (!job) return
      const lease = new Date(Date.now() + 300000)
      const claim = await this.prisma.examGenerationJob.updateMany({
        where: { id: job.id, ...due },
        data: { status: 'RUNNING', leaseUntil: lease, attempts: { increment: 1 } },
      })
      if (!claim.count) return
      try {
        const grant = await this.prisma.nightklassAdmin.findUnique({
          where: { userId: job.actorId },
          include: { user: { select: { status: true, organizationId: true } } },
        })
        if (!grant || grant.user.status !== 'ACTIVE' || grant.user.organizationId)
          throw new ForbiddenException('Creator no longer has content-management access')
        if (job.attempts >= 3)
          throw new Error('Generation retry limit reached after interrupted work')
        await this.content.generate(job.payload as unknown as GenerateBankDto, job.actorId, {
          id: job.id,
          leaseUntil: lease,
        })
      } catch (err) {
        const failed = job.attempts >= 2 || err instanceof ForbiddenException
        await this.prisma.examGenerationJob.updateMany({
          where: { id: job.id, status: 'RUNNING', leaseUntil: lease },
          data: {
            status: failed ? 'FAILED' : 'QUEUED',
            leaseUntil: null,
            nextAt: new Date(Date.now() + 60000),
            error: err instanceof Error ? err.message.slice(0, 500) : 'Generation failed',
          },
        })
      }
    } catch (err) {
      this.logger.warn(
        `Generation worker will retry: ${err instanceof Error ? err.message : 'database error'}`,
      )
    } finally {
      this.working = false
    }
  }
}
