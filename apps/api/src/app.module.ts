import { ExamCalendarModule } from './modules/exam-calendar/exam-calendar.module'
import { ExamPreparationModule } from './modules/exam-preparation/exam-preparation.module'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { AuthModule } from './modules/auth/auth.module'
import { THROTTLERS } from './modules/auth/throttle'
import { UsersModule } from './modules/users/users.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { CoursesModule } from './modules/courses/courses.module'
import { TopicsModule } from './modules/topics/topics.module'
import { QuestionsModule } from './modules/questions/questions.module'
import { AssessmentsModule } from './modules/assessments/assessments.module'
import { AttemptsModule } from './modules/attempts/attempts.module'
import { DocumentsModule } from './modules/documents/documents.module'
import { AiModule } from './modules/ai/ai.module'
import { AnalyticsModule } from './modules/analytics/analytics.module'
import { StudyModule } from './modules/study/study.module'
import { LearningModule } from './modules/learning/learning.module'
import { GpaModule } from './modules/gpa/gpa.module'
import { AdminModule } from './modules/admin/admin.module'
import { PrismaModule } from './modules/prisma/prisma.module'
import { EmailModule } from './modules/email/email.module'
import { OperationsModule } from './modules/operations/operations.module'
import { RuntimeSettingsModule } from './modules/operations/runtime-settings.module'

@Module({
  imports: [
    // ─── Config ─────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // ─── Rate limiting ───────────────────────────────────────────────────────
    // Applied globally by AppThrottlerGuard (see auth.module): per account when
    // signed in, per client address otherwise.
    ThrottlerModule.forRoot({ throttlers: THROTTLERS }),

    // ─── Core infrastructure ─────────────────────────────────────────────────
    PrismaModule,
    EmailModule,
    RuntimeSettingsModule,
    OperationsModule,

    // ─── Feature modules ─────────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    ExamPreparationModule,
    ExamCalendarModule,
    OrganizationsModule,
    CoursesModule,
    TopicsModule,
    QuestionsModule,
    AssessmentsModule,
    AttemptsModule,
    DocumentsModule,
    AiModule,
    AnalyticsModule,
    StudyModule,
    LearningModule,
    GpaModule,
    AdminModule,
  ],
})
export class AppModule {}
