import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { randomInt } from 'node:crypto'
import { AuthUser, UserRole } from '@assessiq/types'
import { PrismaService } from '../prisma/prisma.service'
import { orgScope } from '../../common/org-scope'
import { ClassEmailsDto, EnrollmentDecisionDto, UpdateClassAccessDto } from './dto/class-access.dto'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

/** Personal mailboxes: a lecturer's own address here says nothing about their school. */
export const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'outlook.com', 'hotmail.com',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'mail.com', 'gmx.com',
])

const DOMAIN_PATTERN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

export function normaliseDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^.*@/, '').replace(/^\*\./, '').replace(/\.$/, '')
}

/** student@st.ug.edu.gh matches ug.edu.gh: departments often use subdomains. */
export function emailMatchesDomain(email: string, domains: string[]): boolean {
  const domain = email.trim().toLowerCase().split('@').pop() ?? ''
  return domains.some(d => domain === d || domain.endsWith(`.${d}`))
}

export function suggestedDomain(email: string): string | null {
  const domain = normaliseDomain(email)
  return FREE_MAIL_DOMAINS.has(domain) ? null : domain
}

/** Why a student could not join; the frontend uses `code` to show the right next step. */
type JoinRefusal = 'CLOSED' | 'REMOVED' | 'DOMAIN_MISMATCH' | 'NOT_ON_LIST' | 'EMAIL_NOT_VERIFIED' | 'NOT_A_STUDENT'
const refuse = (code: JoinRefusal, message: string) => new ForbiddenException({ statusCode: 403, code, message })

