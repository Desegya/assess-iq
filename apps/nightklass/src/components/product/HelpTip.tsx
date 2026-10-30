import type { ReactNode } from 'react'

/** Native disclosure works with touch, keyboards and screen readers; no hover required. */
export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="relative inline-block align-middle text-left">
      <summary
        aria-label={`Help: ${label}`}
        className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-violet-700 [&::-webkit-details-marker]:hidden"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-violet-200 bg-violet-50"
        >
          ?
        </span>
        <span>{label}</span>
      </summary>
      <div className="relative z-10 mb-3 max-w-sm rounded-xl border border-violet-100 bg-violet-50 p-3 text-sm leading-relaxed text-slate-700">
        {children}
      </div>
    </details>
  )
}
