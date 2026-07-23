import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CoursesService } from '../courses/courses.service'
import { AuthUser, UserRole } from '@assessiq/types'
import { CreateTopicDto } from './dto/create-topic.dto'
import { UpdateTopicDto } from './dto/update-topic.dto'
import { ReorderTopicsDto } from './dto/reorder-topics.dto'

@Injectable()
export class TopicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  // Throws NotFoundException if the course doesn't exist or isn't accessible to this user.
  private async assertCourseAccess(courseId: string, user: AuthUser) {
    const course = await this.coursesService.findOne(courseId, user)

    const canEdit =
      course.ownerId === user.id ||
      course.teacherId === user.id ||
      user.role === UserRole.ORG_ADMIN ||
      user.role === UserRole.SUPER_ADMIN

    return { course, canEdit }
  }

  async findAll(courseId: string, user: AuthUser) {
    await this.coursesService.findOne(courseId, user) // access check (throws if not found/accessible)
    return this.prisma.topic.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
    })
  }

  async create(courseId: string, dto: CreateTopicDto, user: AuthUser) {
    const { canEdit } = await this.assertCourseAccess(courseId, user)
    if (!canEdit) throw new ForbiddenException('You do not have permission to edit this course')

    const maxOrder = await this.prisma.topic.aggregate({
      where: { courseId },
      _max: { order: true },
    })

    return this.prisma.topic.create({
      data: {
        courseId,
        name: dto.name,
        description: dto.description,
        parentTopicId: dto.parentTopicId ?? null,
        estimatedMinutes: dto.estimatedMinutes,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    })
  }

  private async findTopicWithCourse(id: string) {
    const topic = await this.prisma.topic.findUnique({ where: { id } })
    if (!topic) throw new NotFoundException('Topic not found')
    return topic
  }

  async update(id: string, dto: UpdateTopicDto, user: AuthUser) {
    const topic = await this.findTopicWithCourse(id)
    const { canEdit } = await this.assertCourseAccess(topic.courseId, user)
    if (!canEdit) throw new ForbiddenException('You do not have permission to edit this topic')

    return this.prisma.topic.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.estimatedMinutes !== undefined && { estimatedMinutes: dto.estimatedMinutes }),
        ...(dto.importanceWeight !== undefined && { importanceWeight: dto.importanceWeight }),
      },
    })
  }

  async remove(id: string, user: AuthUser) {
    const topic = await this.findTopicWithCourse(id)
    const { canEdit } = await this.assertCourseAccess(topic.courseId, user)
    if (!canEdit) throw new ForbiddenException('You do not have permission to delete this topic')

    await this.prisma.topic.delete({ where: { id } })
    return { message: 'Topic deleted' }
  }

  async reorder(courseId: string, dto: ReorderTopicsDto, user: AuthUser) {
    const { canEdit } = await this.assertCourseAccess(courseId, user)
    if (!canEdit) throw new ForbiddenException('You do not have permission to edit this course')

    await this.prisma.$transaction(
      dto.topicIds.map((topicId, index) =>
        this.prisma.topic.update({
          where: { id: topicId },
          data: { order: index },
        }),
      ),
    )

    return this.prisma.topic.findMany({ where: { courseId }, orderBy: { order: 'asc' } })
  }
}
