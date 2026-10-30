import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'
import type { LessonVisual } from '@assessiq/types'
import { AiService, type LessonContent } from '../ai/ai.service'
import { StorageService } from '../storage/storage.service'
import { LessonIllustrationsService } from './lesson-illustrations.service'
import { canGenerateLessonVisuals } from './lesson-visuals'

@Injectable()
export class LessonVisualsService {
  private readonly logger = new Logger(LessonVisualsService.name)
  constructor(
    private readonly config: ConfigService,
    private readonly illustrations: LessonIllustrationsService,
    private readonly ai: AiService,
    private readonly storage: StorageService,
  ) {}

  canGenerate(userId: string) {
    return canGenerateLessonVisuals(
      this.config.get<string>('LESSON_VISUALS_ACCESS', 'all'),
      userId,
      this.config.get<string>('LESSON_VISUALS_ALLOWED_USER_IDS', ''),
    )
  }

  async create(
    content: LessonContent,
    context: { userId: string; organizationId?: string; relatedEntityId: string },
  ): Promise<LessonVisual[]> {
    if (!this.canGenerate(context.userId)) return []
    const visuals: LessonVisual[] = []
    for (const plan of content.visualPlans ?? []) {
      const { imagePrompt: _, ...visual } = plan
      if (plan.kind === 'process') {
        visuals.push(visual)
        continue
      }
      if (!this.illustrations.isConfigured()) continue
      try {
        const image = await this.illustrations.generate(plan.imagePrompt, context)
        const section = content.sections[plan.sectionIndex]
        if (
          !section ||
          !(await this.ai.reviewLessonIllustration(
            image,
            `${section.heading}\n${section.body}`,
            plan,
            context,
          ))
        ) {
          this.logger.warn('event=lesson_illustration_rejected')
          continue
        }
        const storageKey = `lesson-visuals/${context.relatedEntityId}/${randomUUID()}.png`
        await this.storage.uploadBuffer(storageKey, image, 'image/png')
        visuals.push({ ...visual, storageKey })
      } catch (err) {
        // Optional media must never lose an otherwise complete lesson.
        this.logger.warn(
          `event=lesson_illustration_unavailable reason=${err instanceof Error ? err.message.slice(0, 200) : 'unknown'}`,
        )
      }
    }
    return visuals
  }

  /** Called after lesson authorization. Never persist expiring signed URLs. */
  async forRead(content: Record<string, unknown>) {
    const { visualPlans: _, ...rest } = content
    if (!Array.isArray(content.visuals)) return rest
    return {
      ...rest,
      visuals: await Promise.all(
        (content.visuals as LessonVisual[]).map(async (visual) => {
          const { storageKey, url: _oldUrl, ...publicVisual } = visual
          if (visual.kind !== 'illustration' || !storageKey?.startsWith('lesson-visuals/'))
            return publicVisual
          try {
            return {
              ...publicVisual,
              url: await this.storage.getSignedDownloadUrl(storageKey, 3600),
            }
          } catch {
            return publicVisual
          }
        }),
      ),
    }
  }

  async discard(visuals: LessonVisual[]) {
    await Promise.allSettled(
      visuals.filter((v) => v.storageKey).map((v) => this.storage.delete(v.storageKey!)),
    )
  }
}
