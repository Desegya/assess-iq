import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)

  // R2 (cloud) fields
  private readonly client: S3Client | null = null
  private readonly bucket: string
  private readonly publicUrl: string | undefined

  // Local fallback
  private readonly isLocal: boolean
  private readonly uploadsDir: string

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('R2_BUCKET_NAME', 'assessiq')
    this.publicUrl = config.get<string>('R2_PUBLIC_URL')
    this.uploadsDir = join(process.cwd(), 'uploads')

    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID', '')
    const endpoint = config.get<string>('R2_ENDPOINT', '')

    // Use local filesystem when R2 is not configured
    this.isLocal = !accessKeyId || !endpoint

    if (this.isLocal) {
      this.logger.warn(
        '⚠️  R2 credentials not configured — using LOCAL filesystem storage. ' +
          'Do not use this in production.',
      )
    } else {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY', ''),
        },
      })
    }
  }

  // ─── Upload ────────────────────────────────────────────────────────────────

  async uploadBuffer(key: string, buffer: Buffer, _contentType: string): Promise<void> {
    if (this.isLocal) {
      const filePath = join(this.uploadsDir, key)
      await fs.mkdir(dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, buffer)
      this.logger.log(`[local] Saved ${key} (${buffer.length} bytes)`)
      return
    }

    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: _contentType,
      }),
    )
    this.logger.log(`[R2] Uploaded ${key} (${buffer.length} bytes)`)
  }

  // ─── Download URL ──────────────────────────────────────────────────────────

  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (this.isLocal) {
      // The API serves uploads/ as static files at /uploads/
      const apiBase = this.config.get<string>('API_URL', 'http://localhost:3001')
      return `${apiBase}/uploads/${key}`
    }

    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${key}`
    }

    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(this.client!, command, { expiresIn: expiresInSeconds })
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async delete(key: string): Promise<void> {
    if (this.isLocal) {
      const filePath = join(this.uploadsDir, key)
      await fs.unlink(filePath).catch(() => undefined)
      this.logger.log(`[local] Deleted ${key}`)
      return
    }

    await this.client!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    this.logger.log(`[R2] Deleted ${key}`)
  }
}
