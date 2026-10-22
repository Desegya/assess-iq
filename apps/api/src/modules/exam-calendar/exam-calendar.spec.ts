import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { ExamCalendarDto, TimetableEntryDto } from './exam-calendar.dto'
import {
  daysUntil,
  lagosDay,
  parseTimetableCsv,
  validateCalendar,
  validDate,
} from './exam-calendar.rules'
const calendar = {
  exam: 'WAEC' as ExamCalendarDto['exam'],
  year: 2027,
  series: 'SCHOOL',
  startDate: '2027-05-01',
  endDate: '2027-06-30',
  entries: [] as TimetableEntryDto[],
}
const entry = {
  subject: 'Government',
  paperCode: 'GOV2',
  title: 'Government essay',
  date: '2027-05-20',
  startTime: '09:00',
  endTime: '11:00',
}
describe('Published exam dates and WAEC timetables', () => {
  it('rejects impossible dates and reversed windows', () => {
    expect(validDate('2027-02-29')).toBe(false)
    expect(validDate('2028-02-29')).toBe(true)
    expect(() => validateCalendar({ ...calendar, endDate: '2027-04-30' })).toThrow('on or after')
    expect(() => validateCalendar({ ...calendar, startDate: '2026-05-01' })).toThrow(
      'selected exam year',
    )
  })
  it('keeps JAMB windows separate from individual appointments', () => {
    expect(() =>
      validateCalendar({
        ...calendar,
        exam: 'JAMB' as ExamCalendarDto['exam'],
        series: 'GENERAL',
        entries: [entry],
      }),
    ).toThrow('not student-specific')
    expect(() =>
      validateCalendar({ ...calendar, exam: 'JAMB' as ExamCalendarDto['exam'] }),
    ).toThrow('valid series')
  })
  it('validates paper bounds, times and duplicate sessions including aliases', () => {
    expect(() =>
      validateCalendar({ ...calendar, entries: [{ ...entry, date: '2027-07-01' }] }),
    ).toThrow('inside')
    expect(() =>
      validateCalendar({ ...calendar, entries: [{ ...entry, endTime: '08:00' }] }),
    ).toThrow('after')
    expect(() =>
      validateCalendar({ ...calendar, entries: [entry, { ...entry, subject: ' government ' }] }),
    ).toThrow('Duplicate')
  })
  it('imports quoted CSV with explicit ISO dates and leaves unknown times blank', () => {
    const rows = parseTimetableCsv(
      'subject,paperCode,title,date,startTime,endTime,notes\r\nGovernment,GOV2,"Essay, structured",2027-05-20,09:00,11:00,"Read \\"source\\""\r\nEnglish,ENG1,Objective,2027-05-21,,,Time to be confirmed'.replaceAll(
        '\\"',
        '""',
      ),
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]!.title).toBe('Essay, structured')
    expect(rows[1]!.startTime).toBeUndefined()
  })
  it('rejects broken CSV, missing headers and malformed times through input validation', async () => {
    expect(() => parseTimetableCsv('subject,date\nGovernment,2027-05-20')).toThrow('headers')
    expect(() =>
      parseTimetableCsv('subject,paperCode,title,date\nGovernment,GOV2,"broken,2027-05-20'),
    ).toThrow('Unclosed')
    expect(
      (await validate(plainToInstance(TimetableEntryDto, { ...entry, startTime: '25:00' }))).length,
    ).toBeGreaterThan(0)
  })
  it('counts down by Nigeria calendar day independently of the host timezone', () => {
    const instant = new Date('2027-05-19T23:30:00Z')
    expect(lagosDay(instant)).toBe('2027-05-20')
    expect(daysUntil('2027-05-20', instant)).toBe(0)
    expect(daysUntil('2027-05-21', instant)).toBe(1)
  })
})
