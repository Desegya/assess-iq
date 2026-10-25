import { BadRequestException } from '@nestjs/common'
import { extractPdfText } from '../../common/pdf-text'
import mammoth from 'mammoth'
import JSZip from 'jszip'
import { DocumentFileValidator } from '../documents/document-file.validator'
import { MATERIAL_MAX_CHARS } from './exam-content.rules'

export async function extractExamMaterial(file: Express.Multer.File) {
  if (!file || file.size > 5 * 1024 * 1024 || !(await new DocumentFileValidator().isValid(file))) throw new BadRequestException('Upload a readable PDF, DOCX, PPTX or text file up to 5 MB')
  let body = ''
  try {
    if (file.mimetype === 'text/plain') body = file.buffer.toString('utf8')
    else if (file.mimetype === 'application/pdf') body = (await extractPdfText(file.buffer)).text
    else {
      const zip = await JSZip.loadAsync(file.buffer)
      const entries = Object.values(zip.files)
      const expanded = entries.reduce((n, e) => n + ((e as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0), 0)
      if (expanded > 20 * 1024 * 1024 || entries.length > 2000) throw new Error('Archive too large')
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        if (!zip.file('word/document.xml')) throw new Error('Invalid Word file')
        body = (await mammoth.extractRawText({ buffer: file.buffer })).value
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        const slides = entries.filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.name)).sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        body = (await Promise.all(slides.map(async e => [...(await e.async('string')).matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map(m => m[1]).join('\n')))).join('\n\n').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      } else throw new Error('Unsupported type')
    }
  } catch { throw new BadRequestException('Could not extract readable text. Use a text-based PDF, DOCX, PPTX or paste the notes.') }
  body = body.trim()
  if (body.length < 20) throw new BadRequestException('Could not find readable text in this file. Scanned PDFs need text extraction first.')
  if (body.length > MATERIAL_MAX_CHARS) throw new BadRequestException('This file has more than 500,000 characters of text. Upload it as two or more files.')
  return body
}
