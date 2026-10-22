export type InstitutionType = 'UNIVERSITY' | 'POLYTECHNIC' | 'COLLEGE_OF_EDUCATION' | 'SECONDARY_SCHOOL' | 'OTHER'
export type Semester = 'FIRST' | 'SECOND'

export interface AcademicProfile {
  studyPathway: 'TERTIARY' | 'EXAM_PREPARATION'
  secondaryStage: 'SS1' | 'SS2' | 'SS3' | 'SCHOOL_LEAVER' | null
  name: string
  country: string | null
  institutionType: InstitutionType | null
  programme: string | null
  currentLevel: number | null
  currentSemester: Semester | null
  institution: string | null
  faculty: string | null
  academicSession: string | null
  graduationYear: number | null
  profileCompletedAt: string | null
}

export const INSTITUTION_TYPE_LABEL: Record<InstitutionType, string> = {
  UNIVERSITY: 'University',
  POLYTECHNIC: 'Polytechnic',
  COLLEGE_OF_EDUCATION: 'College of education',
  SECONDARY_SCHOOL: 'Secondary school',
  OTHER: 'Other',
}

export const SEMESTER_LABEL: Record<Semester, string> = { FIRST: 'First Semester', SECOND: 'Second Semester' }

export const LEVELS = [100, 200, 300, 400, 500, 600]

// "Animal & Environmental Biology • 200 Level • First Semester"
export function profileSummary(p: AcademicProfile): string {
  if (p.studyPathway === 'EXAM_PREPARATION') return `${p.secondaryStage === 'SCHOOL_LEAVER' ? 'School leaver' : p.secondaryStage ?? 'Secondary student'} • Exam preparation`
  return [p.programme, p.currentLevel && `${p.currentLevel} Level`, p.currentSemester && SEMESTER_LABEL[p.currentSemester]]
    .filter(Boolean)
    .join(' • ')
}
