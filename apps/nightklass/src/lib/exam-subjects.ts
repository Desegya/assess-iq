/** Common WAEC/JAMB subjects offered as choices; any other subject can still be typed in. */
export const EXAM_SUBJECTS = [
  'Mathematics',
  'Biology',
  'Chemistry',
  'Physics',
  'Literature in English',
  'Government',
  'Economics',
  'Commerce',
  'Financial Accounting',
  'Geography',
  'History',
  'Christian Religious Studies',
  'Islamic Studies',
  'Agricultural Science',
  'French',
  'Yoruba',
  'Igbo',
  'Hausa',
]

/** Admin choices also include the compulsory and less common subjects. */
export const ADMIN_EXAM_SUBJECTS = [
  'English Language',
  ...EXAM_SUBJECTS,
  'Further Mathematics',
  'Civic Education',
]
