'use client'

import { useId, useState } from 'react'
import type { LessonVisual as Visual } from '@assessiq/types'
import { useApi } from '@/hooks/use-api'
import { MathText } from './MathText'

/** Process labels stay as real text, including formulas and IPA. */
export function LessonVisual({
  visual,
  lessonId,
  reloadVisuals,
}: {
  visual: Visual
  lessonId: string
  reloadVisuals?: () => Promise<Visual[]>
}) {
  const titleId = useId()
  const api = useApi()
  const [url, setUrl] = useState(visual.url)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)

  async function reload() {
    setLoading(true)
    try {
      const visuals = reloadVisuals
        ? await reloadVisuals()
        : (await api.get<{ content: { visuals?: Visual[] } }>(`/learning/lessons/${lessonId}`))
            .content.visuals
      const updated = visuals?.find(
        (v) =>
          v.kind === visual.kind &&
          v.sectionIndex === visual.sectionIndex &&
          v.title === visual.title,
      )
      if (updated?.url) {
        setUrl(updated.url)
        setFailed(false)
      }
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <figure
      aria-labelledby={titleId}
      className="my-5 overflow-hidden rounded-2xl border border-violet-100 bg-violet-50/40"
    >
      <div className="border-b border-violet-100 px-4 py-3 sm:px-5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600">
          {visual.kind === 'process' ? 'Step by step' : 'Concept illustration'}
        </p>
        <h3 id={titleId} className="font-semibold text-slate-900">
          <MathText>{visual.title}</MathText>
        </h3>
      </div>
      {visual.kind === 'process' ? (
        <div className="p-4 sm:p-5">
          <p className="sr-only">{visual.alt}</p>
          <ol className="space-y-2">
            {visual.steps.map((step, index) => (
              <li key={index}>
                {index > 0 && (
                  <div
                    aria-hidden="true"
                    className="mb-2 pl-4 text-xl leading-none text-violet-400"
                  >
                    ↓
                  </div>
                )}
                <div className="flex min-w-0 gap-3 rounded-xl border border-violet-100 bg-white p-3">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      <MathText>{step.label}</MathText>
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      <MathText>{step.detail}</MathText>
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : url && !failed ? (
        // Private signed storage URLs are refreshed only through the authorized lesson API.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={visual.alt}
          width={1024}
          height={1024}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="max-h-[480px] w-full bg-white object-contain"
        />
      ) : (
        <div className="space-y-2 p-5 text-sm text-slate-600">
          <p>{visual.alt}</p>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="min-h-11 font-medium text-violet-700 underline disabled:opacity-50"
          >
            {loading ? 'Loading illustration…' : 'Reload illustration'}
          </button>
        </div>
      )}
      <figcaption className="border-t border-violet-100 bg-white/70 px-4 py-3 text-sm leading-relaxed text-slate-600 sm:px-5">
        <MathText>{visual.caption}</MathText>
      </figcaption>
    </figure>
  )
}
