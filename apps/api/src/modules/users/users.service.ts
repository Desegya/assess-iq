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
