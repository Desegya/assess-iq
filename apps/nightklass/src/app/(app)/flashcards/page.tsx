'use client'

import { MathText } from '@/components/product/MathText'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/product/Icon'
import { useApi } from '@/hooks/use-api'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { celebrate } from '@/lib/celebrate'

interface Flashcard {
  id: string
  front: string
  back: string
  topic: { id: string; name: string } | null
  course: { id: string; title: string } | null
}

type Rating = 'again' | 'hard' | 'good' | 'easy'

const RATING_BUTTONS: { rating: Rating; label: string; className: string }[] = [
  { rating: 'again', label: 'Again', className: 'bg-red-50 text-red-700 hover:bg-red-100' },
  { rating: 'hard', label: 'Hard', className: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
  {
    rating: 'good',
    label: 'Good',
    className: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  },
  { rating: 'easy', label: 'Easy', className: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
]

export default function FlashcardsPage() {
  const api = useApi()
  const [cards, setCards] = useState<Flashcard[] | null>(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewedCount, setReviewedCount] = useState(0)

  useEffect(() => {
    api
      .get<Flashcard[]>('/study/flashcards/due')
      .then(setCards)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load flashcards'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRate(rating: Rating) {
    const card = cards?.[index]
    if (!card) return
    setSubmitting(true)
    try {
      await api.post(`/study/flashcards/${card.id}/review`, { rating })
      const nextCount = reviewedCount + 1
      setReviewedCount(nextCount)
      setFlipped(false)
      setIndex((i) => i + 1)
      if (index + 1 >= (cards?.length ?? 0)) celebrate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  if (error)
    return (
      <div
        role="alert"
        className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
      >
        {error}
      </div>
    )
  if (cards === null)
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-11 w-full" />
      </div>
    )

  const card = cards[index]

  if (!card) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          illustration="celebrate"
          title={
            reviewedCount > 0
              ? `Nice — you reviewed ${reviewedCount} card${reviewedCount === 1 ? '' : 's'}`
              : 'All caught up'
          }
          subtitle="Generate more from a topic on your course page, or check back later."
          action={
            <Link href="/courses" className="btn-primary">
              <Icon name="book" />
              Explore your courses
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[.12em] text-violet-700">
        <Icon name="cards" className="h-4 w-4" />A little practice that sticks
      </p>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading text-2xl font-bold text-slate-900">Flashcards</h1>
        <span className="text-sm text-slate-400">
          {index + 1} / {cards.length}
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Flashcard review progress"
        aria-valuemin={0}
        aria-valuemax={cards.length}
        aria-valuenow={index}
        className="mb-6 h-1.5 overflow-hidden rounded-full bg-[#e9dff7]"
      >
        <div
          className="h-full bg-[#9060cf]"
          style={{ width: `${(index / cards.length) * 100}%` }}
        />
      </div>

      {(card.course || card.topic) && (
        <p className="text-xs text-violet-600 font-semibold mb-2">
          {card.course?.title}
          {card.topic ? ` · ${card.topic.name}` : ''}
        </p>
      )}

      <div
        className="flip-scene min-h-[320px] rounded-[20px]"
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Show question' : 'Reveal answer'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setFlipped((f) => !f)
          }
        }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div className={`flip-card cursor-pointer w-full h-[320px] ${flipped ? 'is-flipped' : ''}`}>
          <div
            aria-hidden={flipped}
            className="flip-face card w-full h-full p-6 sm:p-10 overflow-y-auto flex items-center justify-center text-center absolute inset-0"
          >
            <p className="max-h-full text-lg font-medium leading-relaxed text-slate-900">
              <MathText>{card.front}</MathText>
            </p>
          </div>
          <div
            aria-hidden={!flipped}
            className="flip-face flip-face-back card w-full h-full p-6 sm:p-10 overflow-y-auto flex items-center justify-center text-center !bg-[#f7f2ff]"
          >
            <p className="max-h-full text-lg font-medium leading-relaxed text-slate-900">
              <MathText>{card.back}</MathText>
            </p>
          </div>
        </div>
      </div>

      {!flipped ? (
        <button onClick={() => setFlipped(true)} className="btn-primary w-full mt-4">
          Show answer
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {RATING_BUTTONS.map((b) => (
            <button
              key={b.rating}
              disabled={submitting}
              onClick={() => handleRate(b.rating)}
              className={`min-h-11 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${b.className}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
