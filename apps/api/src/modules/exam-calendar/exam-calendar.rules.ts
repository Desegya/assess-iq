import { BadRequestException } from '@nestjs/common'
import { ExamCalendarDto, TimetableEntryDto } from './exam-calendar.dto'
import { subjectIdentity } from '../exam-preparation/exam-content.rules'
export function validDate(date: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date + 'T00:00:00Z')) &&
    new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date
  )
}
export function lagosDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  return ['year', 'month', 'day'].map((t) => parts.find((p) => p.type === t)!.value).join('-')
}
export function daysUntil(day: string, now = new Date()) {
  return Math.round(
    (Date.parse(day + 'T00:00:00Z') - Date.parse(lagosDay(now) + 'T00:00:00Z')) / 86400000,
  )
}
export function validateCalendar(
  dto: Pick<ExamCalendarDto, 'exam' | 'year' | 'series' | 'startDate' | 'endDate' | 'entries'>,
) {
  if (
    (dto.exam === 'JAMB' && dto.series !== 'GENERAL') ||
    (dto.exam === 'WAEC' && !['SCHOOL', 'PRIVATE_FIRST', 'PRIVATE_SECOND'].includes(dto.series))
  )
    throw new BadRequestException('Choose a valid series for this examination')
  if (!validDate(dto.startDate) || Number(dto.startDate.slice(0, 4)) !== dto.year)
    throw new BadRequestException('Exam start date must be a real date in the selected exam year')
  if (dto.endDate && (!validDate(dto.endDate) || dto.endDate < dto.startDate))
    throw new BadRequestException('Exam end date must be on or after its start date')
  if (dto.exam === 'JAMB' && dto.entries.length)
    throw new BadRequestException(
      'JAMB uses a general examination window, not student-specific appointments',
    )
  const keys = new Set<string>()
  for (const row of dto.entries) {
    if (!row.subject.trim() || !row.paperCode.trim() || !row.title.trim())
      throw new BadRequestException('Timetable rows require a subject, paper code and title')
    if (!validDate(row.date) || row.date < dto.startDate || (dto.endDate && row.date > dto.endDate))
      throw new BadRequestException('Every paper date must lie inside the examination window')
    if (row.endTime && (!row.startTime || row.endTime <= row.startTime))
      throw new BadRequestException(
        'Paper end time must be after its start time, or leave unknown times blank',
      )
    const key = [
      subjectIdentity(row.subject),
      row.paperCode.trim().toLowerCase(),
      row.date,
      row.startTime ?? '',
    ].join('|')
    if (keys.has(key)) throw new BadRequestException('Duplicate timetable paper/session')
    keys.add(key)
  }
}
/** Quoted CSV with explicit ISO dates; never guess day/month ordering from a PDF. */
export function parseTimetableCsv(text: string): TimetableEntryDto[] {
  const rows: string[][] = []
  let row: string[] = [],
    value = '',
    quoted = false
  const input = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') {
        value += '"'
        i++
      } else quoted = !quoted
    } else if (ch === ',' && !quoted) {
      row.push(value.trim())
      value = ''
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && input[i + 1] === '\n') i++
      row.push(value.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      value = ''
    } else value += ch
  }
  if (quoted) throw new BadRequestException('Unclosed quoted field in timetable CSV')
  row.push(value.trim())
  if (row.some(Boolean)) rows.push(row)
  const header = rows.shift()?.map((s) => s.replace(/[\s_-]/g, '').toLowerCase()) ?? []
  if (new Set(header).size !== header.length)
    throw new BadRequestException('Duplicate CSV column headers')
  if (!['subject', 'papercode', 'title', 'date'].every((h) => header.includes(h)))
    throw new BadRequestException(
      'CSV headers must include subject,paperCode,title,date; optional startTime,endTime,notes',
    )
  if (!rows.length || rows.length > 500)
    throw new BadRequestException('CSV must contain between 1 and 500 paper rows')
  const get = (r: string[], name: string) => r[header.indexOf(name)] ?? ''
  return rows.map((r) => ({
    subject: get(r, 'subject'),
    paperCode: get(r, 'papercode'),
    title: get(r, 'title'),
    date: get(r, 'date'),
    ...(get(r, 'starttime') ? { startTime: get(r, 'starttime') } : {}),
    ...(get(r, 'endtime') ? { endTime: get(r, 'endtime') } : {}),
    ...(get(r, 'notes') ? { notes: get(r, 'notes') } : {}),
  }))
}
