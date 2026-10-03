import Link from 'next/link'
import { getSubjectColor } from '@/lib/subject-color'
import { ProgressRing } from '@/components/ui/ProgressRing'

export interface Course {
  id: string
  title: string
  subject: string
  description: string | null
  courseCode: string | null
  level: number | null
  semester: 'FIRST' | 'SECOND' | null
  _count: { documents: number; questions: number; assessments: number }
}

const SEMESTER_LABEL = { FIRST: 'First semester', SECOND: 'Second semester' } as const

export interface CourseProgress {
  courseId: string
  topicsTotal: number
  topicsCompleted: number
  percent: number
}

export function CourseGrid({
  courses,
  progressByCourse,
}: {
  courses: Course[]
  progressByCourse: Map<string, CourseProgress>
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {courses.map((course, i) => {
        const p = progressByCourse.get(course.id)
        const color = getSubjectColor(course.id)
        return (
          <Link
            key={course.id}
            href={`/courses/${course.id}`}
            className="card card-accent p-6 block animate-slide-up"
            style={{ animationDelay: `${i * 75}ms`, ['--accent-color' as string]: color.hex }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-heading font-bold text-slate-900 truncate">{course.title}</h2>
                {course.subject !== course.title && <p className="text-slate-500 text-sm mt-1">{course.subject}</p>}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {course.courseCode && <span className={`badge ${color.bgSoft} ${color.text}`}>{course.courseCode}</span>}
                  {course.level && <span className="badge bg-slate-100 text-slate-600">{course.level}L</span>}
                  {course.semester && <span className="badge bg-slate-100 text-slate-600">{SEMESTER_LABEL[course.semester]}</span>}
                </div>
              </div>
              {p && p.topicsTotal > 0 && <ProgressRing percent={p.percent} size={48} strokeWidth={4} color={color.hex} />}
            </div>
            {course.description && <p className="text-slate-400 text-xs mt-3 line-clamp-2">{course.description}</p>}
            {p && p.topicsTotal > 0 && (
              <p className="text-xs text-slate-400 mt-3">
                {p.topicsCompleted}/{p.topicsTotal} topics complete
              </p>
            )}
            <div className="flex gap-3 mt-3 text-xs text-slate-400">
              <span>{course._count.documents} document(s)</span>
              <span>{course._count.questions} question(s)</span>
            </div>
          </Link>
        )
      })}

      <Link
        href="/courses/new"
        className="rounded-3xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center
                   justify-center text-center text-slate-400 hover:border-blue-300 hover:text-blue-500
                   hover:bg-blue-50/40 transition-all duration-200 animate-slide-up min-h-[140px]"
        style={{ animationDelay: `${courses.length * 75}ms` }}
      >
        <span className="text-2xl mb-1">+</span>
        <span className="text-sm font-medium">Add another course</span>
      </Link>
    </div>
  )
}
