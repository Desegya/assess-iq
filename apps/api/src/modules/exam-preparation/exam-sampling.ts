import { Prisma } from '@assessiq/db'

type Db = { $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T>; $executeRaw: (query: Prisma.Sql) => Promise<number> }

export interface SampleFilter {
  studentId: string
  exam: 'JAMB' | 'WAEC'
  subjectKey: string
  questionType?: 'MCQ' | 'SHORT_ANSWER' | 'THEORY' | 'TRUE_FALSE'
  marks?: number
  /** Exact topic match (case-insensitive), as WAEC section topics require. */
  topic?: string
  /** Substring topic match for learner practice search. */
  topicContains?: string
  objectiveId?: string
  excludeIds?: string[]
  count: number
}

/**
 * Picks published question ids in the database, preferring questions the
 * learner has never been shown, then the least recently shown, with random
 * order within each group. Only ids are read, so pool size no longer limits
 * which questions can appear: every published question, including newly
 * published corrections, is eligible (the old `ORDER BY id LIMIT n` pools
 * silently excluded anything newer than the first n by creation time).
 */
export async function sampleQuestionIds(db: Db, f: SampleFilter): Promise<string[]> {
  if (f.count <= 0) return []
  const conditions: Prisma.Sql[] = [
    Prisma.sql`q."exam" = ${f.exam}::"ExamFamily"`,
    Prisma.sql`q."subjectKey" = ${f.subjectKey}`,
    Prisma.sql`q."status" = 'APPROVED'::"QuestionStatus"`,
  ]
  if (f.questionType) conditions.push(Prisma.sql`q."questionType" = ${f.questionType}::"QuestionType"`)
  if (f.marks !== undefined) conditions.push(Prisma.sql`q."marks" = ${f.marks}`)
  if (f.topic) conditions.push(Prisma.sql`lower(q."topic") = lower(${f.topic})`)
  if (f.topicContains)
    conditions.push(Prisma.sql`q."topic" ILIKE ${'%' + f.topicContains.replace(/[\\%_]/g, (c) => '\\' + c) + '%'}`)
  if (f.objectiveId)
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "exam_question_objectives" o WHERE o."questionId" = q."id" AND o."objectiveId" = ${f.objectiveId})`,
    )
  if (f.excludeIds?.length) conditions.push(Prisma.sql`q."id" <> ALL(${f.excludeIds}::text[])`)
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT q."id" FROM "exam_bank_questions" q
    LEFT JOIN "exam_question_exposures" e ON e."questionId" = q."id" AND e."studentId" = ${f.studentId}
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY e."lastSeenAt" ASC NULLS FIRST, random()
    LIMIT ${f.count}`)
  return rows.map((r) => r.id)
}

/** Records that a learner was shown these questions (for unseen-first selection and item statistics). */
export async function recordExposures(db: Db, studentId: string, questionIds: string[]) {
  if (!questionIds.length) return
  await db.$executeRaw(Prisma.sql`
    INSERT INTO "exam_question_exposures" ("studentId", "questionId", "timesSeen", "lastSeenAt")
    SELECT ${studentId}, id, 1, now() FROM unnest(${questionIds}::text[]) AS id
    ON CONFLICT ("studentId", "questionId")
    DO UPDATE SET "timesSeen" = "exam_question_exposures"."timesSeen" + 1, "lastSeenAt" = now()`)
}

// Options that refer to other options by position or as a group lose their
// meaning when reordered, so questions containing them keep their authored order.
const POSITIONAL = /\b(all|none|both|neither|either)\s+of\s+the\s+(above|options)\b|\b[A-D]\s*(and|&|or)\s*[A-D]\b|\boptions?\s+[A-D]\b|^\s*[A-D]\s*only\s*$/i

export interface ShuffledOptions {
  options: { key: string; text: string }[]
  correctAnswer: string
  /** Original option keys in displayed order, e.g. ['C','A','D','B'] means displayed A was authored C. */
  optionOrder: string[]
}

/**
 * Reorders A–D option texts and remaps the answer key. Displayed keys stay A–D,
 * so learners and stored answers always use display keys; the snapshot keeps
 * the authored order for review and item statistics.
 */
export function shuffleOptions(
  options: { key: string; text: string }[] | null | undefined,
  correctAnswer: string,
  random: () => number = Math.random,
): ShuffledOptions | null {
  const keys = ['A', 'B', 'C', 'D']
  if (!options || options.length !== 4 || options.some((o, i) => o.key !== keys[i])) return null
  if (options.some((o) => POSITIONAL.test(o.text))) return null
  if (!keys.includes(correctAnswer)) return null
  const order = [...options]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  return {
    options: order.map((o, i) => ({ key: keys[i]!, text: o.text })),
    correctAnswer: keys[order.findIndex((o) => o.key === correctAnswer)]!,
    optionOrder: order.map((o) => o.key),
  }
}
