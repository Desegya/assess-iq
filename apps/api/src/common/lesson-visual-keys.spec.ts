import { describe, expect, it } from 'vitest'
import { lessonVisualKeys } from './lesson-visual-keys'

describe('lesson media cleanup', () => {
  it('collects only saved lesson image keys and tolerates older or malformed content', () => {
    expect(lessonVisualKeys(null)).toEqual([])
    expect(lessonVisualKeys({ introduction: 'Old lesson' })).toEqual([])
    expect(lessonVisualKeys({ visuals: [null, {}, { storageKey: 'lesson-visuals/topic/image.png' }, { storageKey: 'documents/private.pdf' }, { url: 'https://example.test/image.png' }] }))
      .toEqual(['lesson-visuals/topic/image.png'])
  })
})
