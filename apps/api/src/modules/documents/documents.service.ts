import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
import { AiService } from '../ai/ai.service'
import { AuthUser, UserRole } from '@assessiq/types'
import { DocumentType } from '@assessiq/db'
import { UploadDocumentDto } from './dto/upload-document.dto'
import { extractTopicsHeuristically } from './topic-extraction-fallback'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'

const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
])

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ai: AiService,
  ) {}

  // ─── Upload ────────────────────────────────────────────────────────────────

  async upload(file: Express.Multer.File, dto: UploadDocumentDto, user: AuthUser) {
    if (!user.organizationId && user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('You must belong to an organisation to upload documents')
    }
    if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
      throw new BadRequestException('File type not supported. Upload a PDF, DOCX, or TXT file.')
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File exceeds the 20 MB limit')
    }

    const fileType = this.detectFileType(file.mimetype)

    // Create record in UPLOADING state so the client can see progress
    const doc = await this.prisma.document.create({
      data: {
        organizationId: user.organizationId,
        uploadedById: user.id,
        courseId: dto.courseId ?? null,
        fileName: file.originalname,
        fileType,
        fileUrl: '',
        fileSizeBytes: file.size,
        status: 'UPLOADING',
      },
    })

    try {
      // ── 1. Store in R2 ─────────────────────────────────────────────────────
      const scopeKey = user.organizationId ?? `personal/${user.id}`
      const key = `${scopeKey}/documents/${doc.id}/${file.originalname}`
      await this.storage.uploadBuffer(key, file.buffer, file.mimetype)

      await this.prisma.document.update({
        where: { id: doc.id },
        data: { fileUrl: key, status: 'PROCESSING' },
      })

      // ── 2. Extract text ────────────────────────────────────────────────────
      const { text, pageCount } = await this.extractText(file.buffer, fileType)
      const chunks = this.chunkText(text)

      // ── 3. Mark READY ──────────────────────────────────────────────────────
      const ready = await this.prisma.document.update({
        where: { id: doc.id },
        data: {
          status: 'READY',
          extractedText: text,
          pageCount: pageCount ?? null,
          chunkCount: chunks.length,
        },
        include: {
          uploadedBy: { select: { id: true, name: true } },
          course: { select: { id: true, title: true } },
        },
      })

      this.logger.log(
        `Document ${doc.id} ready — ${chunks.length} chunks from ${file.originalname}`,
      )
      return ready
    } catch (err) {
      this.logger.error(`Failed to process document ${doc.id}`, err)
      await this.prisma.document
        .update({ where: { id: doc.id }, data: { status: 'FAILED' } })
        .catch(() => undefined)
      throw err
    }
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  async findAll(user: AuthUser, courseId?: string) {
    return this.prisma.document.findMany({
      where: {
        ...(user.organizationId
          ? { organizationId: user.organizationId }
          : { uploadedById: user.id }),
        ...(courseId ? { courseId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSizeBytes: true,
        status: true,
        pageCount: true,
        chunkCount: true,
        courseId: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
      },
    })
  }

  // ─── Single ────────────────────────────────────────────────────────────────

  async findOne(id: string, user: AuthUser) {
    const doc = await this.prisma.document.findFirst({
      where: user.organizationId
        ? { id, organizationId: user.organizationId }
        : { id, uploadedById: user.id },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
    })
    if (!doc) throw new NotFoundException('Document not found')
    return doc
  }

  // ─── Signed download URL ────────────────────────────────────────────────────

  async getDownloadUrl(id: string, user: AuthUser): Promise<{ url: string }> {
    const doc = await this.findOne(id, user)
    if (doc.status !== 'READY') {
      throw new BadRequestException('Document is not ready for download yet')
    }
    const url = await this.storage.getSignedDownloadUrl(doc.fileUrl)
    return { url }
  }

  // ─── Extract topics ─────────────────────────────────────────────────────────

  /**
   * Proposes candidate topics from a document's extracted text. Tries AI first;
   * falls back to a heuristic (no-AI) extraction if AI is unavailable or fails,
   * so this never blocks a student without a valid ANTHROPIC_API_KEY configured.
   * Proposals are not persisted — the caller reviews/edits before saving them as Topics.
   */
  async extractTopics(id: string, user: AuthUser) {
    const doc = await this.findOne(id, user)
    if (doc.status !== 'READY') {
      throw new BadRequestException('Document is not ready yet — wait for text extraction to finish')
    }
    if (!doc.extractedText) {
      throw new BadRequestException('Document has no extracted text')
    }

    try {
      const proposals = await this.ai.extractTopics(doc.extractedText, {
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        documentId: doc.id,
      })
      return { source: 'ai' as const, proposals }
    } catch (err) {
      this.logger.warn(
        `AI topic extraction failed for document ${id}, using fallback extraction: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      return { source: 'fallback' as const, proposals: extractTopicsHeuristically(doc.extractedText) }
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async remove(id: string, user: AuthUser) {
    const doc = await this.findOne(id, user)

    const canDelete =
      doc.uploadedById === user.id ||
      user.role === UserRole.ORG_ADMIN ||
      user.role === UserRole.SUPER_ADMIN

    if (!canDelete) {
      throw new ForbiddenException('You do not have permission to delete this document')
    }

    if (doc.fileUrl) {
      await this.storage.delete(doc.fileUrl).catch(() => undefined)
    }

    await this.prisma.document.delete({ where: { id } })
    return { message: 'Document deleted' }
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private async extractText(
    buffer: Buffer,
    type: DocumentType,
  ): Promise<{ text: string; pageCount?: number }> {
    if (type === DocumentType.PDF) {
      try {
        const result = await pdfParse(buffer)
        return { text: result.text, pageCount: result.numpages }
      } catch (err) {
        this.logger.warn('PDF extraction failed, continuing without text', err)
        return { text: '' }
      }
    }

    if (type === DocumentType.DOCX) {
      try {
        const result = await mammoth.extractRawText({ buffer })
        return { text: result.value }
      } catch (err) {
        this.logger.warn('DOCX extraction failed, continuing without text', err)
        return { text: '' }
      }
    }

    // Plain text
    return { text: buffer.toString('utf-8') }
  }

  /**
   * Split extracted text into ~1 000-character chunks on sentence boundaries.
   * These chunks are used later for AI question generation.
   */
  private chunkText(text: string, maxChunkSize = 1000): string[] {
    if (!text.trim()) return []

    const sentences = text.split(/(?<=[.!?])\s+/)
    const chunks: string[] = []
    let current = ''

    for (const sentence of sentences) {
      if (current.length > 0 && (current + ' ' + sentence).length > maxChunkSize) {
        chunks.push(current.trim())
        current = sentence
      } else {
        current = current ? `${current} ${sentence}` : sentence
      }
    }
    if (current.trim()) chunks.push(current.trim())

    return chunks
  }

  private detectFileType(mimetype: string): DocumentType {
    if (mimetype === 'application/pdf') return DocumentType.PDF
    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword'
    ) {
      return DocumentType.DOCX
    }
    return DocumentType.TXT
  }
}
