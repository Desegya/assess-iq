import { FileValidator } from '@nestjs/common'

// Nest's FileTypeValidator detects type from magic numbers, which plain text doesn't have and legacy .doc reports
// as application/x-cfb, so both were always rejected. This checks binary formats by signature and text by content.
const BINARY_TYPES: Record<string, string[]> = {
  'application/pdf': ['application/pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
  ],
  'application/msword': ['application/x-cfb'],
}

export class DocumentFileValidator extends FileValidator<Record<string, never>> {
  constructor() {
    super({})
  }

  buildErrorMessage(file?: Express.Multer.File): string {
    return `Unsupported or unreadable file${file?.originalname ? ` "${file.originalname}"` : ''} — upload a PDF, Word, PowerPoint or text file`
  }

  async isValid(file?: Express.Multer.File): Promise<boolean> {
    if (!file?.buffer?.length) return false

    if (file.mimetype === 'text/plain') {
      // Text files have no signature: reject anything with NUL bytes in the first 8 KB (i.e. binary data)
      return !file.buffer.subarray(0, 8192).includes(0)
    }

    const accepted = BINARY_TYPES[file.mimetype]
    if (!accepted) return false
    try {
      const { fileTypeFromBuffer } = (await eval('import ("file-type")')) as typeof import('file-type')
      const detected = await fileTypeFromBuffer(file.buffer)
      return !!detected && accepted.includes(detected.mime)
    } catch {
      return false
    }
  }
}
