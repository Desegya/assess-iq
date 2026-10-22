/** Polls until `done()` is true or the timeout elapses; used to drain workers on shutdown. */
export async function waitUntil(done: () => boolean, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  while (!done() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100))
}
