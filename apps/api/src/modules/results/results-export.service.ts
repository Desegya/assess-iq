import { Injectable, NotFoundException } from '@nestjs/common'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { AuthUser } from '@assessiq/types'
import { PrismaService } from '../prisma/prisma.service'
import { orgScope } from '../../common/org-scope'
import { gradeFor } from '../attempts/result-visibility'

export const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

type Cell = string | number | null
interface Column { header: string; width: number; percent?: boolean }
interface Table { title: string; subtitle: string; columns: Column[]; rows: Cell[][]; filename: string }
export interface ExportFile { buffer: Buffer; contentType: string; filename: string }

const FINISHED = ['SUBMITTED', 'AUTO_SUBMITTED', 'GRADED'] as const
const STATUS_LABEL: Record<string, string> = {
  GRADED: 'Marked',
  SUBMITTED: 'Awaiting marking',
  AUTO_SUBMITTED: 'Time ran out (awaiting marking)',
}
const round1 = (n: number) => Math.round(n * 10) / 10

/** Results exports for lecturers: one test, or a class gradebook across its tests. */
@Injectable()
export class ResultsExportService {
  constructor(private readonly prisma: PrismaService) {}

  async assessmentResults(assessmentId: string, user: AuthUser, format: ExportFormat): Promise<ExportFile> {
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, ...orgScope(user, 'Assessment not found') },
      select: {
        title: true,
        totalMarks: true,
        courseId: true,
        course: { select: { title: true, courseCode: true } },
        attempts: {
          where: { status: { in: [...FINISHED] } },
          orderBy: { submittedAt: 'asc' },
          select: {
            studentId: true,
            status: true,
            score: true,
            percentageScore: true,
            startedAt: true,
            submittedAt: true,
            student: { select: { name: true, email: true } },
          },
        },
      },
    })
    if (!assessment) throw new NotFoundException('Assessment not found')

    // The latest finished attempt counts; everyone on the class list appears, even without one
    const latest = new Map<string, (typeof assessment.attempts)[number]>()
    const counts = new Map<string, number>()
    for (const a of assessment.attempts) {
      latest.set(a.studentId, a)
      counts.set(a.studentId, (counts.get(a.studentId) ?? 0) + 1)
    }
    const students = await this.classStudents(assessment.courseId, [...latest.values()].map(a => ({ id: a.studentId, ...a.student })))

    const rows: Cell[][] = students.map(s => {
      const a = latest.get(s.id)
      if (!a) return [s.name, s.email, 'Not attempted', null, assessment.totalMarks, null, '', '', null, 0]
      const pct = a.percentageScore === null ? null : round1(a.percentageScore)
      const minutes = a.submittedAt ? Math.max(1, Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 60_000)) : null
      return [
        s.name,
        s.email,
        STATUS_LABEL[a.status] ?? a.status,
        a.score === null ? null : round1(a.score),
        assessment.totalMarks,
        pct,
        a.status === 'GRADED' ? gradeFor(pct) : 'Pending',
        a.submittedAt ? a.submittedAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '',
        minutes,
        counts.get(s.id) ?? 0,
      ]
    })

    const classLabel = [assessment.course.courseCode, assessment.course.title].filter(Boolean).join(' · ')
    return render(format, {
      title: assessment.title,
      subtitle: `${classLabel} · ${plural(rows.length, 'student')} · exported ${today()}`,
      filename: `${slug(assessment.title)}-results-${today()}`,
      columns: [
        { header: 'Student', width: 26 },
        { header: 'Email', width: 32 },
        { header: 'Status', width: 22 },
        { header: 'Score', width: 8 },
        { header: 'Out of', width: 8 },
        { header: 'Percentage', width: 11, percent: true },
        { header: 'Grade', width: 8 },
        { header: 'Submitted', width: 20 },
        { header: 'Minutes', width: 9 },
        { header: 'Attempts', width: 9 },
      ],
      rows,
    })
  }

  async classGradebook(courseId: string, user: AuthUser, format: ExportFormat): Promise<ExportFile> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, ...orgScope(user, 'Class not found'), NOT: { organizationId: null } },
      select: {
        title: true,
        courseCode: true,
        assessments: {
          where: { status: { not: 'DRAFT' } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            attempts: {
              where: { status: { in: [...FINISHED] } },
              orderBy: { submittedAt: 'asc' },
              select: { studentId: true, status: true, percentageScore: true, student: { select: { name: true, email: true } } },
            },
          },
        },
      },
    })
    if (!course) throw new NotFoundException('Class not found')

    const tests = course.assessments
    const results = new Map<string, Map<string, { pct: number | null; pending: boolean }>>()
    const attempted: { id: string; name: string; email: string }[] = []
    for (const t of tests) {
      for (const a of t.attempts) {
        attempted.push({ id: a.studentId, ...a.student })
        const byTest = results.get(a.studentId) ?? new Map()
        byTest.set(t.id, { pct: a.percentageScore === null ? null : round1(a.percentageScore), pending: a.status !== 'GRADED' })
        results.set(a.studentId, byTest)
      }
    }
    const students = await this.classStudents(courseId, attempted)

    const rows: Cell[][] = students.map(s => {
      const byTest = results.get(s.id)
      const marks = tests.map(t => byTest?.get(t.id)?.pct ?? null)
      const taken = marks.filter((m): m is number => m !== null)
      const average = taken.length ? round1(taken.reduce((a, b) => a + b, 0) / taken.length) : null
      const pending = tests.some(t => byTest?.get(t.id)?.pending)
      return [s.name, s.email, ...marks, taken.length, average, pending ? 'Pending' : gradeFor(average)]
    })

    const label = [course.courseCode, course.title].filter(Boolean).join(' · ')
    return render(format, {
      title: `${label} gradebook`,
      subtitle: `${plural(tests.length, 'test')} · ${plural(rows.length, 'student')} · percentages; blank = not attempted · exported ${today()}`,
      filename: `${slug(course.courseCode || course.title)}-gradebook-${today()}`,
      columns: [
        { header: 'Student', width: 26 },
        { header: 'Email', width: 32 },
        ...tests.map(t => ({ header: t.title, width: Math.min(24, Math.max(10, t.title.length + 2)), percent: true })),
        { header: 'Tests taken', width: 11 },
        { header: 'Average', width: 10, percent: true },
        { header: 'Grade', width: 8 },
      ],
      rows,
    })
  }

  /** Current class members plus anyone with results (e.g. removed later), sorted by name. */
  private async classStudents(courseId: string, withResults: { id: string; name: string; email: string }[]) {
    const enrolled = await this.prisma.courseEnrollment.findMany({
      where: { courseId, status: 'ACTIVE' },
      select: { student: { select: { id: true, name: true, email: true } } },
    })
    const all = new Map<string, { id: string; name: string; email: string }>()
    for (const e of enrolled) all.set(e.student.id, e.student)
    for (const s of withResults) all.set(s.id, s)
    return [...all.values()].sort((a, b) => a.name.localeCompare(b.name))
  }
}

