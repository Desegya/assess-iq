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

  async findOne(id: string, user: AuthUser) {
    const found = await this.prisma.user.findFirst({
      where: { id, organizationId: user.organizationId ?? undefined },
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
