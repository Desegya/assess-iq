import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MockAutosave, describeSaveStatus, type SaveBody, type ServerAttempt, type SaveStatus } from './mock-autosave.ts'

// A fake server with the API's real semantics: version CAS, merged answers, deadline.
function server(initial: Partial<ServerAttempt> = {}) {
  const state: ServerAttempt = { status: 'IN_PROGRESS', version: 1, answers: {}, flags: [], selectedQuestions: [], ...initial }
  const calls: SaveBody[] = []
  let failNext: { status: number; message?: string; retryAfterSeconds?: number }[] = []
  let applyThenFail = false
  const transport = {
    async save(body: SaveBody) {
      calls.push(structuredClone(body))
      const f = failNext.shift()
      if (f) throw Object.assign(new Error(f.message ?? 'fail'), f)
      if (state.status !== 'IN_PROGRESS') throw Object.assign(new Error('This mock has ended; reload to view your result'), { status: 409 })
      if (body.expectedVersion !== state.version) throw Object.assign(new Error('Answers changed in another request. Reload before continuing.'), { status: 409 })
      for (const a of body.answers) state.answers[a.questionId] = a.answer
      state.flags = [...body.flags]
      if (body.selectedQuestions) state.selectedQuestions = [...body.selectedQuestions]
      state.version++
      if (applyThenFail) {
        applyThenFail = false
        throw Object.assign(new Error('network'), { status: 0 })
      }
      return { version: state.version }
    },
    async reload() {
      return structuredClone(state)
    },
  }
  return {
    state,
    calls,
    transport,
    fail: (...f: typeof failNext) => (failNext = f),
    loseNextResponse: () => (applyThenFail = true),
  }
}

function harness(s: ReturnType<typeof server>, storage?: Map<string, string>) {
  const statuses: SaveStatus[] = []
  const timers: (() => void)[] = []
  let ended: { unsaved: number } | null = null
  const store = storage && {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  }
  const autosave = new MockAutosave({
    transport: s.transport,
    attemptId: 'attempt-1',
    initial: structuredClone(s.state),
    onStatus: (x) => statuses.push(x),
    onEnded: (_server, unsaved) => (ended = { unsaved }),
    storage: store,
    setTimer: (fn) => timers.push(fn),
    clearTimer: () => undefined,
  })
  return { autosave, statuses, timers, get ended() { return ended }, last: () => statuses.at(-1)! }
}

test('sends only changed answers and reports saved only after acknowledgement', async () => {
  const s = server({ answers: { q1: 'A' }, version: 3 })
  const h = harness(s)
  h.autosave.setAnswer('q2', 'C')
  assert.equal(h.last().kind, 'unsaved')
  assert.equal(await h.autosave.flush(), true)
  assert.deepEqual(s.calls[0]!.answers, [{ questionId: 'q2', answer: 'C' }])
  assert.equal(s.calls[0]!.expectedVersion, 3)
  assert.equal(h.last().kind, 'saved')
  assert.deepEqual(s.state.answers, { q1: 'A', q2: 'C' })
})

test('retries throttling and outages with backoff and never drops answers', async () => {
  const s = server()
  const h = harness(s)
  s.fail({ status: 429, retryAfterSeconds: 5 }, { status: 503 }, { status: 0 })
  h.autosave.setAnswer('q1', 'B')
  assert.equal(await h.autosave.flush(), false)
  const first = h.last()
  assert.equal(first.kind, 'retrying')
  assert.equal(first.kind === 'retrying' && first.inSeconds, 5)
  assert.equal(await h.autosave.flush(), false)
  assert.equal(await h.autosave.flush(), false)
  assert.match(describeSaveStatus(h.last()), /Offline: 1 change kept on this device/)
  assert.equal(await h.autosave.flush(), true)
  assert.equal(s.state.answers.q1, 'B')
  assert.equal(h.last().kind, 'saved')
})

test('a lost response is reconciled without duplicating or overwriting answers', async () => {
  const s = server()
  const h = harness(s)
  h.autosave.setAnswer('q1', 'A')
  s.loseNextResponse()
  assert.equal(await h.autosave.flush(), false)
  // Retry carries the stale version: the server answers 409, the client reloads,
  // sees q1 already saved and finishes without resending.
  assert.equal(await h.autosave.flush(), true)
  assert.equal(s.state.answers.q1, 'A')
  assert.equal(s.state.version, 2)
  assert.equal(h.last().kind, 'saved')
})

test('another tab saving does not block this one; local unsaved edits win', async () => {
  const s = server({ answers: { q1: 'A' } })
  const h = harness(s)
  s.state.answers.q2 = 'D'
  s.state.version = 5
  h.autosave.setAnswer('q1', 'C')
  assert.equal(await h.autosave.flush(), true)
  assert.deepEqual(s.state.answers, { q1: 'C', q2: 'D' })
  assert.deepEqual(h.autosave.answers, { q1: 'C', q2: 'D' })
})

test('changes made while a save is in flight are saved afterwards', async () => {
  const s = server()
  const h = harness(s)
  h.autosave.setAnswer('q1', 'A')
  const pending = h.autosave.flush()
  h.autosave.setAnswer('q2', 'B')
  assert.equal(await pending, true)
  assert.deepEqual(s.state.answers, { q1: 'A', q2: 'B' })
  assert.equal(s.calls.length, 2)
})

test('expiry during an outage reports exactly what was not recorded', async () => {
  const s = server()
  const h = harness(s)
  h.autosave.setAnswer('q1', 'A')
  assert.equal(await h.autosave.flush(), true)
  s.fail({ status: 0 })
  h.autosave.setAnswer('q2', 'B')
  assert.equal(await h.autosave.flush(), false)
  s.state.status = 'GRADED'
  assert.equal(await h.autosave.flush(), false)
  assert.deepEqual(h.ended, { unsaved: 1 })
  assert.match(describeSaveStatus(h.last()), /1 change after your last save could not be recorded/)
  assert.deepEqual(s.state.answers, { q1: 'A' })
})

test('unsaved answers survive a page reload through local storage', async () => {
  const storage = new Map<string, string>()
  const s = server()
  s.fail({ status: 0 })
  const first = harness(s, storage)
  first.autosave.setAnswer('q1', 'C')
  assert.equal(await first.autosave.flush(), false)
  first.autosave.dispose()
  const second = harness(s, storage)
  assert.equal(second.autosave.answers.q1, 'C')
  assert.equal(second.autosave.unsavedCount(), 1)
  assert.equal(await second.autosave.flush(), true)
  assert.equal(s.state.answers.q1, 'C')
  assert.equal(storage.size, 0)
})

test('validation rejections keep answers and surface the message', async () => {
  const s = server()
  const h = harness(s)
  s.fail({ status: 400, message: 'Answer or flag does not belong to this paper' })
  h.autosave.setAnswer('q1', 'A')
  assert.equal(await h.autosave.flush(), false)
  assert.equal(h.last().kind, 'error')
  assert.equal(h.autosave.answers.q1, 'A')
})
