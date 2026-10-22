/**
 * Autosave for timed mocks. Framework-free so it can be tested with node:test.
 *
 * Guarantees:
 * - "Saved" is shown only after the server acknowledged every local change.
 * - One request is in flight at a time; each carries only answers that differ
 *   from the last acknowledged state, plus the current flags/selection.
 * - Throttling, server errors and dropped connections are retried with
 *   backoff and never discard local answers.
 * - A version conflict (another tab or a lost response) reloads the server
 *   state and replays local unsaved answers on top instead of stopping.
 * - Unsaved answers are also kept in local storage, so a refresh or crash
 *   while offline can restore them.
 */

export interface SaveBody {
  expectedVersion: number
  answers: { questionId: string; answer: string }[]
  flags: string[]
  selectedQuestions?: string[]
}

export interface ServerAttempt {
  status: string
  version: number
  answers: Record<string, string>
  flags: string[]
  selectedQuestions?: string[]
}

export interface SaveTransport {
  save(body: SaveBody): Promise<{ version: number }>
  reload(): Promise<ServerAttempt>
}

export type SaveStatus =
  | { kind: 'saved'; at: Date }
  | { kind: 'saving'; unsaved: number }
  | { kind: 'unsaved'; unsaved: number }
  | { kind: 'retrying'; unsaved: number; inSeconds: number; reason: string }
  | { kind: 'ended'; unsaved: number }
  | { kind: 'error'; unsaved: number; message: string }

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface AutosaveOptions {
  transport: SaveTransport
  attemptId: string
  initial: ServerAttempt
  onStatus: (status: SaveStatus) => void
  /** Called when the server says the attempt is over (submitted elsewhere or time expired). */
  onEnded: (server: ServerAttempt, unsaved: number) => void
  /** Called after a conflict reload so the UI can show merged answers. */
  onMerged?: (state: { answers: Record<string, string>; flags: string[]; selected: string[] }) => void
  storage?: KeyValueStore | null
  debounceMs?: number
  maxWaitMs?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

interface HttpLikeError {
  status?: number
  retryAfterSeconds?: number
  message?: string
}

export class MockAutosave {
  private confirmed: Record<string, string>
  private local: Record<string, string>
  private confirmedFlags: string[]
  private flags: string[]
  private confirmedSelected: string[]
  private selected: string[]
  private version: number
  private inFlight: Promise<boolean> | null = null
  private timer: unknown = null
  private firstChangeAt = 0
  private failures = 0
  private ended = false
  private disposed = false
  private readonly o: Required<Pick<AutosaveOptions, 'debounceMs' | 'maxWaitMs' | 'setTimer' | 'clearTimer'>> & AutosaveOptions
  private readonly backupKey: string

  constructor(options: AutosaveOptions) {
    this.o = {
      debounceMs: 1500,
      maxWaitMs: 8000,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      ...options,
    }
    this.backupKey = `nightklass:mock-unsaved:${options.attemptId}`
    this.version = options.initial.version
    this.confirmed = { ...options.initial.answers }
    this.local = { ...options.initial.answers }
    this.confirmedFlags = [...options.initial.flags]
    this.flags = [...options.initial.flags]
    this.confirmedSelected = [...(options.initial.selectedQuestions ?? [])]
    this.selected = [...this.confirmedSelected]
    this.restoreBackup()
  }

  get answers() {
    return { ...this.local }
  }
  get currentFlags() {
    return [...this.flags]
  }
  get currentSelected() {
    return [...this.selected]
  }

  unsavedCount() {
    const keys = new Set([...Object.keys(this.local), ...Object.keys(this.confirmed)])
    let n = 0
    for (const k of keys) if ((this.local[k] ?? '') !== (this.confirmed[k] ?? '')) n++
    if (!sameSet(this.flags, this.confirmedFlags)) n++
    if (!sameSet(this.selected, this.confirmedSelected)) n++
    return n
  }

  setAnswer(questionId: string, answer: string) {
    this.local[questionId] = answer
    this.changed()
  }
  setFlags(flags: string[]) {
    this.flags = [...flags]
    this.changed()
  }
  setSelected(selected: string[]) {
    this.selected = [...selected]
    this.changed()
  }

  /** Saves now. Resolves true when every local change is acknowledged by the server. */
  async flush(): Promise<boolean> {
    this.cancelTimer()
    if (this.ended || this.disposed) return this.unsavedCount() === 0
    if (this.inFlight) {
      await this.inFlight
      return this.unsavedCount() === 0 ? true : this.flush()
    }
    if (!this.unsavedCount()) {
      this.clearBackup()
      return true
    }
    this.inFlight = this.send().finally(() => {
      this.inFlight = null
    })
    const ok = await this.inFlight
    // Changes made while the request was in flight are saved next.
    if (ok && this.unsavedCount() && !this.ended) return this.flush()
    return ok && !this.unsavedCount()
  }

  dispose() {
    this.disposed = true
    this.cancelTimer()
  }

  private changed() {
    if (this.ended) return
    this.writeBackup()
    this.emit({ kind: 'unsaved', unsaved: this.unsavedCount() })
    if (!this.firstChangeAt) this.firstChangeAt = Date.now()
    // Debounce typing, but never hold changes longer than maxWaitMs.
    const wait = Math.max(0, Math.min(this.o.debounceMs, this.firstChangeAt + this.o.maxWaitMs - Date.now()))
    this.schedule(wait)
  }

  private async send(): Promise<boolean> {
    const answers = Object.keys(this.local)
      .filter((k) => (this.local[k] ?? '') !== (this.confirmed[k] ?? ''))
      .map((questionId) => ({ questionId, answer: this.local[questionId] ?? '' }))
    const flags = [...this.flags]
    const selectionChanged = !sameSet(this.selected, this.confirmedSelected)
    const selected = [...this.selected]
    const body: SaveBody = {
      expectedVersion: this.version,
      answers,
      flags,
      ...(selectionChanged ? { selectedQuestions: selected } : {}),
    }
    this.emit({ kind: 'saving', unsaved: this.unsavedCount() })
    try {
      const response = await this.o.transport.save(body)
      this.version = response.version
      for (const a of answers) this.confirmed[a.questionId] = a.answer
      this.confirmedFlags = flags
      if (selectionChanged) this.confirmedSelected = selected
      this.failures = 0
      this.firstChangeAt = 0
      if (!this.unsavedCount()) {
        this.clearBackup()
        this.emit({ kind: 'saved', at: new Date() })
      } else this.emit({ kind: 'unsaved', unsaved: this.unsavedCount() })
      return true
    } catch (raw) {
      return this.handleFailure(raw as HttpLikeError)
    }
  }

  private async handleFailure(err: HttpLikeError): Promise<boolean> {
    const status = err.status ?? 0
    // 409 means either a version conflict (another tab saved, or our previous
    // response was lost after the server applied it) or that the attempt ended.
    // Reloading the server state distinguishes the two.
    if (status === 409) return this.reloadAfterConflict()
    if (status === 0 || status === 429 || status >= 500) {
      this.failures++
      const backoff = Math.min(30, 2 ** this.failures)
      const wait = Math.max(backoff, err.retryAfterSeconds ?? 0)
      this.emit({
        kind: 'retrying',
        unsaved: this.unsavedCount(),
        inSeconds: wait,
        reason: status === 0 ? 'offline' : status === 429 ? 'busy' : 'server',
      })
      this.schedule(wait * 1000)
      return false
    }
    // Unexpected rejection (e.g. validation): keep the answers and tell the learner.
    this.emit({ kind: 'error', unsaved: this.unsavedCount(), message: err.message ?? 'Could not save' })
    return false
  }

  private async reloadAfterConflict(): Promise<boolean> {
    let server: ServerAttempt
    try {
      server = await this.o.transport.reload()
    } catch (raw) {
      return this.handleFailure(raw as HttpLikeError)
    }
    if (server.status !== 'IN_PROGRESS') {
      this.ended = true
      const unsaved = this.unsavedCount()
      this.cancelTimer()
      this.emit({ kind: 'ended', unsaved })
      this.o.onEnded(server, unsaved)
      return false
    }
    // Keep our unsaved edits; everything else follows the server.
    const pending = Object.keys(this.local).filter((k) => (this.local[k] ?? '') !== (this.confirmed[k] ?? ''))
    const flagsDirty = !sameSet(this.flags, this.confirmedFlags)
    const selectionDirty = !sameSet(this.selected, this.confirmedSelected)
    this.version = server.version
    this.confirmed = { ...server.answers }
    const merged = { ...server.answers }
    for (const k of pending) merged[k] = this.local[k] ?? ''
    this.local = merged
    this.confirmedFlags = [...server.flags]
    if (!flagsDirty) this.flags = [...server.flags]
    this.confirmedSelected = [...(server.selectedQuestions ?? [])]
    if (!selectionDirty) this.selected = [...this.confirmedSelected]
    this.o.onMerged?.({ answers: this.answers, flags: this.currentFlags, selected: this.currentSelected })
    if (!this.unsavedCount()) {
      this.clearBackup()
      this.emit({ kind: 'saved', at: new Date() })
      return true
    }
    return this.send()
  }

  private schedule(ms: number) {
    this.cancelTimer()
    if (this.disposed || this.ended) return
    this.timer = this.o.setTimer(() => {
      this.timer = null
      void this.flush()
    }, ms)
  }

  private cancelTimer() {
    if (this.timer !== null) this.o.clearTimer(this.timer)
    this.timer = null
  }

  private emit(status: SaveStatus) {
    if (!this.disposed) this.o.onStatus(status)
  }

  private writeBackup() {
    try {
      const answers: Record<string, string> = {}
      for (const k of Object.keys(this.local)) if ((this.local[k] ?? '') !== (this.confirmed[k] ?? '')) answers[k] = this.local[k] ?? ''
      this.o.storage?.setItem(this.backupKey, JSON.stringify({ answers, flags: this.flags, selected: this.selected, at: Date.now() }))
    } catch {
      // Storage can be unavailable (private mode, quota); the server copy still applies.
    }
  }

  private clearBackup() {
    try {
      this.o.storage?.removeItem(this.backupKey)
    } catch {
      /* see writeBackup */
    }
  }

  private restoreBackup() {
    try {
      const raw = this.o.storage?.getItem(this.backupKey)
      if (!raw) return
      const backup = JSON.parse(raw) as { answers?: Record<string, string>; flags?: string[]; selected?: string[] }
      for (const [k, v] of Object.entries(backup.answers ?? {})) if (typeof v === 'string') this.local[k] = v
      if (Array.isArray(backup.flags)) this.flags = backup.flags.filter((f) => typeof f === 'string')
      if (Array.isArray(backup.selected)) this.selected = backup.selected.filter((f) => typeof f === 'string')
    } catch {
      this.clearBackup()
    }
  }
}

function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((x) => s.has(x))
}

export function describeSaveStatus(status: SaveStatus | null): string {
  if (!status) return ''
  const plural = (n: number) => `${n} change${n === 1 ? '' : 's'}`
  switch (status.kind) {
    case 'saved':
      return `Saved at ${status.at.toLocaleTimeString()}`
    case 'saving':
      return `Saving ${plural(status.unsaved)}…`
    case 'unsaved':
      return `${plural(status.unsaved)} not saved yet`
    case 'retrying':
      return status.reason === 'offline'
        ? `Offline: ${plural(status.unsaved)} kept on this device. Retrying in ${status.inSeconds}s.`
        : `Server busy: ${plural(status.unsaved)} not saved yet. Retrying in ${status.inSeconds}s.`
    case 'ended':
      return status.unsaved ? `This mock has ended. ${plural(status.unsaved)} after your last save could not be recorded.` : 'This mock has ended.'
    case 'error':
      return `Not saved: ${status.message}. Your answers are kept on this page.`
  }
}
