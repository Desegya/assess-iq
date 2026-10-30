import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { Logger } from '@nestjs/common'
import { StorageService } from '../storage/storage.service'
import { lessonVisualKeys } from '../../common/lesson-visual-keys'
import { PrismaService } from '../prisma/prisma.service'
import { CoursesService } from '../courses/courses.service'
import { AuthUser, UserRole, TopicSource } from '@assessiq/types'
import { CreateTopicDto } from './dto/create-topic.dto'
import { UpdateTopicDto } from './dto/update-topic.dto'
import { ReorderTopicsDto } from './dto/reorder-topics.dto'
import type { OutlineTopicDto } from './dto/bulk-create-topics.dto'

const ACTIVE = { archivedAt: null }

@Injectable()
export class TopicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
    private readonly storage?: StorageService,
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

  async assertCanEdit(courseId: string, user: AuthUser) {
    const { course, canEdit } = await this.assertCourseAccess(courseId, user)
    if (!canEdit) throw new ForbiddenException('You do not have permission to edit this course')
    return course
  }

  async findAll(courseId: string, user: AuthUser) {
    await this.coursesService.findOne(courseId, user) // access check (throws if not found/accessible)
    return this.prisma.topic.findMany({
      where: { courseId, ...ACTIVE },
      orderBy: { order: 'asc' },
    })
  }

  async create(courseId: string, dto: CreateTopicDto, user: AuthUser) {
    await this.assertCanEdit(courseId, user)

    if (dto.parentTopicId) {
      const parent = await this.prisma.topic.findFirst({ where: { id: dto.parentTopicId, courseId, ...ACTIVE } })
      if (!parent) throw new BadRequestException('Parent topic not found in this course')
    }

    const maxOrder = await this.prisma.topic.aggregate({
      where: { courseId, parentTopicId: dto.parentTopicId ?? null },
      _max: { order: true },
    })

    const topic = await this.prisma.topic.create({
      data: {
        courseId,
        name: dto.name,
        description: dto.description,
        parentTopicId: dto.parentTopicId ?? null,
        estimatedMinutes: dto.estimatedMinutes,
        source: dto.source ?? TopicSource.STUDENT,
        order: (maxOrder._max?.order ?? -1) + 1,
      },
    })
    await this.recordRevision(courseId, user.id, `Added "${topic.name}"`)
    return topic
  }

  // Saves a whole reviewed outline (topics with optional subtopics) after the existing topics
  async createTree(courseId: string, items: OutlineTopicDto[], source: TopicSource, user: AuthUser, reason?: string) {
    await this.assertCanEdit(courseId, user)

    const maxOrder = await this.prisma.topic.aggregate({
      where: { courseId, parentTopicId: null },
      _max: { order: true },
    })
    const start = (maxOrder._max?.order ?? -1) + 1

    const created = await this.prisma.$transaction(async tx => {
      const result = []
      for (const [i, item] of items.entries()) {
        const topic = await tx.topic.create({
          data: { courseId, name: item.name, description: item.description, source, order: start + i },
        })
        for (const [j, sub] of (item.subtopics ?? []).entries()) {
          await tx.topic.create({
            data: { courseId, name: sub.name, description: sub.description, source, parentTopicId: topic.id, order: j },
          })
        }
        result.push(topic)
      }
      return result
    })

    await this.recordRevision(courseId, user.id, reason ?? `Added ${created.length} topic(s)`)
    return created
  }

  private async findTopic(id: string) {
    const topic = await this.prisma.topic.findUnique({ where: { id } })
    if (!topic) throw new NotFoundException('Topic not found')
    return topic
  }

  async update(id: string, dto: UpdateTopicDto, user: AuthUser) {
    const topic = await this.findTopic(id)
    await this.assertCanEdit(topic.courseId, user)

    const updated = await this.prisma.topic.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.estimatedMinutes !== undefined && { estimatedMinutes: dto.estimatedMinutes }),
        ...(dto.importanceWeight !== undefined && { importanceWeight: dto.importanceWeight }),
      },
    })
    if (dto.name !== undefined && dto.name !== topic.name) {
      await this.recordRevision(topic.courseId, user.id, `Renamed "${topic.name}" to "${dto.name}"`)
    }
    return updated
  }

  // Topics with study history are archived (restorable); untouched ones are deleted outright
  async remove(id: string, user: AuthUser) {
    const topic = await this.findTopic(id)
    await this.assertCanEdit(topic.courseId, user)

    const children = await this.prisma.topic.findMany({ where: { parentTopicId: id }, select: { id: true } })
    const ids = [id, ...children.map(c => c.id)]

    const [sessions, masteries, flashcards, questions] = await Promise.all([
      this.prisma.studySession.count({ where: { topicId: { in: ids } } }),
      this.prisma.topicMastery.count({ where: { topicId: { in: ids } } }),
      this.prisma.flashcard.count({ where: { topicId: { in: ids } } }),
      this.prisma.question.count({ where: { topicId: { in: ids } } }),
    ])
    const hasProgress = sessions + masteries + flashcards + questions > 0

    if (hasProgress) {
      await this.prisma.topic.updateMany({ where: { id: { in: ids } }, data: { archivedAt: new Date() } })
    } else {
      const lessons = await this.prisma.topicLesson.findMany({ where: { topicId: { in: ids } }, select: { content: true } })
      await this.prisma.$transaction([
        this.prisma.topic.deleteMany({ where: { parentTopicId: id } }),
        this.prisma.topic.delete({ where: { id } }),
      ])
      for (const key of new Set(lessons.flatMap(lesson => lessonVisualKeys(lesson.content))))
        await this.storage?.delete(key).catch(() => new Logger(TopicsService.name).error('event=lesson_visual_delete_failed'))
    }

    await this.recordRevision(topic.courseId, user.id, `${hasProgress ? 'Archived' : 'Removed'} "${topic.name}"`)
    return { archived: hasProgress, message: hasProgress ? 'Topic archived — your progress is kept' : 'Topic deleted' }
  }

  async listArchived(courseId: string, user: AuthUser) {
    await this.coursesService.findOne(courseId, user)
    return this.prisma.topic.findMany({
      where: { courseId, archivedAt: { not: null } },
      orderBy: { archivedAt: 'desc' },
    })
  }

  async restore(id: string, user: AuthUser) {
    const topic = await this.findTopic(id)
    await this.assertCanEdit(topic.courseId, user)

    // Restore the topic, the subtopics archived with it, and its parent if that was archived too
    await this.prisma.topic.updateMany({
      where: {
        OR: [
          { id },
          { parentTopicId: id, archivedAt: topic.archivedAt },
          ...(topic.parentTopicId ? [{ id: topic.parentTopicId }] : []),
        ],
      },
      data: { archivedAt: null },
    })
    await this.recordRevision(topic.courseId, user.id, `Restored "${topic.name}"`)
    return { message: 'Topic restored' }
  }

  async reorder(courseId: string, dto: ReorderTopicsDto, user: AuthUser) {
    await this.assertCanEdit(courseId, user)

    await this.prisma.$transaction(
      dto.topicIds.map((topicId, index) =>
        this.prisma.topic.update({
          where: { id: topicId },
          data: { order: index },
        }),
      ),
    )
    await this.recordRevision(courseId, user.id, 'Reordered topics')

    return this.prisma.topic.findMany({ where: { courseId, ...ACTIVE }, orderBy: { order: 'asc' } })
  }

  // ─── Outline versioning ───────────────────────────────────────────────────

  async recordRevision(courseId: string, userId: string, reason: string) {
    const topics = await this.prisma.topic.findMany({
      where: { courseId, ...ACTIVE },
      orderBy: [{ parentTopicId: 'asc' }, { order: 'asc' }],
      select: { id: true, name: true, parentTopicId: true, order: true, source: true },
    })
    await this.prisma.outlineRevision.create({
      data: { courseId, createdById: userId, reason, snapshot: topics },
    })
  }

  async listRevisions(courseId: string, user: AuthUser) {
    await this.coursesService.findOne(courseId, user)
    return this.prisma.outlineRevision.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, reason: true, createdAt: true },
    })
  }
}
