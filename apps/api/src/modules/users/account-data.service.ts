import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { hashPassword, verifyPassword } from '../../common/passwords'
import { randomBytes } from 'node:crypto'
import { AuthUser } from '@assessiq/types'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'

// Exports are complete for realistic accounts; the cap only protects the API
// from pathological sizes and is reported when reached.
const EXPORT_CAP = 5000

/**
 * Self-service data rights for standalone learners.
 *
 * Deletion removes the learner's personal learning content, uploads and exam
 * records, revokes every session and turns the account row into an anonymous
 * tombstone. The tombstone remains only so cost records (AI usage: action,
 * model, token counts, cost — no learning content) and administrator audit
 * entries stay referentially intact. Institutional accounts are excluded: their
 * assessment records belong to the organisation and are handled through it.
 */
@Injectable()
export class AccountDataService {
  private readonly logger = new Logger(AccountDataService.name)
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async standalone(user: AuthUser) {
    if (user.organizationId)
      throw new ForbiddenException(
        'Your account is managed by your institution. Contact your institution administrator to export or delete it.',
      )
    return this.prisma.user.findUniqueOrThrow({ where: { id: user.id } })
  }

  async export(user: AuthUser) {
    const account = await this.standalone(user)
    const take = EXPORT_CAP + 1
    const id = user.id
    const [courses, documents, quizzes, flashcards, plans, sessions, availability, gpa, goals, mocks, masteries, reports, aiUsage] =
      await Promise.all([
        this.prisma.course.findMany({
          where: { ownerId: id },
          take,
          include: { topics: true },
        }),
        this.prisma.document.findMany({
          where: { uploadedById: id },
          take,
          select: { id: true, fileName: true, fileType: true, fileSizeBytes: true, status: true, courseId: true, createdAt: true },
        }),
        this.prisma.selfQuizAttempt.findMany({ where: { studentId: id }, take, orderBy: { createdAt: 'asc' } }),
        this.prisma.flashcard.findMany({ where: { studentId: id }, take }),
        this.prisma.studyPlan.findMany({ where: { studentId: id }, take }),
        this.prisma.studySession.findMany({ where: { studentId: id }, take }),
        this.prisma.studyAvailability.findMany({ where: { studentId: id }, take }),
        this.prisma.gpaEntry.findMany({ where: { studentId: id }, take }),
        this.prisma.examGoal.findMany({ where: { studentId: id }, include: { subjects: true }, take }),
        this.prisma.examMockAttempt.findMany({
          where: { studentId: id },
          take,
          select: { id: true, goalId: true, status: true, startedAt: true, submittedAt: true, specification: true, answers: true, result: true },
        }),
        this.prisma.topicMastery.findMany({ where: { studentId: id }, take }),
        this.prisma.examQuestionReport.findMany({ where: { reporterId: id }, take }),
        this.prisma.aIUsageLog.findMany({
          where: { userId: id },
          take,
          select: { action: true, model: true, inputTokens: true, outputTokens: true, createdAt: true },
        }),
      ])
    const sections = { courses, documents, quizzes, flashcards, plans, sessions, availability, gpa, goals, mocks, masteries, reports, aiUsage }
    const truncated = Object.entries(sections).filter(([, rows]) => rows.length > EXPORT_CAP).map(([name]) => name)
    for (const name of truncated) (sections as Record<string, unknown[]>)[name] = (sections as Record<string, unknown[]>)[name]!.slice(0, EXPORT_CAP)
    const { passwordHash: _p, sessionVersion: _s, ...profile } = account
    return {
      exportedAt: new Date(),
      format: 'nightklass-account-export/1',
      profile,
      ...sections,
      notes: [
        'Uploaded files are listed by name; download originals from your workspace before deleting your account.',
        ...(truncated.length ? [`Sections capped at ${EXPORT_CAP} records: ${truncated.join(', ')}. Contact support for a complete export.`] : []),
      ],
    }
  }

  async delete(user: AuthUser, password: string) {
    const account = await this.standalone(user)
    if (account.deletedAt) throw new UnauthorizedException('Account is unavailable')
    if (!(await verifyPassword(password, account.passwordHash)))
      throw new UnauthorizedException('Password is incorrect')
    if (await this.prisma.nightklassAdmin.findUnique({ where: { userId: user.id } }))
      throw new ForbiddenException('Remove your Nightklass administrator access before deleting this account.')
    const id = user.id
    const files = await this.prisma.document.findMany({ where: { uploadedById: id }, select: { fileUrl: true } })
    await this.prisma.$transaction(
      async (tx) => {
        // Exam records first: attempts restrict goal deletion; goal subjects restrict course deletion.
        await tx.examMockAttempt.deleteMany({ where: { studentId: id } })
        await tx.examGoal.deleteMany({ where: { studentId: id } })
        await tx.examObjectiveStudyLink.deleteMany({ where: { studentId: id } })
        await tx.examQuestionExposure.deleteMany({ where: { studentId: id } })
        await tx.examQuestionReport.deleteMany({ where: { reporterId: id } })
        await tx.examCohortMember.deleteMany({ where: { userId: id } })
        await tx.selfQuizAttempt.deleteMany({ where: { studentId: id } })
        await tx.flashcard.deleteMany({ where: { studentId: id } })
        await tx.topicMastery.deleteMany({ where: { studentId: id } })
        await tx.studySession.deleteMany({ where: { studentId: id } })
        await tx.studyPlan.deleteMany({ where: { studentId: id } })
        await tx.studyAvailability.deleteMany({ where: { studentId: id } })
        await tx.gpaEntry.deleteMany({ where: { studentId: id } })
        await tx.contentReport.deleteMany({ where: { userId: id } })
        await tx.document.deleteMany({ where: { uploadedById: id } })
        await tx.question.deleteMany({ where: { createdById: id } })
        // Courses cascade topics, lessons, outlines and their study records.
        await tx.course.deleteMany({ where: { ownerId: id } })
        await tx.refreshToken.deleteMany({ where: { userId: id } })
        await tx.emailToken.deleteMany({ where: { userId: id } })
        await tx.user.update({
          where: { id },
          data: {
            name: 'Deleted learner',
            email: `deleted-${id}@deleted.nightklass.invalid`,
            passwordHash: await hashPassword(randomBytes(32).toString('hex')),
            status: 'INACTIVE',
            deletedAt: new Date(),
            sessionVersion: { increment: 1 },
            avatarUrl: null,
            country: null,
            institutionType: null,
            programme: null,
            currentLevel: null,
            currentSemester: null,
            institution: null,
            faculty: null,
            academicSession: null,
            graduationYear: null,
            secondaryStage: null,
            emailVerifiedAt: null,
            lastLoginAt: null,
          },
        })
      },
      { timeout: 30_000 },
    )
    // Storage is not transactional: remove files after the records are gone and
    // log (without the key's contents) anything that needs a manual retry.
    for (const { fileUrl } of files)
      if (fileUrl)
        await this.storage.delete(fileUrl).catch(() => this.logger.error(`event=account_file_delete_failed userId=${id}`))
    this.logger.log(`event=account_deleted userId=${id} files=${files.length}`)
    return { deleted: true }
  }
}