const ACCESS_SELECT = {
  id: true,
  title: true,
  courseCode: true,
  joinCode: true,
  joinPolicy: true,
  allowedEmailDomains: true,
  allowedEmails: true,
  joiningOpen: true,
} as const

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Lecturer: access settings ────────────────────────────────────────────

  async getAccess(courseId: string, user: AuthUser) {
    const course = await this.staffCourse(courseId, user)
    const joinCode = course.joinCode ?? (await this.assignCode(course.id))
    const counts = await this.prisma.courseEnrollment.groupBy({
      by: ['status'],
      where: { courseId },
      _count: { _all: true },
    })
    const count = (status: string) => counts.find(c => c.status === status)?._count._all ?? 0
    return {
      ...course,
      joinCode,
      suggestedDomain: suggestedDomain(user.email),
      students: { active: count('ACTIVE'), pending: count('PENDING'), removed: count('REMOVED') },
    }
  }

  async updateAccess(courseId: string, dto: UpdateClassAccessDto, user: AuthUser) {
    const course = await this.staffCourse(courseId, user)

    let domains: string[] | undefined
    if (dto.allowedEmailDomains) {
      domains = [...new Set(dto.allowedEmailDomains.map(normaliseDomain).filter(Boolean))]
      const bad = domains.find(d => !DOMAIN_PATTERN.test(d))
      if (bad) throw new BadRequestException(`"${bad}" is not an email domain. Use something like ug.edu.gh`)
    }
    const policy = dto.joinPolicy ?? course.joinPolicy
    if (policy === 'EMAIL_DOMAIN' && (domains ?? course.allowedEmailDomains).length === 0) {
      throw new BadRequestException('Add at least one school email domain, for example ug.edu.gh')
    }

    await this.prisma.course.update({
      where: { id: course.id },
      data: {
        ...(dto.joinPolicy && { joinPolicy: dto.joinPolicy }),
        ...(domains && { allowedEmailDomains: domains }),
        ...(dto.joiningOpen !== undefined && { joiningOpen: dto.joiningOpen }),
      },
    })
    return this.getAccess(courseId, user)
  }

  /** A new code invalidates the old link; students already in the class stay in. */
  async resetCode(courseId: string, user: AuthUser) {
    const course = await this.staffCourse(courseId, user)
    await this.assignCode(course.id)
    return this.getAccess(courseId, user)
  }

  // ─── Lecturer: the email list ─────────────────────────────────────────────

  async addEmails(courseId: string, dto: ClassEmailsDto, user: AuthUser) {
    const course = await this.staffCourse(courseId, user)
    const incoming = dto.emails.map(e => e.trim().toLowerCase())
    const emails = [...new Set([...course.allowedEmails, ...incoming])]
    if (emails.length > 2000) throw new BadRequestException('A class list can hold up to 2,000 emails')

    await this.prisma.$transaction([
      this.prisma.course.update({ where: { id: course.id }, data: { allowedEmails: emails } }),
      // Listing someone is the lecturer's approval: let in anyone already waiting with that email
      this.prisma.courseEnrollment.updateMany({
        where: {
          courseId: course.id,
          status: 'PENDING',
          student: { email: { in: incoming, mode: 'insensitive' }, emailVerifiedAt: { not: null } },
        },
        data: { status: 'ACTIVE' },
      }),
    ])
    return this.getAccess(courseId, user)
  }

  async removeEmail(courseId: string, email: string, user: AuthUser) {
    const course = await this.staffCourse(courseId, user)
    const target = email.trim().toLowerCase()
    await this.prisma.course.update({
      where: { id: course.id },
      data: { allowedEmails: course.allowedEmails.filter(e => e !== target) },
    })
    return this.getAccess(courseId, user)
  }

  // ─── Lecturer: who is in the class ────────────────────────────────────────

  async roster(courseId: string, user: AuthUser) {
    await this.staffCourse(courseId, user)
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { courseId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        student: { select: { id: true, name: true, email: true, emailVerifiedAt: true } },
      },
    })
    return enrollments.map(({ student, ...e }) => ({
      ...e,
      student: { id: student.id, name: student.name, email: student.email, emailVerified: !!student.emailVerifiedAt },
    }))
  }

  async decide(courseId: string, enrollmentId: string, dto: EnrollmentDecisionDto, user: AuthUser) {
    await this.staffCourse(courseId, user)
    const updated = await this.prisma.courseEnrollment.updateMany({
      where: { id: enrollmentId, courseId },
      data: { status: dto.status },
    })
    if (!updated.count) throw new NotFoundException('Student not found in this class')
    return this.roster(courseId, user)
  }

  // ─── Students ─────────────────────────────────────────────────────────────

  /** What a join link shows before signing in. Never reveals the email list. */
  async preview(code: string) {
    const course = await this.courseByCode(code)
    return {
      title: course.title,
      courseCode: course.courseCode,
      lecturer: course.organization?.name ?? null,
      joinPolicy: course.joinPolicy,
      allowedEmailDomains: course.joinPolicy === 'EMAIL_DOMAIN' ? course.allowedEmailDomains : [],
      joiningOpen: course.joiningOpen,
    }
  }

  async join(code: string, user: AuthUser) {
    if (user.role !== UserRole.STUDENT) {
      throw refuse('NOT_A_STUDENT', 'Sign in with a student account to join a class.')
    }
    const course = await this.courseByCode(code)
    const existing = await this.prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: course.id, studentId: user.id } },
    })
    if (existing?.status === 'ACTIVE') return this.joined(course, 'ACTIVE')
    if (existing?.status === 'REMOVED') {
      throw refuse('REMOVED', 'Your lecturer removed you from this class. Ask them to add you back.')
    }
    if (!course.joiningOpen) throw refuse('CLOSED', 'This class is not accepting new students.')

    const student = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { email: true, emailVerifiedAt: true },
    })
    const email = student.email.toLowerCase()
    const verified = !!student.emailVerifiedAt
    const notVerified = () =>
      refuse('EMAIL_NOT_VERIFIED', `Confirm your email (${student.email}) first. We sent you a link when you signed up.`)

    let status: 'ACTIVE' | 'PENDING'
    switch (course.joinPolicy) {
      case 'OPEN_LINK':
        status = 'ACTIVE'
        break
      case 'APPROVAL':
        // The lecturer decides by the email they see, so it must really be the student's
        if (!verified) throw notVerified()
        status = 'PENDING'
        break
      case 'EMAIL_LIST':
        if (!course.allowedEmails.includes(email)) {
          throw refuse('NOT_ON_LIST', `${student.email} is not on this class list. Ask your lecturer to add it.`)
        }
        if (!verified) throw notVerified()
        status = 'ACTIVE'
        break
      case 'EMAIL_DOMAIN':
      default:
        if (!emailMatchesDomain(email, course.allowedEmailDomains)) {
          const domains = course.allowedEmailDomains.map(d => `@${d}`).join(' or ')
          throw refuse('DOMAIN_MISMATCH', `This class only accepts school emails ending in ${domains}. Sign in with your school email.`)
        }
        if (!verified) throw notVerified()
        status = 'ACTIVE'
    }

    await this.prisma.courseEnrollment.upsert({
      where: { courseId_studentId: { courseId: course.id, studentId: user.id } },
      create: { courseId: course.id, studentId: user.id, status },
      update: { status },
    })
    return this.joined(course, status)
  }

  async myClasses(user: AuthUser) {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { studentId: user.id, status: { in: ['ACTIVE', 'PENDING'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        course: {
          select: {
            id: true,
            title: true,
            courseCode: true,
            organization: { select: { name: true } },
            _count: { select: { assessments: { where: { status: { in: ['PUBLISHED', 'ACTIVE'] } } } } },
          },
        },
      },
    })
    return enrollments.map(({ course, ...e }) => ({
      ...e,
      course: {
        id: course.id,
        title: course.title,
        courseCode: course.courseCode,
        lecturer: course.organization?.name ?? null,
        openAssessments: course._count.assessments,
      },
    }))
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async staffCourse(courseId: string, user: AuthUser) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, ...orgScope(user, 'Class not found'), NOT: { organizationId: null } },
      select: ACCESS_SELECT,
    })
    if (!course) throw new NotFoundException('Class not found')
    return course
  }

  private async courseByCode(code: string) {
    const joinCode = code.trim().toUpperCase()
    const course = await this.prisma.course.findFirst({
      where: { joinCode, isActive: true, NOT: { organizationId: null } },
      select: { ...ACCESS_SELECT, organization: { select: { name: true } } },
    })
    if (!course) throw new NotFoundException('This class link is not valid. Ask your lecturer for a new one.')
    return course
  }

  private joined(course: { id: string; title: string }, status: 'ACTIVE' | 'PENDING') {
    return {
      status,
      course: { id: course.id, title: course.title },
      message:
        status === 'ACTIVE'
          ? `You have joined ${course.title}.`
          : `Your request to join ${course.title} has been sent. Your lecturer will let you in.`,
    }
  }

  private async assignCode(courseId: string): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const pick = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
      const code = `${pick()}-${pick()}`
      const taken = await this.prisma.course.count({ where: { joinCode: code } })
      if (taken) continue
      await this.prisma.course.update({ where: { id: courseId }, data: { joinCode: code } })
      return code
    }
    throw new Error('Could not generate a unique class code')
  }
}