// ─── Writers ─────────────────────────────────────────────────────────────────

async function render(format: ExportFormat, table: Table): Promise<ExportFile> {
  if (format === 'xlsx') return { buffer: await toXlsx(table), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `${table.filename}.xlsx` }
  if (format === 'pdf') return { buffer: await toPdf(table), contentType: 'application/pdf', filename: `${table.filename}.pdf` }
  return { buffer: toCsv(table), contentType: 'text/csv; charset=utf-8', filename: `${table.filename}.csv` }
}

function toCsv(table: Table): Buffer {
  const escape = (v: Cell) => {
    if (v === null) return ''
    let s = String(v)
    // Neutralise spreadsheet formulas in names and titles (CSV injection)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [table.columns.map(c => escape(c.header)), ...table.rows.map(r => r.map(escape))].map(r => r.join(','))
  // BOM so Excel opens UTF-8 names correctly
  return Buffer.from('﻿' + lines.join('\r\n') + '\r\n', 'utf8')
}

async function toXlsx(table: Table): Promise<Buffer> {
  const book = new ExcelJS.Workbook()
  book.creator = 'KwikEval'
  const sheet = book.addWorksheet('Results', { views: [{ state: 'frozen', ySplit: 3 }] })
  sheet.addRow([table.title]).font = { bold: true, size: 14 }
  sheet.addRow([table.subtitle]).font = { color: { argb: 'FF716778' } }
  const header = sheet.addRow(table.columns.map(c => c.header))
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7545CF' } }
  for (const row of table.rows) sheet.addRow(row.map(v => (v === null ? null : v)))
  table.columns.forEach((c, i) => {
    const col = sheet.getColumn(i + 1)
    col.width = c.width
    if (c.percent) col.numFmt = '0.0'
  })
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: table.columns.length } }
  return Buffer.from(await book.xlsx.writeBuffer())
}

/** The built-in PDF font covers Latin-1 only; fold accents (Ọ → O) rather than drop letters. */
const pdfText = (v: Cell) => (v === null ? '' : String(v).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\xFF]/g, '?'))

function toPdf(table: Table): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, info: { Title: pdfText(table.title), Creator: 'KwikEval' } })
    const chunks: Buffer[] = []
    doc.on('data', c => chunks.push(c as Buffer))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const left = doc.page.margins.left
    const usable = doc.page.width - left - doc.page.margins.right
    const total = table.columns.reduce((s, c) => s + c.width, 0)
    const widths = table.columns.map(c => (c.width / total) * usable)
    const rowHeight = 18
    const bottom = () => doc.page.height - doc.page.margins.bottom

    doc.font('Helvetica-Bold').fontSize(15).fillColor('#241f2e').text(pdfText(table.title), left, doc.page.margins.top)
    doc.font('Helvetica').fontSize(9).fillColor('#716778').text(pdfText(table.subtitle)).moveDown(0.8)

    const drawRow = (cells: Cell[], y: number, headerRow: boolean, shaded: boolean) => {
      if (headerRow) doc.rect(left, y, usable, rowHeight).fill('#7545cf')
      else if (shaded) doc.rect(left, y, usable, rowHeight).fill('#f7f2ff')
      let x = left
      doc.font(headerRow ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(headerRow ? '#ffffff' : '#241f2e')
      cells.forEach((cell, i) => {
        doc.text(pdfText(cell), x + 4, y + 5, { width: widths[i]! - 8, height: rowHeight - 6, ellipsis: true, lineBreak: false })
        x += widths[i]!
      })
    }

    let y = doc.y
    const headers = table.columns.map(c => c.header)
    drawRow(headers, y, true, false)
    y += rowHeight
    table.rows.forEach((row, i) => {
      if (y + rowHeight > bottom()) {
        doc.addPage()
        y = doc.page.margins.top
        drawRow(headers, y, true, false)
        y += rowHeight
      }
      drawRow(row, y, false, i % 2 === 1)
      y += rowHeight
    })
    if (table.rows.length === 0) doc.font('Helvetica').fontSize(10).fillColor('#716778').text('No students yet.', left, y + 8)
    doc.end()
  })
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const today = () => new Date().toISOString().slice(0, 10)
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'results'
