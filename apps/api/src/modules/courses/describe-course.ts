export const SEMESTER_LABEL = { FIRST: 'first semester', SECOND: 'second semester' } as const

// A plain-text description of a course, used as the AI's only context when the student hasn't uploaded material
export function describeCourse(course: {
  title: string
  subject: string
  courseCode?: string | null
  level?: number | null
  semester?: 'FIRST' | 'SECOND' | null
  description?: string | null
}): string {
  const details = [
    course.courseCode,
    course.subject,
    course.level ? `${course.level} level` : null,
    course.semester ? SEMESTER_LABEL[course.semester] : null,
  ].filter(Boolean)
  return `${course.title}${details.length ? ` (${details.join(', ')})` : ''} — a university course${
    course.description ? `\nDescription: ${course.description}` : ''
  }`
}
