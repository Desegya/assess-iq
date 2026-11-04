import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { AuthUser } from '@assessiq/types'
import { PrismaService } from '../prisma/prisma.service'
import { TimetableDto } from './dto/timetable.dto'
import { loadPlanTopics } from './plan-topics'
import { buildPlan } from './plan-builder'
import { buildTimetableSlots, coursePriority } from './timetable-builder'

type Database = Pick<
  PrismaService,
  'course' | 'topic' | 'topicMastery' | 'studyPlan' | 'studySession'
>
type SavedPreferences = {
  timetable?: TimetableDto
  anchorStart?: string
  lastAutoAdjustedDay?: string
}
const DAY = 86_400_000
const dateKey = (date: Date) => date.toISOString().slice(0, 10)
const json = (value: unknown) => JSON.parse(JSON.stringify(value))

function localDay(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = (name: string) => parts.find((part) => part.type === name)!.value
  return new Date(`${value('year')}-${value('month')}-${value('day')}T00:00:00Z`)
}

@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  private async prepare(
    settings: TimetableDto,
    user: AuthUser,
    db: Database,
    anchor?: Date,
    ends?: Map<string, Date>,
  ) {
    const today = localDay(settings.timeZone)
    const earliest = new Date(+today + DAY)
    const from = anchor ?? earliest
    const end = ends
      ? new Date(Math.max(...[...ends.values()].map((date) => +date)))
      : new Date(+from + settings.weeks * 7 * DAY)
    const ids = settings.courses.map((course) => course.courseId)
    if (!ids.length || new Set(ids).size !== ids.length)
      throw new BadRequestException('Select each course only once')
    const startTime = settings.startTime ?? '18:00'
    const endTime = settings.endTime ?? '21:00'
    if (
      settings.schedulingStyle === 'TIMED' &&
      (startTime < '07:00' || endTime > '22:00' || startTime >= endTime)
    )
      throw new BadRequestException(
        'Choose a study window between 07:00 and 22:00, with the end after the start',
      )
    const courses = await db.course.findMany({
      where: {
        id: { in: ids },
        ...(user.organizationId ? { organizationId: user.organizationId } : { ownerId: user.id }),
      },
      orderBy: { id: 'asc' },
    })
    if (courses.length !== ids.length)
      throw new NotFoundException('One or more selected courses are unavailable')
    const prepared = await Promise.all(
      courses.map(async (course) => {
        const topics = await loadPlanTopics(db, course.id, user)
        const priority = coursePriority(
          course.creditUnits,
          settings.courses.find((c) => c.courseId === course.id)?.difficulty,
          topics,
        )
        const deadline =
          ends?.get(course.id) ??
          (course.targetExamDate && course.targetExamDate > earliest && course.targetExamDate < end
            ? course.targetExamDate
            : end)
        const urgent = +deadline - +earliest <= 21 * DAY && !!course.targetExamDate
        return { course, topics, priority, deadline, weight: priority.weight * (urgent ? 1.3 : 1) }
      }),
    )
    const busy = await db.studySession.findMany({
      where: {
        studentId: user.id,
        scheduledDate: { gte: from, lt: end },
        OR: [
          { courseId: { notIn: ids }, studyPlan: { status: 'ACTIVE' }, status: 'NOT_STARTED' },
          { status: { in: ['COMPLETED', 'IN_PROGRESS'] } },
          {
            courseId: { in: ids },
            studyPlan: { status: 'ACTIVE' },
            status: 'NOT_STARTED',
            scheduledDate: { gte: today, lt: earliest },
          },
        ],
      },
      select: {
        courseId: true,
        scheduledDate: true,
        startTime: true,
        endTime: true,
        estimatedMinutes: true,
      },
    })
    const built = buildTimetableSlots(
      prepared.map((c) => ({ id: c.course.id, end: c.deadline, weight: c.weight })),
      from,
      end,
      earliest,
      {
        weeklyMinutes: Math.round(settings.weeklyHours * 4) * 15,
        dailyMinutes: settings.dailyMinutes,
        maxCoursesPerDay: settings.maxCoursesPerDay,
        studyDays: settings.studyDays,
        schedulingStyle: settings.schedulingStyle,
        startTime,
        endTime,
      },
      busy,
      busy.filter((session) => ids.includes(session.courseId)),
    )
    const warnings = [...built.warnings]
    const plans = prepared.map(({ course, topics, priority, deadline }) => {
      const slots = built.allocation.get(course.id) ?? []
      const topicPlan = topics.length
        ? buildPlan(topics, slots, { planStart: from, examDate: deadline, fillPractice: true })
        : null
      if (!topics.length)
        warnings.push(
          `${course.title} has no outline yet. It receives course study blocks; add topics to get specific lessons.`,
        )
      if (topicPlan?.unscheduledTopics.length)
        warnings.push(
          `${course.title}: more time is needed for ${topicPlan.unscheduledTopics.join(', ')}.`,
        )
      const sessions = (
        topicPlan?.sessions ??
        slots.map((slot) => ({
          scheduledDate: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          estimatedMinutes: slot.capacityMinutes,
          topicId: null,
          kind: 'LEARN' as const,
          weekNumber: Math.floor((+slot.date - +from) / (7 * DAY)) + 1,
          note: 'Choose a topic from your course outline',
        }))
      ).map((session) => ({
        ...session,
        startTime: settings.schedulingStyle === 'DAILY' ? null : session.startTime,
        endTime: settings.schedulingStyle === 'DAILY' ? null : session.endTime,
      }))
      const minutes = sessions.reduce((sum, session) => sum + session.estimatedMinutes, 0)
      const weeklyMinutes =
        Math.round(minutes / Math.max(1, (+deadline - +earliest) / (7 * DAY)) / 15) * 15
      return {
        courseId: course.id,
        title: course.title,
        ...priority,
        deadline,
        topics: topics.map((topic) => ({ id: topic.id, name: topic.name })),
        weeklyMinutes,
        sessions,
        reason: `${priority.units} units${priority.assumedUnits ? ' assumed; update the course units if needed' : ''}; ${priority.estimatedDifficulty ? 'estimated' : 'your rated'} difficulty ${priority.difficulty}/5; ${priority.mastery === null ? 'no quiz evidence yet' : 'quiz average ' + Math.round(priority.mastery) + '%'}${urgent(course.targetExamDate, earliest) ? '; exam approaching' : ''}`,
      }
    })
    const canApply =
      built.warnings.length === 0 &&
      plans.every((plan) => plan.sessions.length > 0 || (ends && plan.deadline <= earliest))
    for (const plan of plans)
      if (!plan.sessions.length && plan.deadline > earliest)
        warnings.push(
          `No study time fits for ${plan.title}. Increase the workload, select more days, or raise the daily course limit.`,
        )
    return { settings, startDate: from, endDate: end, earliest, plans, warnings, canApply }
  }

  private response(prepared: Awaited<ReturnType<TimetableService['prepare']>>) {
    const days = new Map<string, { date: string; sessions: object[] }>()
    for (const plan of prepared.plans)
      for (const session of plan.sessions) {
        const date = dateKey(session.scheduledDate)
        if (!days.has(date)) days.set(date, { date, sessions: [] })
        days.get(date)!.sessions.push({
          ...session,
          courseId: plan.courseId,
          courseTitle: plan.title,
          topicName:
            plan.topics.find((topic) => topic.id === session.topicId)?.name ?? 'Course study',
        })
      }
    return {
      settings: prepared.settings,
      startDate: prepared.startDate,
      endDate: prepared.endDate,
      canApply: prepared.canApply,
      warnings: prepared.warnings,
      courses: prepared.plans.map(({ sessions, topics, deadline, weight, ...course }) => course),
      days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    }
  }

  async preview(settings: TimetableDto, user: AuthUser) {
    return this.response(await this.prepare(settings, user, this.prisma))
  }

  async apply(settings: TimetableDto, user: AuthUser) {
    const timetableId = randomUUID()
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))::text`
        const prepared = await this.prepare(settings, user, tx)
        if (!prepared.canApply) throw new BadRequestException(prepared.warnings.join(' '))
        const previous = await tx.studyPlan.findMany({
          where: {
            studentId: user.id,
            courseId: { in: settings.courses.map((course) => course.courseId) },
            status: 'ACTIVE',
          },
          select: { id: true, courseId: true },
        })
        await tx.studyPlan.updateMany({
          where: {
            studentId: user.id,
            courseId: { in: settings.courses.map((c) => c.courseId) },
            status: 'ACTIVE',
          },
          data: { status: 'ABANDONED' },
        })
        for (const plan of prepared.plans) {
          const version = await tx.studyPlan.count({
            where: { studentId: user.id, courseId: plan.courseId },
          })
          const replacement = await tx.studyPlan.create({
            data: {
              studentId: user.id,
              courseId: plan.courseId,
              timetableId,
              startDate: prepared.startDate,
              examDate: plan.deadline,
              version: version + 1,
              planType: plan.deadline < prepared.endDate ? 'EXAM_DATE' : 'DURATION',
              weeks: plan.deadline < prepared.endDate ? null : settings.weeks,
              weeklyMinutes: plan.weeklyMinutes,
              schedulingPreferences: json({
                schedulingStyle: settings.schedulingStyle,
                studyDays: settings.studyDays,
                timeZone: settings.timeZone,
                studyPreference: 'EVENINGS',
                avoidWorkHours: true,
                workStart: '09:00',
                workEnd: '17:00',
                timetable: settings,
                anchorStart: dateKey(prepared.startDate),
                lastAutoAdjustedDay: dateKey(localDay(settings.timeZone)),
              }),
              changeLog: [
                {
                  at: new Date().toISOString(),
                  reason: `Combined timetable created. ${plan.reason}`,
                },
              ],
              sessions: {
                create: plan.sessions.map((session) => ({
                  ...session,
                  studentId: user.id,
                  courseId: plan.courseId,
                })),
              },
            },
          })
          // Today is already a commitment. Keep its task IDs, completion and ratings visible under
          // the replacement plan; only tomorrow onwards receives the new timetable.
          await tx.studySession.updateMany({
            where: {
              studentId: user.id,
              courseId: plan.courseId,
              studyPlanId: {
                in: previous.filter((old) => old.courseId === plan.courseId).map((old) => old.id),
              },
              scheduledDate: { gte: new Date(+prepared.earliest - DAY), lt: prepared.earliest },
              status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] },
            },
            data: { studyPlanId: replacement.id },
          })
        }
      },
      { timeout: 30000 },
    )
    return this.current(user)
  }

  async current(user: AuthUser) {
    const latest = await this.prisma.studyPlan.findFirst({
      where: { studentId: user.id, status: 'ACTIVE', timetableId: { not: null } },
      orderBy: { createdAt: 'desc' },
    })
    if (!latest?.timetableId) return null
    const plans = await this.prisma.studyPlan.findMany({
      where: { studentId: user.id, timetableId: latest.timetableId, status: 'ACTIVE' },
      include: { course: { select: { id: true, title: true } } },
    })
    const preferences = latest.schedulingPreferences as unknown as SavedPreferences
    return {
      id: latest.timetableId,
      settings: preferences.timetable,
      courses: plans.map((plan) => ({
        id: plan.courseId,
        title: plan.course.title,
        weeklyMinutes: plan.weeklyMinutes,
      })),
      updatedAt: latest.updatedAt,
      lastChange: (latest.changeLog as { reason: string }[])?.at(-1)?.reason ?? 'Timetable created',
    }
  }

  async adapt(timetableId: string, user: AuthUser, reason: string, automatic = false) {
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))::text`
        const plans = await tx.studyPlan.findMany({
          where: { studentId: user.id, timetableId, status: 'ACTIVE' },
        })
        if (!plans.length) return
        const preferences = plans[0]!.schedulingPreferences as unknown as SavedPreferences
        if (!preferences.timetable || (automatic && !preferences.timetable.autoAdjust)) return
        const settings = {
          ...preferences.timetable,
          courses: preferences.timetable.courses.filter((course) =>
            plans.some((plan) => plan.courseId === course.courseId),
          ),
        }
        const from = new Date(`${preferences.anchorStart}T00:00:00Z`)
        if (Math.max(...plans.map((plan) => +plan.examDate)) <= +localDay(settings.timeZone)) return
        const prepared = await this.prepare(
          settings,
          user,
          tx,
          from,
          new Map(plans.map((plan) => [plan.courseId, plan.examDate])),
        )
        for (const plan of plans) {
          const next = prepared.plans.find((course) => course.courseId === plan.courseId)!
          const today = new Date(+prepared.earliest - DAY)
          await tx.studySession.updateMany({
            where: { studyPlanId: plan.id, status: 'NOT_STARTED', scheduledDate: { lt: today } },
            data: { status: 'MISSED' },
          })
          await tx.studySession.deleteMany({
            where: {
              studyPlanId: plan.id,
              status: 'NOT_STARTED',
              scheduledDate: { gte: prepared.earliest },
            },
          })
          await tx.studySession.createMany({
            data: next.sessions.map((session) => ({
              ...session,
              studyPlanId: plan.id,
              studentId: user.id,
              courseId: plan.courseId,
            })),
          })
          await tx.studyPlan.update({
            where: { id: plan.id },
            data: {
              weeklyMinutes: next.weeklyMinutes,
              schedulingPreferences: json({
                ...(plan.schedulingPreferences as object),
                lastAutoAdjustedDay: dateKey(today),
              }),
              changeLog: json([
                ...(plan.changeLog as object[]),
                {
                  at: new Date().toISOString(),
                  reason: `${reason}. ${next.reason}${prepared.warnings.length ? '; ' + prepared.warnings.join(' ') : ''}`,
                },
              ]),
            },
          })
        }
      },
      { timeout: 30000 },
    )
  }

  async afterStudy(courseId: string, user: AuthUser, reason: string) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: {
        studentId: user.id,
        courseId,
        status: 'ACTIVE',
        timetableId: { not: null },
        examDate: { gt: new Date() },
      },
    })
    if (!plan?.timetableId) return false
    const preferences = plan.schedulingPreferences as unknown as SavedPreferences
    if (!preferences.timetable?.autoAdjust) return false
    await this.adapt(plan.timetableId, user, reason, true)
    return true
  }

  async refreshDue(user: AuthUser) {
    const plans = await this.prisma.studyPlan.findMany({
      where: {
        studentId: user.id,
        status: 'ACTIVE',
        timetableId: { not: null },
        examDate: { gt: new Date() },
      },
      distinct: ['timetableId'],
    })
    for (const plan of plans) {
      const preferences = plan.schedulingPreferences as unknown as SavedPreferences
      if (
        !preferences.timetable?.autoAdjust ||
        preferences.lastAutoAdjustedDay === dateKey(localDay(preferences.timetable.timeZone))
      )
        continue
      await this.adapt(
        plan.timetableId!,
        user,
        'Daily review of progress and unfinished study',
        true,
      )
    }
  }
}

function urgent(date: Date | null, earliest: Date) {
  return !!date && date > earliest && +date - +earliest <= 21 * DAY
}
