import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuthUser, UserRole } from '@assessiq/types'
import { StartAttemptDto } from './dto/start-attempt.dto'
import { SubmitAnswerDto } from './dto/submit-answer.dto'

@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Start an attempt ──────────────────────────────────────────────────────

  async start(dto: StartAttemptDto, user: AuthUser) {
    // Fetch the assessment
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        id: dto.assessmentId,
        organizationId: user.organizationId ?? undefined,
        status: { in: ['PUBLISHED', 'ACTIVE'] },
      },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            question: {
              select: {
                id: true,
                questionText: true,
                questionType: true,
                options: true,
                difficulty: true,
                // Do NOT include correctAnswer — hidden from student
              },
            },
          },
        },
      },
    })

    if (!assessment) {
      throw new NotFoundException('Assessment not found or not published')
    }

    if (assessment.totalQuestions === 0) {
      throw new BadRequestException('This assessment has no questions yet')
    }

    // Check for existing in-progress attempt
    const existing = await this.prisma.attempt.findFirst({
      where: {
        assessmentId: dto.assessmentId,
        studentId: user.id,
        status: 'IN_PROGRESS',
      },
    })

    if (existing) {
      // Return the existing attempt so the student can resume
      return this.findOne(existing.id, user)
    }

    // Check maxAttempts from settings
    const settings = assessment.settings as { maxAttempts?: number }
    const maxAttempts = settings?.maxAttempts ?? 1

    const previousAttempts = await this.prisma.attempt.count({
      where: {
        assessmentId: dto.assessmentId,
        studentId: user.id,
        status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'GRADED'] },
      },
    })

    if (previousAttempts >= maxAttempts) {
      throw new ConflictException(
        `You have already used all ${maxAttempts} attempt(s) for this assessment`,
      )
    }

    // Create a fresh attempt
    const attempt = await this.prisma.attempt.create({
      data: {
        assessmentId: dto.assessmentId,
        studentId: user.id,
        status: 'IN_PROGRESS',
      },
    })

    return {
      ...attempt,
      assessment: {
        id: assessment.id,
        title: assessment.title,
        instructions: assessment.instructions,
        durationMinutes: assessment.durationMinutes,
        totalQuestions: assessment.totalQuestions,
        questions: assessment.questions.map(aq => ({
          id: aq.id,
          order: aq.order,
          scoreWeight: aq.scoreWeight,
          question: aq.question,
        })),
      },
    }
  }

  // ─── Save / update a single answer ────────────────────────────────────────

  async saveAnswer(attemptId: string, dto: SubmitAnswerDto, user: AuthUser) {
    const attempt = await this.assertAttemptOwner(attemptId, user)

    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('This attempt has already been submitted')
    }

    // Upsert the answer
    return this.prisma.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: dto.questionId } },
      create: {
        attemptId,
        questionId: dto.questionId,
        selectedAnswer: dto.selectedAnswer ?? null,
        textAnswer: dto.textAnswer ?? null,
        timeTakenSeconds: dto.timeTakenSeconds ?? null,
      },
      update: {
        selectedAnswer: dto.selectedAnswer ?? null,
        textAnswer: dto.textAnswer ?? null,
        timeTakenSeconds: dto.timeTakenSeconds ?? null,
      },
    })
  }

  // ─── Submit attempt (grade + finalize) ────────────────────────────────────

  async submit(attemptId: string, user: AuthUser) {
    const attempt = await this.assertAttemptOwner(attemptId, user)

    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Attempt already submitted')
    }

    // Load all assessment questions with their correct answers
    const assessmentQuestions = await this.prisma.assessmentQuestion.findMany({
      where: { assessmentId: attempt.assessmentId },
      include: {
        question: {
          select: { id: true, correctAnswer: true, questionType: true },
        },
      },
    })

    // Load submitted answers
    const answers = await this.prisma.answer.findMany({
      where: { attemptId },
    })

    const answerMap = new Map(answers.map(a => [a.questionId, a]))

    // Grade: MCQ and TRUE_FALSE are auto-graded; SHORT_ANSWER/THEORY left for teacher
    let correctCount = 0
    const gradedAnswers: {
      id: string
      isCorrect: boolean | null
      score: number | null
    }[] = []

    for (const aq of assessmentQuestions) {
      const answer = answerMap.get(aq.questionId)
      if (!answer) continue

      const type = aq.question.questionType
      if (type === 'MCQ' || type === 'TRUE_FALSE') {
        const isCorrect =
          answer.selectedAnswer?.trim().toUpperCase() ===
          aq.question.correctAnswer.trim().toUpperCase()
        const score = isCorrect ? aq.scoreWeight : 0
        if (isCorrect) correctCount++
        gradedAnswers.push({ id: answer.id, isCorrect, score })
      }
    }

    // Update answer records with grades (batch)
    await Promise.all(
      gradedAnswers.map(ga =>
        this.prisma.answer.update({
          where: { id: ga.id },
          data: { isCorrect: ga.isCorrect, score: ga.score },
        }),
      ),
    )

    // Calculate scores
    const totalQuestions = assessmentQuestions.length
    const percentageScore =
      totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0

    // Update attempt
    const updated = await this.prisma.attempt.update({
      where: { id: attemptId },
      data: {
        status: 'GRADED',
        submittedAt: new Date(),
        score: correctCount,
        percentageScore,
      },
    })

    return updated
  }

  // ─── My attempts (student) ────────────────────────────────────────────────

  async findMyAttempts(user: AuthUser) {
    return this.prisma.attempt.findMany({
      where: { studentId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            durationMinutes: true,
            totalQuestions: true,
            course: { select: { id: true, title: true } },
          },
        },
        _count: { select: { answers: true } },
      },
    })
  }

  // ─── Single attempt (with answers) ───────────────────────────────────────

  async findOne(attemptId: string, user: AuthUser) {
    const attempt = await this.prisma.attempt.findFirst({
      where: {
        id: attemptId,
        // Students can only see their own; teachers/admins can see all in org
        ...(user.role === UserRole.STUDENT ? { studentId: user.id } : {}),
      },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            instructions: true,
            durationMinutes: true,
            totalQuestions: true,
            settings: true,
            course: { select: { id: true, title: true } },
            questions: {
              orderBy: { order: 'asc' },
              include: {
                question: {
                  select: {
                    id: true,
                    questionText: true,
                    questionType: true,
                    options: true,
                    difficulty: true,
                    correctAnswer: true,
                    explanation: true,
                  },
                },
              },
            },
          },
        },
        answers: {
          select: {
            id: true,
            questionId: true,
            selectedAnswer: true,
            textAnswer: true,
            isCorrect: true,
            score: true,
            timeTakenSeconds: true,
          },
        },
      },
    })

    if (!attempt) throw new NotFoundException('Attempt not found')

    // Hide correct answers if student is viewing an in-progress attempt
    if (user.role === UserRole.STUDENT && attempt.status === 'IN_PROGRESS') {
      const sanitized = {
        ...attempt,
        assessment: {
          ...attempt.assessment,
          questions: attempt.assessment.questions.map(aq => ({
            ...aq,
            question: {
              ...aq.question,
              correctAnswer: undefined,
              explanation: undefined,
            },
          })),
        },
      }
      return sanitized
    }

    return attempt
  }

  // ─── Teacher: list attempts for an assessment ─────────────────────────────

  async findByAssessment(assessmentId: string, user: AuthUser) {
    if (user.role === UserRole.STUDENT) throw new ForbiddenException()

    return this.prisma.attempt.findMany({
      where: { assessmentId },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { id: true, name: true, email: true } },
        _count: { select: { answers: true } },
      },
    })
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async assertAttemptOwner(attemptId: string, user: AuthUser) {
    const attempt = await this.prisma.attempt.findFirst({
      where: { id: attemptId, studentId: user.id },
    })
    if (!attempt) throw new NotFoundException('Attempt not found')
    return attempt
  }
}
