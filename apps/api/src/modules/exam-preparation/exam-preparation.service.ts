import { serializable } from '../../common/serializable'
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common'
import { AuthUser, UserRole } from '@assessiq/types'
import { PrismaService } from '../prisma/prisma.service'
import { SaveExamGoalDto } from './exam-goal.dto'
import { normalizeSubjects } from './exam-goal.rules'

@Injectable()
export class ExamPreparationService {
  constructor(private readonly prisma: PrismaService) {}

  private assertLearner(user: AuthUser) {
    if (user.organizationId || user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('Exam preparation requires a standalone Nightklass learner account')
    }
  }

  list(user: AuthUser) {
    this.assertLearner(user)
    return this.prisma.examGoal.findMany({
      where: { studentId: user.id },
      include: { subjects: { orderBy: { name: 'asc' } } },
      orderBy: [{ year: 'desc' }, { exam: 'asc' }],
    })
  }

  async save(dto: SaveExamGoalDto, user: AuthUser) {
    this.assertLearner(user)
    if (
      dto.series &&
      ((dto.exam === 'JAMB' && dto.series !== 'GENERAL') ||
        (dto.exam === 'WAEC' && dto.series === 'GENERAL'))
    ) throw new BadRequestException('Choose a valid series for this exam')
    const subjects = normalizeSubjects(dto.exam, dto.subjects)
    try {
      return await serializable(this.prisma, async tx => {
        const goal = await tx.examGoal.upsert({
          where: { studentId_exam_year: { studentId: user.id, exam: dto.exam, year: dto.year } },
          create: {
            studentId: user.id, exam: dto.exam, year: dto.year,
            series: dto.series ?? (dto.exam === 'JAMB' ? 'GENERAL' : 'SCHOOL'),
          },
          update: { series: dto.series },
        })
        // Subject courses survive changing goals and are reused across WAEC/JAMB.
        const links = []
        for (const subject of subjects) {
          const course = await tx.course.upsert({
            where: { ownerId_examSubjectKey: { ownerId: user.id, examSubjectKey: subject.key } },
            create: {
              ownerId: user.id, examSubjectKey: subject.key,
              title: subject.name, subject: subject.name,
              description: 'Nigerian senior secondary learning and WAEC/JAMB exam preparation. AI outlines are suggestions; compare with the applicable official syllabus.',
            },
            update: {},
          })
          links.push({ goalId: goal.id, subjectKey: subject.key, name: subject.name, courseId: course.id })
        }
        await tx.examGoalSubject.deleteMany({ where: { goalId: goal.id } })
        await tx.examGoalSubject.createMany({ data: links })
        return tx.examGoal.findUniqueOrThrow({
          where: { id: goal.id }, include: { subjects: { orderBy: { name: 'asc' } } },
        })
      }, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && ['P2034', 'P2002'].includes(String(error.code))) {
        throw new ConflictException('Your exam setup changed in another request. Please save again.')
      }
      throw error
    }
  }
}
