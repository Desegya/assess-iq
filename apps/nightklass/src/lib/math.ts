export type MathSegment =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string; display: boolean }

/**
 * Splits text into plain and LaTeX segments. Recognises $$…$$ and \[…\] (display)
 * and $…$ and \(…\) (inline). Following Pandoc, an inline $ must not be followed
 * by a space and its closing $ must not be preceded by a space or followed by a
 * digit, so prices like "$5 and $10" stay as text.
 */
export function splitMath(text: string): MathSegment[] {
  const segments: MathSegment[] = []
  const pattern =
    /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\s)((?:\\\$|[^$\n])+?)(?<!\s)\$(?!\d)/g
  let last = 0
  for (const m of text.matchAll(pattern)) {
    const index = m.index ?? 0
    if (index > last) segments.push({ kind: 'text', value: text.slice(last, index) })
    const display = m[1] !== undefined || m[2] !== undefined
    segments.push({ kind: 'math', value: (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim(), display })
    last = index + m[0].length
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) })
  return segments
}
