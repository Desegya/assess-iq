import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuthUser, UserRole } from '@assessiq/types'
import { CreateCourseDto } from './dto/create-course.dto'
import { UpdateCourseDto } from './dto/update-course.dto'

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCourseDto, user: AuthUser) {
    // A student with no organisation creates a personally-owned course
    // (e.g. a Nightklass user whose school hasn't adopted the assessment side).
    if (!user.organizationId) {
      if (user.role !== UserRole.STUDENT) {
        throw new ForbiddenException('You must belong to an organisation to create courses')
      }
      return this.prisma.course.create({
        data: {
          title: dto.title,
          subject: dto.subject ?? dto.title,
          description: dto.description,
          courseCode: dto.courseCode,
          level: dto.level,
          semester: dto.semester,
          creditUnits: dto.creditUnits,
          isCarryover: dto.isCarryover ?? false,
          ownerId: user.id,
        },
      })
    }

    if (user.role === UserRole.STUDENT) {
      throw new ForbiddenException('Students in an organisation cannot create organisation courses')
    }

    return this.prisma.course.create({
      data: {
        title: dto.title,
        subject: dto.subject ?? dto.title,
        description: dto.description,
        courseCode: dto.courseCode,
        level: dto.level,
        creditUnits: dto.creditUnits,
        semester: dto.semester,
        organizationId: user.organizationId,
        teacherId: user.id,
      },
    })
  }

  async findAll(user: AuthUser) {
    if (!user.organizationId) {
      return this.prisma.course.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { documents: true, questions: true, assessments: true } },
        },
      })
    }

    return this.prisma.course.findMany({
      where: {
        organizationId: user.organizationId,
        // Teachers see only their own; admins see all
        ...(user.role === UserRole.TEACHER ? { teacherId: user.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        teacher: { select: { id: true, name: true } },
        _count: { select: { documents: true, questions: true, assessments: true } },
      },
    })
  }

  async findOne(id: string, user: AuthUser) {
    const course = await this.prisma.course.findFirst({
      where: user.organizationId
        ? { id, organizationId: user.organizationId }
        : { id, ownerId: user.id },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        topics: { where: { archivedAt: null }, orderBy: { order: 'asc' } },
        _count: { select: { documents: true, questions: true, assessments: true } },
      },
    })
    if (!course) throw new NotFoundException('Course not found')
    return course
  }

  async update(id: string, dto: UpdateCourseDto, user: AuthUser) {
    const course = await this.findOne(id, user)

    const canEdit =
      course.ownerId === user.id ||
      course.teacherId === user.id ||
      user.role === UserRole.ORG_ADMIN ||
      user.role === UserRole.SUPER_ADMIN

    if (!canEdit) throw new ForbiddenException('You do not have permission to edit this course')

    // Only course details are editable — never ownership or organisation. null (or "") clears optional fields.
    const has = (key: keyof UpdateCourseDto) => Object.prototype.hasOwnProperty.call(dto, key)
    return this.prisma.course.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && dto.title !== null && { title: dto.title.trim() }),
        ...(dto.subject !== undefined && dto.subject !== null
          ? { subject: dto.subject.trim() }
          : // Student courses default subject to the title; keep it in step so AI context isn't stale
            dto.title && course.subject === course.title && { subject: dto.title.trim() }),
        ...(has('description') && { description: dto.description?.trim() || null }),
        ...(has('courseCode') && { courseCode: dto.courseCode?.trim().toUpperCase() || null }),
        ...(has('level') && { level: dto.level ?? null }),
        ...(has('semester') && { semester: dto.semester ?? null }),
        ...(has('creditUnits') && { creditUnits: dto.creditUnits ?? null }),
        ...(dto.isCarryover !== undefined && dto.isCarryover !== null && { isCarryover: dto.isCarryover }),
      },
    })
  }

  async remove(id: string, user: AuthUser) {
    const course = await this.findOne(id, user)

    const canDelete =
      course.ownerId === user.id ||
      course.teacherId === user.id ||
      user.role === UserRole.ORG_ADMIN ||
      user.role === UserRole.SUPER_ADMIN

    if (!canDelete) throw new ForbiddenException('You do not have permission to delete this course')

    await this.prisma.course.delete({ where: { id } })
    return { message: 'Course deleted' }
  }
}
