import { access, readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { DocumentFileValidator } from './document-file.validator'
import { DocumentsService } from './documents.service'
import { extractPptText } from './ppt-text'

async function presentation() {
  const zip = new JSZip()
  zip.file('ppt/presentation.xml', '<p:presentation/>')
  zip.file('ppt/slides/slide2.xml', '<a:p><a:r><a:t>Second slide &amp; notes</a:t></a:r></a:p>')
  zip.file('ppt/slides/slide1.xml', '<a:p><a:r><a:t>Cell structure</a:t></a:r></a:p>')
  return zip.generateAsync({ type: 'nodebuffer' })
}
const file = (
  buffer: Buffer,
  originalname = 'lecture.pptx',
  mimetype = 'application/octet-stream',
) => ({ buffer, originalname, mimetype, size: buffer.length }) as Express.Multer.File
const validator = new DocumentFileValidator(async (buffer) =>
  (await import('file-type')).fileTypeFromBuffer(buffer),
)

describe('PowerPoint uploads', () => {
  it('accepts real .pptx files even when the browser supplies a generic MIME type', async () => {
    expect(await validator.isValid(file(await presentation()))).toBe(true)
    expect(
      await validator.isValid(file(await presentation(), 'LECTURE.PPTX', 'application/zip')),
    ).toBe(true)
    const zip = new JSZip().file('unrelated.txt', 'Not a presentation')
    expect(await validator.isValid(file(await zip.generateAsync({ type: 'nodebuffer' })))).toBe(
      false,
    )
    expect(await validator.isValid(file(Buffer.from('Not a presentation')))).toBe(false)
  })

  it('extracts slide text in presentation order and indexes it for lessons', async () => {
    const document = { id: 'slides', fileName: 'lecture.pptx' }
    const update = vi.fn(async ({ data }: { data: object }) => ({ ...document, ...data }))
    const uploadBuffer = vi.fn()
    const indexDocument = vi.fn().mockResolvedValue(undefined)
    const service = new DocumentsService(
      {
        course: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ title: 'Biology', subject: 'Biology', topics: [] }),
        },
        document: { create: vi.fn().mockResolvedValue(document), update },
      } as never,
      { uploadBuffer } as never,
      {
        assessCourseMaterial: vi
          .fn()
          .mockResolvedValue({ verdict: 'MATCH', reason: 'Biology slides' }),
      } as never,
      { indexDocument } as never,
    )
    const saved = await service.upload(file(await presentation()), { courseId: 'biology' }, {
      id: 'student',
      role: 'STUDENT',
    } as never)
    expect(saved).toMatchObject({
      status: 'READY',
      fileName: 'lecture.pptx',
      extractedText: 'Cell structure\n\nSecond slide & notes',
      pageCount: 2,
    })
    expect(uploadBuffer.mock.calls[0]![2]).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    )
    expect(indexDocument).toHaveBeenCalledWith(saved, expect.objectContaining({ id: 'student' }))
  })

  it('reports unreadable slide decks instead of claiming that an empty document is ready', async () => {
    const service = new DocumentsService(
      {
        document: {
          create: vi.fn().mockResolvedValue({ id: 'empty' }),
          update: vi.fn().mockResolvedValue({}),
        },
      } as never,
      { uploadBuffer: vi.fn() } as never,
      {} as never,
      {} as never,
    )
    const empty = new JSZip().file('ppt/slides/slide1.xml', '<a:p/>')
    await expect(
      service.upload(file(await empty.generateAsync({ type: 'nodebuffer' })), {}, {
        id: 'student',
        role: 'STUDENT',
      } as never),
    ).rejects.toThrow('selectable slide text')
  })
})

describe('legacy PowerPoint extraction', () => {
  it('runs without a shell, bounds extraction time, and removes temporary files', async () => {
    let path = ''
    const buffer = Buffer.from('test slide data')
    const run = vi.fn(async (_binary, args, options) => {
      path = args[2]
      expect(await readFile(path)).toEqual(buffer)
      expect(args.slice(0, 2)).toEqual(['-d', 'utf-8'])
      expect(options.timeout).toBe(15_000)
      return { stdout: 'Cell structure\fOrganelles\f' }
    })
    expect(await extractPptText(buffer, run)).toEqual({
      text: 'Cell structure\n\nOrganelles',
      pageCount: 2,
    })
    await expect(access(path)).rejects.toThrow()
  })

  it('explains how to recover when the legacy converter is unavailable or the file is unreadable', async () => {
    await expect(
      extractPptText(Buffer.from('slides'), async () => {
        throw Object.assign(new Error('Missing'), { code: 'ENOENT' })
      }),
    ).rejects.toThrow('Save the presentation as .pptx or PDF')
    await expect(
      extractPptText(Buffer.from('slides'), async () => ({ stdout: '' })),
    ).rejects.toThrow('could not read text')
  })

  it.skipIf(!process.env.PPT_TEST_FIXTURE || !process.env.CATPPT_PATH)(
    'reads a real legacy .ppt fixture with the production converter',
    async () => {
      const buffer = await readFile(process.env.PPT_TEST_FIXTURE!)
      expect(
        await validator.isValid(file(buffer, 'lecture.ppt', 'application/vnd.ms-powerpoint')),
      ).toBe(true)
      const extracted = await extractPptText(buffer)
      expect(extracted.text.length).toBeGreaterThan(20)
      expect(extracted.pageCount).toBeGreaterThan(0)
    },
  )
})
