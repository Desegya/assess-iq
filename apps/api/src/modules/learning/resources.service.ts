import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { AiService } from '../ai/ai.service'
import { CoursesService } from '../courses/courses.service'
import { describeCourse } from '../courses/describe-course'
import { AuthUser } from '@assessiq/types'

const CACHE_DAYS = 7

export interface VideoResource {
  id: string
  title: string
  channel: string
  thumbnail: string
  url: string
}

export interface TopicResources {
  videos: VideoResource[]
  // Real search pages (never AI-written URLs), always available even without a YouTube key
  searches: { label: string; url: string }[]
  videosConfigured: boolean
  fetchedAt: string | null
}

@Injectable()
export class ResourcesService {
  private readonly logger = new Logger(ResourcesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly coursesService: CoursesService,
    private readonly config: ConfigService,
  ) {}

  async getForTopic(topicId: string, user: AuthUser, refresh = false): Promise<TopicResources> {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } })
    if (!topic) throw new NotFoundException('Topic not found')
    const course = await this.coursesService.findOne(topic.courseId, user) // access check

    const query = `${topic.name} ${course.title}`
    const q = encodeURIComponent(query)
    const searches = [
      { label: 'Search YouTube', url: `https://www.youtube.com/results?search_query=${q}` },
      { label: 'Search Khan Academy', url: `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(topic.name)}` },
      { label: 'Search MIT OpenCourseWare', url: `https://ocw.mit.edu/search/?q=${encodeURIComponent(topic.name)}` },
    ]

    const apiKey = this.config.get<string>('YOUTUBE_API_KEY', '')
    if (!apiKey) return { videos: [], searches, videosConfigured: false, fetchedAt: null }

    const fresh =
      topic.resourcesFetchedAt && Date.now() - topic.resourcesFetchedAt.getTime() < CACHE_DAYS * 24 * 60 * 60 * 1000
    if (fresh && !refresh && Array.isArray(topic.resources)) {
      return {
        videos: topic.resources as unknown as VideoResource[],
        searches,
        videosConfigured: true,
        fetchedAt: topic.resourcesFetchedAt!.toISOString(),
      }
    }

    let videos: VideoResource[] = []
    try {
      const found = await this.searchYoutube(`${query} lecture explained`, apiKey)
      videos = found.videos
      if (videos.length > 1) {
        // Let AI pick the most suitable, level-appropriate ones; keep search order if that fails
        const details = found.descriptions
        const ranked = await this.ai
          .rankVideos(
            `${describeCourse(course)}\nTopic: ${topic.name}`,
            videos.map(v => ({ id: v.id, title: v.title, channel: v.channel, description: details.get(v.id) ?? '' })),
            { userId: user.id, organizationId: user.organizationId ?? undefined, relatedEntityId: topic.id },
          )
          .catch(() => null)
        if (ranked?.length) {
          const byId = new Map(videos.map(v => [v.id, v]))
          videos = ranked.map(id => byId.get(id)).filter((v): v is VideoResource => !!v)
        } else {
          videos = videos.slice(0, 4)
        }
      }
    } catch (err) {
      this.logger.warn(`YouTube search failed for topic ${topicId}: ${err instanceof Error ? err.message : String(err)}`)
      return { videos: [], searches, videosConfigured: true, fetchedAt: null }
    }

    const updated = await this.prisma.topic.update({
      where: { id: topicId },
      data: { resources: videos as unknown as object, resourcesFetchedAt: new Date() },
    })
    return { videos, searches, videosConfigured: true, fetchedAt: updated.resourcesFetchedAt!.toISOString() }
  }

  private async searchYoutube(
    query: string,
    apiKey: string,
  ): Promise<{ videos: VideoResource[]; descriptions: Map<string, string> }> {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      maxResults: '10',
      q: query,
      relevanceLanguage: 'en',
      safeSearch: 'strict',
      videoEmbeddable: 'true',
      key: apiKey,
    })
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
    if (!res.ok) throw new Error(`YouTube API ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const body = (await res.json()) as {
      items?: { id: { videoId?: string }; snippet: { title: string; channelTitle: string; description: string; thumbnails: { medium?: { url: string } } } }[]
    }
    const items = (body.items ?? []).filter(i => i.id.videoId)
    return {
      videos: items.map(i => ({
        id: i.id.videoId!,
        title: decodeEntities(i.snippet.title),
        channel: decodeEntities(i.snippet.channelTitle),
        thumbnail: i.snippet.thumbnails.medium?.url ?? `https://i.ytimg.com/vi/${i.id.videoId}/mqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
      })),
      descriptions: new Map(items.map(i => [i.id.videoId!, i.snippet.description])),
    }
  }
}

function decodeEntities(s: string) {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}
