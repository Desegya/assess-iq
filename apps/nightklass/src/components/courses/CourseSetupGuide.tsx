'use client'

import Link from 'next/link'

export function CourseSetupGuide({
  defaultOpen = false,
  onUseExample,
}: {
  defaultOpen?: boolean
  onUseExample?: () => void
}) {
  return (
    <details
      open={defaultOpen}
      className="my-5 rounded-2xl border border-violet-100 bg-violet-50/50 p-4 sm:p-5"
    >
      <summary className="min-h-11 cursor-pointer font-semibold text-slate-900">
        New to Nightklass? Start here
      </summary>
      <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-600">
        <li>
          <strong className="text-slate-900">Choose a course.</strong> For example, “BIO 101
          Introduction to Biology”. Use your own course title, select programme suggestions, or
          upload an outline.
        </li>
        <li>
          <strong className="text-slate-900">Add an exam date if you know it.</strong> It is
          optional. You can start with a semester plan and change the date later.
        </li>
        <li>
          <strong className="text-slate-900">Review your topics, then plan your study.</strong>{' '}
          Choose when you can study. Nightklass turns those topics into sessions; open a topic for
          notes, examples and practice questions.
        </li>
      </ol>
      <p className="mt-3 text-sm text-slate-600">
        Adding another course keeps the ones you already have. Use My Courses to switch, edit or
        delete a course.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {onUseExample && (
          <button type="button" onClick={onUseExample} className="btn-secondary text-sm">
            Try the example course
          </button>
        )}
        <Link
          href="/guide"
          className="inline-flex min-h-11 items-center text-sm font-medium text-violet-700 underline"
        >
          Read the quick guide
        </Link>
      </div>
      {onUseExample && (
        <p className="mt-2 text-xs text-slate-500">
          The example only fills in the form. Nothing is saved until you choose Create course.
        </p>
      )}
    </details>
  )
}
