'use client'

import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useApi } from '@/hooks/use-api'
import { MathText } from './MathText'

type AnswerSource = 'ai' | 'lesson' | 'general' | 'fallback'
interface Message {
  role: 'user' | 'assistant'
  content: string
  source?: AnswerSource
}
const SOURCE_LABEL: Record<AnswerSource, string> = {
  ai: 'With approved course notes',
  lesson: 'Explaining the current lesson',
  general: 'General AI explanation',
  fallback: 'Basic text search — AI unavailable',
}

export function StudyQuestions({
  courseId,
  topicId,
  lessonId,
  documentId,
  contextRef,
  defaultPassage,
  embedded = false,
}: {
  courseId: string
  topicId?: string
  lessonId?: string
  documentId?: string | null
  contextRef: RefObject<HTMLElement | null>
  defaultPassage?: string | null
  embedded?: boolean
}) {
  const api = useApi()
  const titleId = useId()
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [quote, setQuote] = useState('')
  const [sending, setSending] = useState(false)
  const [pending, setPending] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [keyboardLayout, setKeyboardLayout] = useState<{ bottom: number; height: number } | null>(
    null,
  )
  const launcher = useRef<HTMLButtonElement>(null)
  const question = useRef<HTMLTextAreaElement>(null)
  const panel = useRef<HTMLElement>(null)
  const conversation = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const selection = useRef('')
  const length = Array.from(input.trim()).length

  function captureSelection() {
    const selected = window.getSelection()
    const root = contextRef.current
    selection.current =
      selected?.anchorNode &&
      selected.focusNode &&
      root?.contains(selected.anchorNode) &&
      root.contains(selected.focusNode) &&
      !panel.current?.contains(selected.anchorNode)
        ? Array.from(selected.toString().trim()).slice(0, 2000).join('')
        : ''
  }
  function show() {
    if (!sending) {
      if (selection.current) setQuote(selection.current)
      else if (!messages.length)
        setQuote(
          Array.from(defaultPassage ?? '')
            .slice(0, 2000)
            .join(''),
        )
    }
    setOpen(true)
  }
  function close() {
    setOpen(false)
    requestAnimationFrame(() => launcher.current?.focus({ preventScroll: true }))
  }

  useEffect(() => {
    if (!open) return
    question.current?.focus({ preventScroll: true })
    function escape(event: KeyboardEvent) {
      const modal = document.querySelector('dialog[open]')
      if (modal && panel.current && !modal.contains(panel.current)) return
      if (event.key === 'Escape' && !event.isComposing && !event.defaultPrevented) {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        requestAnimationFrame(() => launcher.current?.focus({ preventScroll: true }))
      }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [open])
  useEffect(() => {
    if (open && conversation.current)
      conversation.current.scrollTop = conversation.current.scrollHeight
  }, [open, messages, sending])
  useEffect(() => {
    if (!open || !window.visualViewport) return
    const viewport = window.visualViewport
    function fitKeyboard() {
      const viewBottom = viewport.offsetTop + viewport.height
      const keyboardGap = Math.max(0, window.innerHeight - viewBottom)
      if (keyboardGap < 1 && viewport.height >= 500) {
        setKeyboardLayout(null)
        return
      }
      const bounds = embedded ? panel.current?.closest('dialog')?.getBoundingClientRect() : null
      const top = Math.max(bounds?.top ?? 0, viewport.offsetTop)
      const bottom = Math.min(bounds?.bottom ?? window.innerHeight, viewBottom)
      setKeyboardLayout({
        bottom: Math.max(0, (bounds?.bottom ?? window.innerHeight) - viewBottom) + 8,
        height: Math.max(160, Math.min(640, bottom - top - 16)),
      })
    }
    fitKeyboard()
    viewport.addEventListener('resize', fitKeyboard)
    viewport.addEventListener('scroll', fitKeyboard)
    return () => {
      viewport.removeEventListener('resize', fitKeyboard)
      viewport.removeEventListener('scroll', fitKeyboard)
    }
  }, [open, embedded])
  useEffect(() => {
    if (open && error) errorRef.current?.focus({ preventScroll: true })
  }, [open, error])

  async function send(event: React.FormEvent) {
    event.preventDefault()
    const message = input.trim()
    if (!message || length > 2000 || sending) return
    setSending(true)
    setPending(message)
    setError(null)
    try {
      const result = await api.post<{ source: AnswerSource; reply: string }>(
        `/study/courses/${encodeURIComponent(courseId)}/chat`,
        {
          message,
          topicId,
          lessonId,
          ...(documentId ? { documentId } : {}),
          ...(quote ? { selectedText: quote } : {}),
          history: messages
            .slice(-20)
            .map((item) => ({ role: item.role, content: item.content.slice(0, 4000) })),
        },
      )
      setMessages((previous) => [
        ...previous,
        { role: 'user', content: message },
        { role: 'assistant', content: result.reply, source: result.source },
      ])
      setInput('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not answer your question. Your draft is kept; try again.',
      )
    } finally {
      setSending(false)
      setPending('')
    }
  }

  return (
    <>
      <button
        ref={launcher}
        type="button"
        data-study-ask-launcher={embedded ? undefined : ''}
        aria-expanded={open}
        aria-controls={panelId}
        onPointerDown={captureSelection}
        onClick={(event) => {
          if (event.detail === 0) captureSelection()
          show()
        }}
        className={
          embedded
            ? 'btn-secondary'
            : 'fixed bottom-[calc(92px+env(safe-area-inset-bottom))] right-4 z-30 rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-violet-800 lg:bottom-6'
        }
      >
        {embedded ? 'Ask about these notes' : 'Ask about this topic'}
      </button>
      {open && (
        <aside
          id={panelId}
          ref={panel}
          data-study-question-panel
          aria-labelledby={titleId}
          style={
            keyboardLayout
              ? { bottom: keyboardLayout.bottom, height: keyboardLayout.height }
              : undefined
          }
          className={`${embedded ? 'absolute bottom-3 right-3' : 'fixed bottom-[calc(92px+env(safe-area-inset-bottom))] right-3 lg:bottom-6'} z-40 flex h-[min(70dvh,640px)] w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-2xl sm:w-[420px]`}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h2 id={titleId} className="font-semibold text-slate-900">
              Ask while you study
            </h2>
            <button
              type="button"
              aria-label="Close study questions"
              onClick={close}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-xl text-slate-600 hover:bg-slate-100"
            >
              ×
            </button>
          </header>
          <div
            ref={conversation}
            role="log"
            aria-label="Study conversation"
            aria-live="polite"
            aria-relevant="additions"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 text-sm"
          >
            {messages.length === 0 && (
              <p className="text-slate-500">
                Ask about a confusing idea, request a simpler explanation, or work through an
                example. Highlight a passage before opening this panel to include up to 2,000
                characters of it.
              </p>
            )}
            {quote && (
              <details className="rounded-xl bg-violet-50 p-3 text-xs text-violet-900">
                <summary className="cursor-pointer font-semibold">
                  Passage included with your question
                </summary>
                <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap">{quote}</p>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => setQuote('')}
                  className="mt-2 underline"
                >
                  Remove passage
                </button>
              </details>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`rounded-xl p-3 ${message.role === 'user' ? 'bg-violet-50 text-violet-950' : 'border border-slate-200 text-slate-800'}`}
              >
                <p className="mb-1 text-xs font-semibold text-slate-500">
                  {message.role === 'user' ? 'You' : SOURCE_LABEL[message.source ?? 'general']}
                </p>
                <MathText>{message.content}</MathText>
              </div>
            ))}
            {sending && (
              <>
                <div className="rounded-xl bg-violet-50 p-3">
                  <MathText>{pending}</MathText>
                </div>
                <p role="status" className="text-slate-500">
                  Thinking…
                </p>
              </>
            )}
          </div>
          <form onSubmit={send} className="shrink-0 space-y-2 border-t border-slate-200 p-4">
            <label className="block text-sm font-medium text-slate-700">
              Your question
              <textarea
                ref={question}
                value={input}
                disabled={sending}
                rows={2}
                onChange={(event) => {
                  setInput(event.target.value)
                  setError(null)
                }}
                aria-describedby={`${panelId}-limit`}
                aria-invalid={length > 2000}
                className="input-base mt-1 resize-none"
                placeholder="What does this mean?"
              />
            </label>
            <div className="flex items-center justify-between gap-2">
              <p
                id={`${panelId}-limit`}
                className={`text-xs ${length > 2000 ? 'text-red-700' : 'text-slate-500'}`}
              >
                {length.toLocaleString()} / 2,000 characters
                {length > 2000 ? ' — shorten your question' : ''}
              </p>
              <button
                type="submit"
                disabled={sending || length === 0 || length > 2000}
                className="btn-primary"
              >
                {sending ? 'Sending…' : 'Ask'}
              </button>
            </div>
            {error && (
              <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
          </form>
        </aside>
      )}
    </>
  )
}
