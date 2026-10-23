'use client'

import { Fragment, useMemo } from 'react'
import katex from 'katex'
import { splitMath } from '@/lib/math'

function renderMath(value: string, display: boolean) {
  // trust:false blocks \href, \includegraphics and similar; errors render the source in red
  // instead of throwing, so a malformed formula never breaks the page.
  return katex.renderToString(value, {
    displayMode: display,
    throwOnError: false,
    trust: false,
    strict: 'ignore',
    output: 'htmlAndMathml',
  })
}

/**
 * Plain text with formulas. Use for question stems, options, answers,
 * explanations and flashcards, where Markdown would misread "*" or "1.".
 */
export function hasMath(text: string | null | undefined) {
  return !!text && splitMath(text).some((s) => s.kind === 'math')
}

export function MathText({
  children,
  className,
}: {
  children: string | null | undefined
  className?: string
}) {
  const segments = useMemo(() => splitMath(children ?? ''), [children])
  return (
    <span className={className ?? 'whitespace-pre-wrap'}>
      {segments.map((s, i) =>
        s.kind === 'text' ? (
          <Fragment key={i}>{s.value}</Fragment>
        ) : (
          <span
            key={i}
            className={
              s.display
                ? 'my-2 block overflow-x-auto'
                : 'inline-block max-w-full overflow-x-auto align-middle'
            }
            // KaTeX output with trust disabled contains no scripts or links.
            dangerouslySetInnerHTML={{ __html: renderMath(s.value, s.display) }}
          />
        ),
      )}
    </span>
  )
}
