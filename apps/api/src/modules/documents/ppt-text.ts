import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { BadRequestException } from '@nestjs/common'

const execute = promisify(execFile)
type PptRunner = (
  file: string,
  args: string[],
  options: { timeout: number; maxBuffer: number; encoding: 'utf8' },
) => Promise<{ stdout: string }>

export async function extractPptText(
  buffer: Buffer,
  run: PptRunner = execute,
): Promise<{ text: string; pageCount: number }> {
  const directory = await mkdtemp(join(tmpdir(), 'nightklass-ppt-'))
  try {
    const file = join(directory, 'lecture.ppt')
    await writeFile(file, buffer)
    const { stdout } = await run(process.env.CATPPT_PATH ?? 'catppt', ['-d', 'utf-8', file], {
      timeout: 15_000,
      maxBuffer: 5 * 1024 * 1024,
      encoding: 'utf8',
    })
    const slides = stdout
      .split('\f')
      .map((text) => text.trim())
      .filter(Boolean)
    const text = slides.join('\n\n')
    if (!text) throw new Error('No slide text')
    return { text, pageCount: slides.length }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new BadRequestException(
        'Reading older PowerPoint (.ppt) files is unavailable on this server. Save the presentation as .pptx or PDF and upload it again.',
      )
    }
    throw new BadRequestException(
      'We could not read text from this PowerPoint file. If it is password-protected or contains only images, save a readable .pptx or PDF copy and try again.',
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
