import { createRequire } from 'module'
import { join } from 'path'
import { Worker } from 'worker_threads'

export interface PdfText {
  text: string
  pageCount: number
}

export interface PdfLimits {
  timeoutMs?: number
  maxPages?: number
  maxHeapMb?: number
}

// Runs in the worker. pdf-parse bundles an old PDF.js; parsing untrusted files
// there keeps a hung or memory-hungry document from blocking the API's event
// loop, which also drives mock expiry and written marking.
const WORKER_SOURCE = `
const { parentPort, workerData } = require('worker_threads')
const pdfParse = require(workerData.modulePath)
// A standalone Uint8Array: small Buffers are pooled views (non-zero byteOffset), which this PDF.js misreads.
pdfParse(workerData.bytes, { max: workerData.maxPages })
  .then(r => parentPort.postMessage({ ok: true, text: r.text, pageCount: r.numpages }))
  .catch(e => parentPort.postMessage({ ok: false, error: String(e && e.message || e).slice(0, 200) }))
`

// Resolved from the app directory so this works from compiled output and under the test runner.
const PDF_PARSE = createRequire(join(process.cwd(), 'index.js')).resolve('pdf-parse')

/**
 * Extracts PDF text with a wall-clock timeout, a heap cap and a page limit.
 * This is containment for availability, not a security sandbox: the worker
 * shares the process, so the parser itself must still be kept up to date.
 */
export function extractPdfText(buffer: Buffer, limits: PdfLimits = {}): Promise<PdfText> {
  const { timeoutMs = 20_000, maxPages = 300, maxHeapMb = 256 } = limits
  return new Promise((resolve, reject) => {
    // A fresh copy: pooled Buffers are views over shared memory, and older PDF.js expects its own bytes.
    const bytes = new Uint8Array(buffer)
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { bytes, maxPages, modulePath: PDF_PARSE },
      transferList: [bytes.buffer],
      resourceLimits: { maxOldGenerationSizeMb: maxHeapMb, maxYoungGenerationSizeMb: 32 },
      stdout: true,
      stderr: true,
    })
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      fn()
    }
    const timer = setTimeout(() => finish(() => reject(new Error('PDF parsing timed out'))), timeoutMs)
    worker.once('message', (m: { ok: boolean; text?: string; pageCount?: number; error?: string }) =>
      finish(() =>
        m.ok ? resolve({ text: m.text ?? '', pageCount: m.pageCount ?? 0 }) : reject(new Error(`Unreadable PDF: ${m.error}`)),
      ),
    )
    worker.once('error', (err) => finish(() => reject(new Error(`PDF parsing failed: ${err.message}`))))
    worker.once('exit', (code) => finish(() => reject(new Error(`PDF parser stopped (code ${code})`))))
  })
}
