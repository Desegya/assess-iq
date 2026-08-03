'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/use-api'

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
  { rating: 'good', label: 'Good', className: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  { rating: 'easy', label: 'Easy', className: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
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
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load flashcards'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRate(rating: Rating) {
    const card = cards?.[index]
    if (!card) return
    setSubmitting(true)
    try {
      await api.post(`/study/flashcards/${card.id}/review`, { rating })
      setReviewedCount(c => c + 1)
      setFlipped(false)
      setIndex(i => i + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
  if (cards === null) return <p className="text-slate-500 text-sm">Loading…</p>

  const card = cards[index]

  if (!card) {
    return (
      <div className="max-w-lg">
        <div className="card p-10 text-center">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-slate-800 font-semibold">
            {reviewedCount > 0 ? `Reviewed ${reviewedCount} card(s)` : 'No flashcards due right now'}
          </p>
          <p className="text-slate-400 text-sm mt-1">
            Generate more from a topic on your course page, or check back later.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading text-2xl font-bold text-slate-900">Flashcards</h1>
        <span className="text-sm text-slate-400">
          {index + 1} / {cards.length}
        </span>
      </div>

      {(card.course || card.topic) && (
        <p className="text-xs text-indigo-600 font-semibold mb-2">
          {card.course?.title}
          {card.topic ? ` · ${card.topic.name}` : ''}
        </p>
      )}

      <div
        className="card p-10 min-h-[220px] flex items-center justify-center text-center cursor-pointer"
        onClick={() => setFlipped(f => !f)}
      >
        <p className="text-lg font-medium text-slate-900">{flipped ? card.back : card.front}</p>
      </div>

      {!flipped ? (
        <button onClick={() => setFlipped(true)} className="btn-primary w-full mt-4">
          Show answer
        </button>
      ) : (
        <div className="grid grid-cols-4 gap-2 mt-4">
          {RATING_BUTTONS.map(b => (
            <button
              key={b.rating}
              disabled={submitting}
              onClick={() => handleRate(b.rating)}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${b.className}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
