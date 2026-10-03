import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuthUser, GpaScale } from '@assessiq/types'
import { CreateGpaEntryDto } from './dto/create-gpa-entry.dto'

const GRADE_POINTS: Record<string, Record<string, number>> = {
  FIVE: { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 },
  FOUR: { A: 4, B: 3, C: 2, D: 1, F: 0 },
}

@Injectable()
export class GpaService {
  constructor(private readonly prisma: PrismaService) {}

  private withPoint<T extends { grade: string; scale: string }>(entry: T) {
    return { ...entry, gradePoint: GRADE_POINTS[entry.scale]?.[entry.grade] ?? 0 }
  }

  async findAll(user: AuthUser) {
    const entries = await this.prisma.gpaEntry.findMany({
      where: { studentId: user.id },
      orderBy: [{ level: 'asc' }, { semester: 'asc' }, { order: 'asc' }],
    })
    return entries.map(e => this.withPoint(e))
  }

  async create(dto: CreateGpaEntryDto, user: AuthUser) {
    const validGrades = GRADE_POINTS[dto.scale] ?? {}
    const grade = dto.grade.toUpperCase()
    if (!(grade in validGrades)) {
      throw new BadRequestException(`"${dto.grade}" is not a valid grade for the ${dto.scale === GpaScale.FIVE ? '5.0' : '4.0'} scale`)
    }

    const maxOrder = await this.prisma.gpaEntry.aggregate({
      where: { studentId: user.id, level: dto.level, semester: dto.semester },
      _max: { order: true },
    })

    const entry = await this.prisma.gpaEntry.create({
      data: {
        studentId: user.id,
        level: dto.level,
        semester: dto.semester,
        courseTitle: dto.courseTitle,
        creditUnits: dto.creditUnits,
        grade,
        scale: dto.scale,
        order: (maxOrder._max?.order ?? -1) + 1,
      },
    })
    return this.withPoint(entry)
  }

  async remove(id: string, user: AuthUser) {
    const entry = await this.prisma.gpaEntry.findUnique({ where: { id } })
    if (!entry || entry.studentId !== user.id) throw new NotFoundException('Entry not found')

    await this.prisma.gpaEntry.delete({ where: { id } })
    return { message: 'Entry deleted' }
  }
}
