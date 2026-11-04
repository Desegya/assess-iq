import type { PrismaService } from '../prisma/prisma.service'
import type { AuthUser } from '@assessiq/types'
import type { PlanTopic } from './plan-builder'

export async function loadPlanTopics(
  database: Pick<PrismaService, 'topic' | 'topicMastery' | 'studySession'>,
  courseId: string,
  user: AuthUser,
): Promise<PlanTopic[]> {
  const topics = await database.topic.findMany({
    where: { courseId, parentTopicId: null, archivedAt: null },
    orderBy: { order: 'asc' },
    include: { subTopics: { where: { archivedAt: null }, select: { id: true } } },
  })
  const ids = topics.map((t) => t.id)
  const [masteries, completed] = await Promise.all([
    database.topicMastery.findMany({ where: { studentId: user.id, topicId: { in: ids } } }),
    database.studySession.findMany({
      where: { studentId: user.id, topicId: { in: ids }, status: 'COMPLETED' },
      select: {
        topicId: true,
        kind: true,
        actualMinutes: true,
        estimatedMinutes: true,
        confidenceRating: true,
      },
    }),
  ])
  return topics.map((t) => {
    const mine = completed.filter((s) => s.topicId === t.id)
    const ratings = mine.map((s) => s.confidenceRating).filter((r): r is number => r != null)
    const mastery = masteries.find((m) => m.topicId === t.id)
    return {
      id: t.id,
      name: t.name,
      estimatedMinutes: t.estimatedMinutes,
      subtopicCount: t.subTopics.length,
      mastery: mastery?.quizAverage ?? null,
      confidence: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      completedMinutes: mine
        .filter((s) => s.kind !== 'REVISION')
        .reduce((sum, s) => sum + (s.actualMinutes ?? s.estimatedMinutes), 0),
    }
  })
}
