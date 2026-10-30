/** Media keys come from saved lesson JSON, never from a deletion request. */
export function lessonVisualKeys(content: unknown): string[] {
  if (!content || typeof content !== 'object') return []
  const visuals = (content as { visuals?: unknown }).visuals
  if (!Array.isArray(visuals)) return []
  return visuals.flatMap((v) =>
    typeof v?.storageKey === 'string' && v.storageKey.startsWith('lesson-visuals/')
      ? [v.storageKey]
      : [],
  )
}
