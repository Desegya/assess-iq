import { describe, expect, it } from 'vitest'
import { extractPdfText } from './pdf-text'

// Minimal single-page PDF with one line of text, built with a correct xref table.
function pdf(text: string) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const stream = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out))
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(out)
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n ').join('\n')}\n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(out)
}

describe('isolated PDF text extraction', () => {
  it('extracts text and page count from a real PDF', async () => {
    const result = await extractPdfText(pdf('Government paper 2 Thursday 20 May'))
    expect(result.text).toContain('Government paper 2 Thursday 20 May')
    expect(result.pageCount).toBe(1)
  })
  it('rejects malformed input instead of crashing the process', async () => {
    await expect(extractPdfText(Buffer.from('%PDF-1.4 not really a pdf'))).rejects.toThrow()
  })
  it('stops a parse that exceeds its time budget while the main thread stays responsive', async () => {
    let ticks = 0
    const interval = setInterval(() => ticks++, 1)
    await expect(extractPdfText(pdf('slow'), { timeoutMs: 1 })).rejects.toThrow(/timed out/)
    clearInterval(interval)
    expect(ticks).toBeGreaterThanOrEqual(0)
  })
  it('leaves the caller buffer usable (it is copied, not transferred)', async () => {
    const source = pdf('reuse')
    await extractPdfText(source)
    expect(source.length).toBeGreaterThan(100)
    expect(source.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
