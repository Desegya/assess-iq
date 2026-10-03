'use client'

import { useEffect, useRef, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'

interface Course {
  id: string
  title: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  source?: 'ai' | 'general' | 'fallback'
}

const SUGGESTED_PROMPTS = [
  'What topics does this course usually cover?',
  'Explain the hardest topic like I\'m in a hurry',
  'Quiz me on the basics',
]

export default function CourseChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const api = useApi()

  const [course, setCourse] = useState<Course | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<Course>(`/courses/${id}`).then(setCourse).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const message = input.trim()
    if (!message || sending) return

    setError(null)
    setInput('')
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { role: 'user', content: message }])
    setSending(true)

    try {
      const result = await api.post<{ source: 'ai' | 'general' | 'fallback'; reply: string }>(`/study/courses/${id}/chat`, {
        message,
        history,
      })
      setMessages(prev => [...prev, { role: 'assistant', content: result.reply, source: result.source }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach the study buddy')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-2xl flex flex-col h-[calc(100vh-160px)]">
      <div className="mb-4">
        <Link href={`/courses/${id}`} className="text-sm text-blue-600 font-semibold">
          ← Back to {course?.title ?? 'course'}
        </Link>
        <h1 className="font-heading text-2xl font-bold text-slate-900 mt-2">Ask AI</h1>
        <p className="text-slate-400 text-sm mt-1">
          Answers use your uploaded materials when you have them, and general course knowledge when you don&apos;t.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-sm text-slate-500 mb-4">Not sure where to start? Try one of these:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => setInput(p)}
                  className="text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full px-3.5 py-2 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-800'
              }`}
            >
              {m.role === 'assistant' && m.source === 'fallback' && (
                <p className="text-xs text-amber-600 font-semibold mb-1">Basic search (AI unavailable)</p>
              )}
              {m.role === 'assistant' && m.source === 'general' && (
                <p className="text-xs text-slate-400 font-semibold mb-1">From general knowledge, not your notes</p>
              )}
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}
        {sending && <p className="text-sm text-slate-400 px-2">Thinking…</p>}
        <div ref={bottomRef} />
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-3">{error}</div>}

      <form onSubmit={handleSend} className="flex items-center gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about your course material…"
          disabled={sending}
          className="input-base flex-1"
        />
        <button type="submit" disabled={sending || !input.trim()} className="btn-primary flex-shrink-0">
          Send
        </button>
      </form>
    </div>
  )
}
