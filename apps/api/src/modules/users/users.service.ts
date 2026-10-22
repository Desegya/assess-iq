import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { AuthUser, UserRole } from '@assessiq/types'
import { CreateStudentDto } from './dto/create-student.dto'
import { BulkCreateStudentsDto } from './dto/bulk-create-students.dto'
import { UpdateProfileDto } from './dto/update-profile.dto'

const PROFILE_SELECT = {
  studyPathway: true,
  secondaryStage: true,
  name: true,
  country: true,
  institutionType: true,
  programme: true,
  currentLevel: true,
  currentSemester: true,
  institution: true,
  faculty: true,
  academicSession: true,
  graduationYear: true,
  profileCompletedAt: true,
} as const

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Create student account ───────────────────────────────────────────────

  async createStudent(dto: CreateStudentDto, user: AuthUser) {
    if (!user.organizationId) {
      throw new ForbiddenException('You must belong to an organisation')
    }
    if (user.role === UserRole.STUDENT) {
      throw new ForbiddenException('Students cannot create accounts')
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException('An account with this email already exists')

    const passwordHash = await bcrypt.hash(dto.password, 12)

    const student = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: 'STUDENT',
        status: 'ACTIVE',
        organizationId: user.organizationId,
      },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    })

    return student
  }

  // ─── Bulk create students ─────────────────────────────────────────────────

  async bulkCreateStudents(dto: BulkCreateStudentsDto, user: AuthUser) {
    if (!user.organizationId) throw new ForbiddenException('No organisation')
    if (user.role === UserRole.STUDENT) throw new ForbiddenException()

    const DEFAULT_PASSWORD = 'Student123!'
    const results: { name: string; email: string; status: 'created' | 'skipped'; reason?: string }[] = []

    for (const row of dto.students) {
      const existing = await this.prisma.user.findUnique({ where: { email: row.email } })
      if (existing) {
        results.push({ name: row.name, email: row.email, status: 'skipped', reason: 'Email already exists' })
        continue
      }
      const passwordHash = await bcrypt.hash(row.password ?? DEFAULT_PASSWORD, 12)
      await this.prisma.user.create({
        data: {
          name: row.name,
          email: row.email,
          passwordHash,
          role: 'STUDENT',
          status: 'ACTIVE',
          organizationId: user.organizationId,
        },
      })
      results.push({ name: row.name, email: row.email, status: 'created' })
    }

    return {
      total: dto.students.length,
      created: results.filter(r => r.status === 'created').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      results,
    }
  }

  // ─── Get org join code ────────────────────────────────────────────────────

  async getOrgJoinCode(user: AuthUser) {
    if (!user.organizationId) throw new ForbiddenException('No organisation')
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
      select: { joinCode: true, name: true },
    })
    return org
  }

  // ─── List students in org ─────────────────────────────────────────────────

  async findStudents(user: AuthUser) {
    if (!user.organizationId) return []

    return this.prisma.user.findMany({
      where: { organizationId: user.organizationId, role: 'STUDENT' },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, email: true,
        status: true, lastLoginAt: true, createdAt: true,
      },
    })
  }

  // ─── Get a single user ────────────────────────────────────────────────────

  async getProfile(user: AuthUser) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: PROFILE_SELECT })
  }

  async updateProfile(dto: UpdateProfileDto, user: AuthUser) {
    if (dto.studyPathway === 'EXAM_PREPARATION' && (user.organizationId || user.role !== UserRole.STUDENT)) {
      throw new ForbiddenException('Exam preparation requires a standalone Nightklass learner account')
    }
    const existing = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { profileCompletedAt: true, institutionType: true },
    })
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        studyPathway: dto.studyPathway ?? 'TERTIARY',
        ...(dto.studyPathway === 'EXAM_PREPARATION' ? { secondaryStage: dto.secondaryStage } : {}),
        country: dto.country,
        institutionType: dto.studyPathway === 'EXAM_PREPARATION' ? existing.institutionType ?? dto.institutionType : dto.institutionType,
        ...(dto.studyPathway === 'EXAM_PREPARATION' ? {} : {
          programme: dto.programme,
          currentLevel: dto.currentLevel,
          currentSemester: dto.currentSemester,
        }),
        ...(dto.studyPathway === 'EXAM_PREPARATION' ? {} : {
          institution: dto.institution || null,
          faculty: dto.faculty || null,
          academicSession: dto.academicSession || null,
          graduationYear: dto.graduationYear ?? null,
        }),
        profileCompletedAt: existing.profileCompletedAt ?? new Date(),
      },
      select: PROFILE_SELECT,
    })
  }

  async findOne(id: string, user: AuthUser) {
    const found = await this.prisma.user.findFirst({
      where: user.organizationId ? { id, organizationId: user.organizationId } : { id: user.id === id ? id : "__not_accessible__", organizationId: null },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    })
    if (!found) throw new NotFoundException('User not found')
    return found
  }

  // ─── Deactivate ───────────────────────────────────────────────────────────

  async deactivate(id: string, user: AuthUser) {
    await this.findOne(id, user)
    if (user.role === UserRole.STUDENT) throw new ForbiddenException()

    return this.prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
      select: { id: true, status: true },
    })
  }
}
