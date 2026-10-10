'use client'

import { useState } from 'react'
import { Icon } from '@/components/product/Icon'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
import { SOURCE_BADGE, type Topic } from './outline-types'

interface ArchivedTopic {
  id: string
  name: string
  parentTopicId: string | null
}

interface Revision {
  id: string
  reason: string
  createdAt: string
}

function SourceBadge({ topic }: { topic: Topic }) {
  const badge = SOURCE_BADGE[topic.source]
  return <span className={`badge ${badge.className} !text-[10px]`}>{badge.label}</span>
}

export function OutlineEditor({
  courseId,
  topics,
  onChanged,
  onFlashcards,
  flashcardsBusyFor,
}: {
  courseId: string
  topics: Topic[]
  onChanged: () => void
  onFlashcards: (topicId: string) => void
  flashcardsBusyFor: string | null
}) {
  const api = useApi()
  const [editing, setEditing] = useState(false)
  const [showAi, setShowAi] = useState(true)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null)
  const [subName, setSubName] = useState('')
  const [newTopic, setNewTopic] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [archived, setArchived] = useState<ArchivedTopic[] | null>(null)
  const [revisions, setRevisions] = useState<Revision[] | null>(null)

  const topLevel = topics.filter((t) => !t.parentTopicId).sort((a, b) => a.order - b.order)
  const childrenOf = (id: string) =>
    topics
      .filter((t) => t.parentTopicId === id && (showAi || t.source !== 'AI_EXPANDED'))
      .sort((a, b) => a.order - b.order)
  const hasAiExpansion = topics.some((t) => t.source === 'AI_EXPANDED')
  const expandable = topLevel.filter((t) => !topics.some((c) => c.parentTopicId === t.id))

  async function act(key: string, fn: () => Promise<unknown>, success?: string) {
    setError(null)
    setNotice(null)
    setBusy(key)
    try {
      await fn()
      if (success) setNotice(success)
      onChanged()
      // Archived list and history are stale after any change
      setArchived(null)
      setRevisions(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  function move(list: Topic[], index: number, delta: -1 | 1) {
    const next = [...list]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item!)
    void act(`move-${item!.id}`, () =>
      api.post(`/courses/${courseId}/topics/reorder`, { topicIds: next.map((t) => t.id) }),
    )
  }

  function saveRename(e: React.FormEvent) {
    e.preventDefault()
    if (!renaming?.name.trim()) return
    const { id, name } = renaming
    void act(`rename-${id}`, async () => {
      await api.patch(`/topics/${id}`, { name: name.trim() })
      setRenaming(null)
    })
  }

  function remove(topic: Topic) {
    const hasChildren = topics.some((t) => t.parentTopicId === topic.id)
    if (!window.confirm(`Remove "${topic.name}"${hasChildren ? ' and its subtopics' : ''}?`)) return
    void act(`remove-${topic.id}`, async () => {
      const r = await api.del<{ archived: boolean }>(`/topics/${topic.id}`)
      if (r.archived)
        setNotice(
          `"${topic.name}" was archived because it has study progress. Restore it from Archived topics.`,
        )
    })
  }

  function addSubtopic(e: React.FormEvent, parentTopicId: string) {
    e.preventDefault()
    if (!subName.trim()) return
    void act(`sub-${parentTopicId}`, async () => {
      await api.post(`/courses/${courseId}/topics`, { name: subName.trim(), parentTopicId })
      setSubName('')
      setAddingSubTo(null)
    })
  }

  function addTopic(e: React.FormEvent) {
    e.preventDefault()
    if (!newTopic.trim()) return
    void act('add', async () => {
      await api.post(`/courses/${courseId}/topics`, { name: newTopic.trim() })
      setNewTopic('')
    })
  }

  function expand(topicId?: string) {
    void act(topicId ? `expand-${topicId}` : 'expand-all', async () => {
      const r = await api.post<{ createdSubtopics: number }>(
        `/study/courses/${courseId}/outline/expand`,
        topicId ? { topicId } : {},
      )
      setShowAi(true)
      setNotice(
        `Added ${r.createdSubtopics} AI subtopics. They're marked “AI expansion” and your original outline is unchanged.`,
      )
    })
  }

  async function toggleArchived() {
    if (archived) return setArchived(null)
    setArchived(
      await api.get<ArchivedTopic[]>(`/courses/${courseId}/topics/archived`).catch(() => []),
    )
  }

  async function toggleHistory() {
    if (revisions) return setRevisions(null)
    setRevisions(
      await api.get<Revision[]>(`/courses/${courseId}/outline/revisions`).catch(() => []),
    )
  }

  function renderName(topic: Topic, className: string) {
    if (editing && renaming?.id === topic.id) {
      return (
        <form onSubmit={saveRename} className="flex items-center gap-2 flex-1 min-w-0">
          <input
            autoFocus
            value={renaming.name}
            onChange={(e) => setRenaming({ id: topic.id, name: e.target.value })}
            aria-label="Topic name"
            className="input-base !py-1 flex-1 min-w-0"
          />
          <button type="submit" disabled={!!busy} className="text-xs font-semibold text-violet-600">
            Save
          </button>
          <button
            type="button"
            onClick={() => setRenaming(null)}
            className="text-xs text-slate-400"
          >
            Cancel
          </button>
        </form>
      )
    }
    return (
      <button
        type="button"
        disabled={!editing}
        onClick={() => setRenaming({ id: topic.id, name: topic.name })}
        className={`${className} text-left enabled:hover:text-violet-600 disabled:cursor-default`}
        title={editing ? 'Rename' : undefined}
      >
        {topic.name}
      </button>
    )
  }

  const editBtn =
    'compact-action gap-1 text-xs font-semibold text-slate-500 hover:text-violet-600 disabled:opacity-30'

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {topLevel.length > 0 && (
          <button
            onClick={() => setEditing((e) => !e)}
            className={
              editing ? 'btn-primary !py-1.5 !px-3 text-xs' : 'btn-secondary !py-1.5 !px-3 text-xs'
            }
          >
            {editing ? 'Done editing' : 'Edit outline'}
          </button>
        )}
        {expandable.length > 0 && (
          <button
            onClick={() => expand()}
            disabled={!!busy}
            className="btn-secondary !py-1.5 !px-3 text-xs"
          >
            {busy === 'expand-all' ? (
              'Expanding…'
            ) : (
              <>
                <Icon name="spark" className="h-4 w-4" />
                Expand with AI
              </>
            )}
          </button>
        )}
        {hasAiExpansion && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto cursor-pointer">
            <input type="checkbox" checked={showAi} onChange={(e) => setShowAi(e.target.checked)} />
            Show AI expansion
          </label>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-3"
        >
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-violet-50 border border-violet-100 text-violet-800 text-sm rounded-xl px-4 py-3 mb-3">
          {notice}
        </div>
      )}

      <ol className="space-y-2">
        {topLevel.map((topic, i) => {
          const children = childrenOf(topic.id)
          return (
            <li key={topic.id} className="bg-slate-50 rounded-xl px-4 py-3">
              <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:flex-wrap">
                <div className="w-full min-w-0 flex-1 sm:w-auto">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-400">{i + 1}.</span>
                    {renderName(topic, 'text-sm font-semibold text-slate-800')}
                    {!(editing && renaming?.id === topic.id) && <SourceBadge topic={topic} />}
                  </div>
                  {topic.description && (
                    <p className="text-xs text-slate-400 mt-0.5 ml-5">{topic.description}</p>
                  )}
                </div>
                {!editing ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/topics/${topic.id}/learn`}
                      className="text-xs text-violet-600 font-semibold"
                    >
                      Learn
                    </Link>
                    <Link
                      href={`/topics/${topic.id}/quiz`}
                      className="text-xs text-violet-600 font-semibold"
                    >
                      Quiz
                    </Link>
                    <button
                      onClick={() => onFlashcards(topic.id)}
                      disabled={flashcardsBusyFor === topic.id}
                      className="text-xs text-violet-600 font-semibold disabled:opacity-60"
                    >
                      {flashcardsBusyFor === topic.id ? 'Generating…' : 'Flashcards'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => move(topLevel, i, -1)}
                      disabled={i === 0 || !!busy}
                      className={editBtn}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(topLevel, i, 1)}
                      disabled={i === topLevel.length - 1 || !!busy}
                      className={editBtn}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => {
                        setAddingSubTo(topic.id)
                        setSubName('')
                      }}
                      disabled={!!busy}
                      className={editBtn}
                    >
                      + Subtopic
                    </button>
                    <button onClick={() => expand(topic.id)} disabled={!!busy} className={editBtn}>
                      {busy === `expand-${topic.id}` ? (
                        'Expanding…'
                      ) : (
                        <>
                          <Icon name="spark" className="h-4 w-4" />
                          Expand
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => remove(topic)}
                      disabled={!!busy}
                      className="text-xs font-semibold text-red-500 disabled:opacity-30"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {children.length > 0 && (
                <ul className="mt-2 ml-5 space-y-1 border-l-2 border-slate-200 pl-3">
                  {children.map((sub, j) => (
                    <li
                      key={sub.id}
                      className="flex items-center justify-between gap-2 flex-wrap py-0.5"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                        {renderName(sub, 'text-[13px] text-slate-600')}
                        {!(editing && renaming?.id === sub.id) && sub.source !== topic.source && (
                          <SourceBadge topic={sub} />
                        )}
                      </div>
                      {editing && (
                        <div className="flex flex-wrap items-center gap-2.5">
                          <button
                            onClick={() => move(children, j, -1)}
                            disabled={j === 0 || !!busy}
                            className={editBtn}
                            aria-label="Move up"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => move(children, j, 1)}
                            disabled={j === children.length - 1 || !!busy}
                            className={editBtn}
                            aria-label="Move down"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => remove(sub)}
                            disabled={!!busy}
                            className="text-xs font-semibold text-red-500 disabled:opacity-30"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {editing && addingSubTo === topic.id && (
                <form
                  onSubmit={(e) => addSubtopic(e, topic.id)}
                  className="flex flex-wrap items-center gap-2 mt-2 sm:ml-5"
                >
                  <input
                    autoFocus
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder="Subtopic name"
                    aria-label="Subtopic name"
                    className="input-base !py-1 flex-1"
                  />
                  <button
                    type="submit"
                    disabled={!!busy}
                    className="text-xs font-semibold text-violet-600"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingSubTo(null)}
                    className="text-xs text-slate-400"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </li>
          )
        })}
      </ol>

      <form onSubmit={addTopic} className="flex gap-2 mt-3">
        <input
          value={newTopic}
          onChange={(e) => setNewTopic(e.target.value)}
          placeholder="Add a topic yourself"
          aria-label="New topic name"
          className="input-base min-w-0 flex-1"
        />
        <button type="submit" disabled={!!busy || !newTopic.trim()} className="btn-secondary">
          {busy === 'add' ? 'Adding…' : '+ Add'}
        </button>
      </form>

      {topLevel.length > 0 && (
        <div className="flex gap-4 mt-4 text-xs">
          <button
            onClick={() => void toggleArchived()}
            className="text-slate-500 font-semibold hover:text-violet-600"
          >
            {archived ? 'Hide archived topics' : 'Archived topics'}
          </button>
          <button
            onClick={() => void toggleHistory()}
            className="text-slate-500 font-semibold hover:text-violet-600"
          >
            {revisions ? 'Hide history' : 'Outline history'}
          </button>
        </div>
      )}

      {archived && (
        <div className="mt-3 rounded-xl border border-slate-200 p-4">
          {archived.length === 0 ? (
            <p className="text-xs text-slate-400">
              Nothing archived. Topics you remove after studying them land here, with progress kept.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {archived.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className={t.parentTopicId ? 'text-slate-500 pl-4' : 'text-slate-700'}>
                    {t.name}
                  </span>
                  <button
                    onClick={() =>
                      void act(
                        `restore-${t.id}`,
                        () => api.post(`/topics/${t.id}/restore`, {}),
                        `Restored "${t.name}"`,
                      )
                    }
                    disabled={!!busy}
                    className="text-xs font-semibold text-violet-600"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {revisions && (
        <div className="mt-3 rounded-xl border border-slate-200 p-4">
          {revisions.length === 0 ? (
            <p className="text-xs text-slate-400">No changes yet.</p>
          ) : (
            <ul className="space-y-1">
              {revisions.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600">{r.reason}</span>
                  <span className="text-slate-400 flex-shrink-0">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
