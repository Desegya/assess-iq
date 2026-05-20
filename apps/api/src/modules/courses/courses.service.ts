import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuthUser, UserRole } from '@assessiq/types'
import { CreateCourseDto } from './dto/create-course.dto'

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCourseDto, user: AuthUser) {
    if (!user.organizationId) {
      throw new ForbiddenException('You must belong to an organisation to create courses')
    }

    return this.prisma.course.create({
      data: {
        title: dto.title,
        subject: dto.subject,
        description: dto.description,
        organizationId: user.organizationId,
        teacherId: user.id,
      },
    })
  }

  async findAll(user: AuthUser) {
    if (!user.organizationId) return []

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
      where: { id, organizationId: user.organizationId ?? undefined },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        topics: { orderBy: { order: 'asc' } },
        _count: { select: { documents: true, questions: true, assessments: true } },
      },
    })
    if (!course) throw new NotFoundException('Course not found')
    return course
  }

  async update(id: string, dto: Partial<CreateCourseDto>, user: AuthUser) {
    const course = await this.findOne(id, user)

    const canEdit =
      course.teacherId === user.id ||
      user.role === UserRole.ORG_ADMIN ||
      user.role === UserRole.SUPER_ADMIN

    if (!canEdit) throw new ForbiddenException('You do not have permission to edit this course')

    return this.prisma.course.update({ where: { id }, data: dto })
  }

  async remove(id: string, user: AuthUser) {
    const course = await this.findOne(id, user)

    const canDelete =
      course.teacherId === user.id ||
      user.role === UserRole.ORG_ADMIN ||
      user.role === UserRole.SUPER_ADMIN

    if (!canDelete) throw new ForbiddenException('You do not have permission to delete this course')

    await this.prisma.course.delete({ where: { id } })
    return { message: 'Course deleted' }
  }
}
