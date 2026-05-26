import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuthUser, UserRole } from '@assessiq/types'

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Overview stats for the org (ORG_ADMIN) or teacher's own data ──────────

  async getOverview(user: AuthUser) {
    const orgFilter = { organizationId: user.organizationId! }
    const isTeacher = user.role === UserRole.TEACHER
    const teacherFilter = isTeacher ? { createdById: user.id } : {}

    const [
      totalStudents,
      totalAssessments,
      totalAttempts,
      completedAttempts,
      totalQuestions,
      totalCourses,
    ] = await Promise.all([
      // Students in org
      this.prisma.user.count({
        where: { ...orgFilter, role: 'STUDENT', status: 'ACTIVE' },
      }),
      // Assessments (teacher-scoped if teacher)
      this.prisma.assessment.count({
        where: { ...orgFilter, ...teacherFilter },
      }),
      // Total attempts on teacher's assessments
      this.prisma.attempt.count({
        where: {
          assessment: { ...orgFilter, ...teacherFilter },
        },
      }),
      // Completed attempts
      this.prisma.attempt.count({
        where: {
          assessment: { ...orgFilter, ...teacherFilter },
          status: { in: ['SUBMITTED', 'GRADED', 'AUTO_SUBMITTED'] },
        },
      }),
      // Questions
      this.prisma.question.count({
        where: { ...orgFilter, ...teacherFilter },
      }),
      // Courses
      this.prisma.course.count({
        where: { ...orgFilter, ...(isTeacher ? { teacherId: user.id } : {}) },
      }),
    ])

    // Average score across completed attempts
    const avgResult = await this.prisma.attempt.aggregate({
      where: {
        assessment: { ...orgFilter, ...teacherFilter },
        status: { in: ['SUBMITTED', 'GRADED', 'AUTO_SUBMITTED'] },
        percentageScore: { not: null },
      },
      _avg: { percentageScore: true },
    })

    const avgScore = avgResult._avg.percentageScore

    // Pass rate (score >= 70)
    const passCount = await this.prisma.attempt.count({
      where: {
        assessment: { ...orgFilter, ...teacherFilter },
        status: { in: ['SUBMITTED', 'GRADED', 'AUTO_SUBMITTED'] },
        percentageScore: { gte: 70 },
      },
    })

    return {
      totalStudents,
      totalAssessments,
      totalAttempts,
      completedAttempts,
      totalQuestions,
      totalCourses,
      avgScore: avgScore != null ? Math.round(avgScore) : null,
      passRate:
        completedAttempts > 0 ? Math.round((passCount / completedAttempts) * 100) : null,
    }
  }

  // ── Score distribution (bucketed into 10% bands) ──────────────────────────

  async getScoreDistribution(user: AuthUser) {
    const orgFilter = { organizationId: user.organizationId! }
    const teacherFilter = user.role === UserRole.TEACHER ? { createdById: user.id } : {}

    const attempts = await this.prisma.attempt.findMany({
      where: {
        assessment: { ...orgFilter, ...teacherFilter },
        status: { in: ['SUBMITTED', 'GRADED', 'AUTO_SUBMITTED'] },
        percentageScore: { not: null },
      },
      select: { percentageScore: true },
    })

    // 10 buckets: 0–9, 10–19, …, 90–100
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      label: i < 9 ? `${i * 10}–${i * 10 + 9}` : '90–100',
      min: i * 10,
      max: i < 9 ? i * 10 + 9 : 100,
      count: 0,
    }))

    for (const a of attempts) {
      const pct = a.percentageScore!
      const idx = Math.min(Math.floor(pct / 10), 9)
      buckets[idx]!.count++
    }

    return buckets
  }

  // ── Assessment leaderboard (best to worst avg score) ─────────────────────

  async getAssessmentLeaderboard(user: AuthUser) {
    const orgFilter = { organizationId: user.organizationId! }
    const teacherFilter = user.role === UserRole.TEACHER ? { createdById: user.id } : {}

    const assessments = await this.prisma.assessment.findMany({
      where: { ...orgFilter, ...teacherFilter },
      include: {
        course: { select: { title: true } },
        _count: { select: { attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // For each assessment, compute avg score of completed attempts
    const rows = await Promise.all(
      assessments.map(async a => {
        const agg = await this.prisma.attempt.aggregate({
          where: {
            assessmentId: a.id,
            status: { in: ['SUBMITTED', 'GRADED', 'AUTO_SUBMITTED'] },
            percentageScore: { not: null },
          },
          _avg: { percentageScore: true },
          _count: { _all: true },
        })
        return {
          id: a.id,
          title: a.title,
          course: a.course.title,
          status: a.status,
          attemptCount: agg._count._all,
          avgScore:
            agg._avg.percentageScore != null
              ? Math.round(agg._avg.percentageScore)
              : null,
        }
      }),
    )

    return rows.sort((a, b) => {
      if (a.avgScore == null && b.avgScore == null) return 0
      if (a.avgScore == null) return 1
      if (b.avgScore == null) return -1
      return b.avgScore - a.avgScore
    })
  }

  // ── Recent activity feed ──────────────────────────────────────────────────

  async getRecentActivity(user: AuthUser, limit = 10) {
    const orgFilter = { organizationId: user.organizationId! }
    const teacherFilter = user.role === UserRole.TEACHER ? { createdById: user.id } : {}

    const attempts = await this.prisma.attempt.findMany({
      where: {
        assessment: { ...orgFilter, ...teacherFilter },
        status: { in: ['SUBMITTED', 'GRADED', 'AUTO_SUBMITTED'] },
      },
      include: {
        student: { select: { id: true, name: true } },
        assessment: { select: { id: true, title: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: limit,
    })

    return attempts.map(a => ({
      id: a.id,
      studentName: a.student.name,
      assessmentTitle: a.assessment.title,
      assessmentId: a.assessment.id,
      percentageScore: a.percentageScore,
      submittedAt: a.submittedAt,
    }))
  }

  // ── Per-course breakdown ─────────────────────────────────────────────────

  async getCourseBreakdown(user: AuthUser) {
    const orgFilter = { organizationId: user.organizationId! }
    const teacherFilter = user.role === UserRole.TEACHER ? { teacherId: user.id } : {}

    const courses = await this.prisma.course.findMany({
      where: { ...orgFilter, ...teacherFilter },
      include: {
        _count: { select: { assessments: true } },
      },
    })

    const rows = await Promise.all(
      courses.map(async c => {
        const agg = await this.prisma.attempt.aggregate({
          where: {
            assessment: { courseId: c.id },
            status: { in: ['SUBMITTED', 'GRADED', 'AUTO_SUBMITTED'] },
            percentageScore: { not: null },
          },
          _avg: { percentageScore: true },
          _count: { _all: true },
        })
        return {
          id: c.id,
          title: c.title,
          subject: c.subject,
          assessmentCount: c._count.assessments,
          attemptCount: agg._count._all,
          avgScore:
            agg._avg.percentageScore != null
              ? Math.round(agg._avg.percentageScore)
              : null,
        }
      }),
    )

    return rows.sort((a, b) => b.attemptCount - a.attemptCount)
  }
}
