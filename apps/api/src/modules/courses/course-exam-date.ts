import { BadRequestException } from '@nestjs/common'

export function courseExamDate(value: string | null | undefined, now = new Date()): Date | null {
  if (!value) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value <= today
  )
    throw new BadRequestException('Choose a future exam date, or leave it empty for now')
  return date
}
