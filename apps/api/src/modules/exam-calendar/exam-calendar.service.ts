import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@assessiq/db'
import { AuthUser, UserRole } from '@assessiq/types'
import { randomUUID } from 'crypto'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import pdfParse from 'pdf-parse'
import { AiService } from '../ai/ai.service'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
import { DocumentFileValidator } from '../documents/document-file.validator'
import { CalendarStateDto, ExamCalendarDto, TimetableEntryDto } from './exam-calendar.dto'
import { daysUntil, lagosDay, parseTimetableCsv, validateCalendar } from './exam-calendar.rules'
import { subjectIdentity } from '../exam-preparation/exam-content.rules'
@Injectable()
export class ExamCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ai: AiService,
  ) {}
  list() {
    return this.prisma.examCalendar.findMany({
      orderBy: [{ year: 'desc' }, { exam: 'asc' }, { series: 'asc' }, { version: 'desc' }],
      take: 100,
    })
  }
  private async mutate<T>(
    actorId: string,
    action: string,
    fn: (tx: Prisma.TransactionClient) => Promise<{ id: string; result: T }>,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const grant = await tx.nightklassAdmin.findUnique({
            where: { userId: actorId },
            include: { user: { select: { status: true, organizationId: true } } },
          })
          if (!grant || grant.user.status !== 'ACTIVE' || grant.user.organizationId)
            throw new ForbiddenException('Administrator access required')
          const { id, result } = await fn(tx)
          await tx.nightklassAdminAudit.create({
            data: { actorId, action, resourceType: 'exam-calendar', resourceId: id },
          })
          return result
        },
        { isolationLevel: 'Serializable' },
      )
    } catch (err) {
      if (['P2002', 'P2034'].includes((err as { code?: string })?.code ?? ''))
        throw new ConflictException(
          'Duplicate version or concurrent timetable change. Refresh and try again.',
        )
      throw err
    }
  }
  save(dto: ExamCalendarDto, actorId: string) {
    validateCalendar(dto)
    return this.mutate(actorId, 'exam.calendar.save', async (tx) => {
      const { id, expectedRevision, ...fields } = dto
      const data = { ...fields, entries: fields.entries as unknown as Prisma.InputJsonValue }
      let result
      if (!id && expectedRevision === 0) result = await tx.examCalendar.create({ data })
      else {
        if (!id) throw new BadRequestException('Select a calendar draft')
        const original = await tx.examCalendar.findUnique({ where: { id } })
        if (!original) throw new NotFoundException('Calendar not found')
        if (
          original.exam !== dto.exam ||
          original.year !== dto.year ||
          original.series !== dto.series ||
          original.version !== dto.version
        )
          throw new BadRequestException('Create a new calendar version to change its scope')
        const updated = await tx.examCalendar.updateMany({
          where: { id, status: 'DRAFT', revision: expectedRevision },
          data: { ...data, endDate: dto.endDate ?? null, revision: { increment: 1 } },
        })
        if (!updated.count)
          throw new ConflictException(
            'Only the current draft can be edited. Create a new version to change a published timetable.',
          )
        result = await tx.examCalendar.findUniqueOrThrow({ where: { id } })
      }
      return { id: result.id, result }
    })
  }
  async upload(id: string, expectedRevision: number, file: Express.Multer.File, actorId: string) {
    const isCsv =
      file?.mimetype === 'text/csv' ||
      file?.mimetype === 'application/csv' ||
      file?.originalname.toLowerCase().endsWith('.csv')
    if (!file || file.size > 5 * 1024 * 1024 || (!isCsv && file.mimetype !== 'application/pdf'))
      throw new BadRequestException('Upload a PDF or CSV timetable up to 5 MB')
    const candidate = isCsv ? { ...file, mimetype: 'text/plain' } : file
    if (!(await new DocumentFileValidator().isValid(candidate)))
      throw new BadRequestException(
        'The timetable file is unreadable or does not match its file type',
      )
    const target = await this.prisma.examCalendar.findUnique({ where: { id } })
    if (!target) throw new NotFoundException('Calendar not found')
    if (target.exam !== 'WAEC' || target.status !== 'DRAFT' || target.revision !== expectedRevision)
      throw new ConflictException('Upload to the current WAEC draft, then review before publishing')
    let extractionWarning = ''
    let extractedText = ''
    let imported: TimetableEntryDto[] | undefined
    if (isCsv) {
      extractedText = file.buffer.toString('utf8')
      imported = parseTimetableCsv(extractedText)
      for (const row of imported)
        if ((await validate(plainToInstance(TimetableEntryDto, row))).length)
          throw new BadRequestException(
            'CSV rows must use ISO dates (YYYY-MM-DD), 24-hour HH:mm times and bounded text fields',
          )
    } else {
      try {
        // Older PDF.js expects independent Uint8Array slices rather than pooled Buffer views.
        extractedText = (
          await pdfParse(new Uint8Array(file.buffer) as unknown as Buffer)
        ).text.trim()
      } catch {
        extractedText = ''
      }
    }
    if (!isCsv) {
      try {
        if (!extractedText || extractedText.length > 100000)
          throw new BadRequestException(
            'PDF has no readable text or exceeds the extraction text limit',
          )
        const extracted = await this.ai.extractExamTimetable(extractedText, target.year, {
          userId: actorId,
          relatedEntityId: id,
        })
        if (!extracted.entries.length || extracted.entries.length > 500)
          throw new Error('No complete paper rows were extracted')
        const rows = extracted.entries.map((row) => ({
          ...row,
          startTime: row.startTime || undefined,
          endTime: row.endTime || undefined,
          notes: row.notes || undefined,
        }))
        for (const row of rows) {
          if (
            (
              await validate(plainToInstance(TimetableEntryDto, row), {
                whitelist: true,
                forbidNonWhitelisted: true,
              })
            ).length
          )
            throw new Error(
              'Extracted rows contain incomplete or invalid fields; enter or correct the paper rows manually',
            )
          if (Number(row.date.slice(0, 4)) !== target.year)
            throw new Error('Extracted dates do not match the calendar year')
        }
        const dates = rows.map((row) => row.date).sort()
        validateCalendar({
          ...target,
          exam: target.exam as ExamCalendarDto['exam'],
          startDate: dates[0]!,
          endDate: dates[dates.length - 1]!,
          entries: rows,
        })
        imported = rows
        extractionWarning = extracted.warnings
          .filter((w) => typeof w === 'string')
          .join(' ')
          .slice(0, 4000)
      } catch (err) {
        imported = []
        extractionWarning = `Automatic extraction could not produce a complete valid timetable. Original PDF saved; review and enter dates manually or upload a CSV. ${err instanceof BadRequestException ? err.message : 'Check the source for missing fields and try again.'}`
      }
    }
    const key = `exam-timetables/${randomUUID()}.${isCsv ? 'csv' : 'pdf'}`
    await this.storage.uploadBuffer(key, file.buffer, isCsv ? 'text/csv' : 'application/pdf')
    let previousKey: string | null = null
    try {
      const result = await this.mutate(actorId, 'exam.calendar.upload', async (tx) => {
        const calendar = await tx.examCalendar.findUnique({ where: { id } })
        if (!calendar) throw new NotFoundException('Calendar not found')
        if (calendar.exam !== 'WAEC')
          throw new BadRequestException('Timetable uploads are for WAEC calendars')
        if (calendar.status !== 'DRAFT' || calendar.revision !== expectedRevision)
          throw new ConflictException('Upload to the current draft, then review before publishing')
        const pdfWindow =
          !isCsv && imported?.length
            ? {
                startDate: imported.map((r) => r.date).sort()[0]!,
                endDate: imported
                  .map((r) => r.date)
                  .sort()
                  .at(-1)!,
              }
            : {}
        if (imported)
          validateCalendar({
            ...calendar,
            exam: calendar.exam as ExamCalendarDto['exam'],
            endDate: calendar.endDate ?? undefined,
            entries: imported,
            ...pdfWindow,
          })
        previousKey = calendar.fileKey
        const updated = await tx.examCalendar.update({
          where: { id },
          data: {
            ...pdfWindow,
            fileKey: key,
            fileName: file.originalname.slice(0, 200),
            extractedText: (extractionWarning
              ? `EXTRACTION REVIEW NOTE: ${extractionWarning}\n\n${extractedText}`
              : extractedText
            ).slice(0, 100000),
            ...(imported ? { entries: imported as unknown as Prisma.InputJsonValue } : {}),
            revision: { increment: 1 },
          },
        })
        return { id, result: updated }
      })
      if (previousKey) await this.storage.delete(previousKey).catch(() => undefined)
      return {
        ...result,
        importedRows: imported?.length ?? 0,
        needsReview: true,
        extractionWarning,
      }
    } catch (err) {
      await this.storage.delete(key).catch(() => undefined)
      throw err
    }
  }
  state(id: string, dto: CalendarStateDto, actorId: string) {
    return this.mutate(actorId, 'exam.calendar.' + dto.status.toLowerCase(), async (tx) => {
      const calendar = await tx.examCalendar.findUnique({ where: { id } })
      if (!calendar) throw new NotFoundException('Calendar not found')
      if (calendar.revision !== dto.expectedRevision)
        throw new ConflictException('Calendar changed. Refresh before publishing.')
      if (dto.status === 'APPROVED') {
        if (calendar.status !== 'DRAFT') throw new BadRequestException('Publish a reviewed draft')
        validateCalendar({
          ...calendar,
          exam: calendar.exam as ExamCalendarDto['exam'],
          endDate: calendar.endDate ?? undefined,
          entries: calendar.entries as unknown as TimetableEntryDto[],
        })
        await tx.examCalendar.updateMany({
          where: {
            exam: calendar.exam,
            year: calendar.year,
            series: calendar.series,
            status: 'APPROVED',
          },
          data: { status: 'ARCHIVED', revision: { increment: 1 } },
        })
      }
      const result = await tx.examCalendar.update({
        where: { id },
        data: { status: dto.status, revision: { increment: 1 }, reviewedById: actorId },
      })
      return { id, result }
    })
  }
  async adminFile(id: string) {
    const calendar = await this.prisma.examCalendar.findUnique({ where: { id } })
    if (!calendar?.fileKey) throw new NotFoundException('No original timetable file')
    return {
      url: await this.storage.getSignedDownloadUrl(calendar.fileKey),
      fileName: calendar.fileName,
    }
  }
  async forGoal(goalId: string, user: AuthUser) {
    if (user.organizationId || user.role !== UserRole.STUDENT)
      throw new ForbiddenException('Standalone learner access required')
    const goal = await this.prisma.examGoal.findFirst({
      where: { id: goalId, studentId: user.id },
      include: { subjects: true },
    })
    if (!goal) throw new NotFoundException('Exam goal not found')
    const calendar = await this.prisma.examCalendar.findFirst({
      where: { exam: goal.exam, year: goal.year, series: goal.series, status: 'APPROVED' },
      orderBy: { version: 'desc' },
    })
    if (!calendar)
      return {
        calendar: null,
        papers: [],
        deadlines: [],
        note: 'No examination dates have been published for this year and series yet.',
      }
    const keys = new Set(goal.subjects.map((s) => s.subjectKey))
    const papers = (calendar.entries as unknown as TimetableEntryDto[])
      .filter((row) => keys.has(subjectIdentity(row.subject)))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''),
      )
    const today = lagosDay()
    const deadlines = goal.subjects.map((s) => {
      const paper = papers.find(
        (p) => subjectIdentity(p.subject) === s.subjectKey && p.date > today,
      )
      const date = paper?.date ?? (calendar.startDate > today ? calendar.startDate : null)
      return {
        courseId: s.courseId,
        subject: s.name,
        date,
        source: paper ? 'PAPER_DATE' : 'EXAM_WINDOW',
      }
    })
    return {
      calendar: {
        id: calendar.id,
        exam: calendar.exam,
        year: calendar.year,
        series: calendar.series,
        title: calendar.title,
        version: calendar.version,
        startDate: calendar.startDate,
        endDate: calendar.endDate,
        sourceNote: calendar.sourceNote,
        daysUntilStart: daysUntil(calendar.startDate),
        fileName: calendar.fileName,
        fileUrl: calendar.fileKey
          ? await this.storage.getSignedDownloadUrl(calendar.fileKey)
          : null,
      },
      papers,
      deadlines,
      note:
        goal.exam === 'JAMB'
          ? 'This is the general JAMB examination window. Your personal sitting date and time come from your examination slip.'
          : 'Paper dates and times are shown in Africa/Lagos. Check the original timetable and any subsequent official changes.',
    }
  }
  async studyDeadline(goalId: string, courseId: string, user: AuthUser) {
    const data = await this.forGoal(goalId, user)
    if (!data.calendar)
      throw new BadRequestException(
        'No examination dates are published yet; choose a study end date manually',
      )
    const deadline = data.deadlines.find((d) => d.courseId === courseId)
    if (!deadline)
      throw new BadRequestException('This course is not part of the selected exam goal')
    if (!deadline.date)
      throw new BadRequestException(
        'No future published deadline is available; choose your study end date manually',
      )
    return deadline.date
  }
}
