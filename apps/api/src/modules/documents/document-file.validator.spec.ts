import { describe, expect, it } from 'vitest'
import { DocumentFileValidator } from './document-file.validator'

const file = (mimetype: string, buffer: Buffer, originalname = 'upload') =>
  ({ mimetype, buffer, originalname, size: buffer.length }) as Express.Multer.File

describe('DocumentFileValidator', () => {
  // Production loads file-type via eval(import()), which Vitest's sandbox can't run; inject a normal import instead
  const validator = new DocumentFileValidator(async buffer => (await import('file-type')).fileTypeFromBuffer(buffer))

  it('accepts plain text (which has no file signature)', async () => {
    expect(await validator.isValid(file('text/plain', Buffer.from('BIO 223 lecture notes\nVariance…')))).toBe(true)
  })

  it('rejects binary data sent as text', async () => {
    expect(await validator.isValid(file('text/plain', Buffer.from([0x50, 0x4b, 0x00, 0x03, 0x04])))).toBe(false)
  })

  it('accepts a real PDF signature and rejects a spoofed one', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF')
    expect(await validator.isValid(file('application/pdf', pdf))).toBe(true)
    expect(await validator.isValid(file('application/pdf', Buffer.from('not really a pdf')))).toBe(false)
  })

  it('rejects types outside the allowed list and empty files', async () => {
    expect(await validator.isValid(file('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47])))).toBe(false)
    expect(await validator.isValid(file('text/plain', Buffer.alloc(0)))).toBe(false)
    expect(await validator.isValid(undefined)).toBe(false)
  })

  it('names the file in its error message', () => {
    expect(validator.buildErrorMessage(file('image/png', Buffer.alloc(1), 'photo.png'))).toContain('"photo.png"')
  })
})
