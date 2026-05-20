import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly client: S3Client
  private readonly bucket: string
  private readonly publicUrl: string | undefined

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('R2_BUCKET_NAME', 'assessiq')
    this.publicUrl = config.get<string>('R2_PUBLIC_URL')

    this.client = new S3Client({
      region: 'auto',
      endpoint: config.get<string>('R2_ENDPOINT', 'https://placeholder.r2.cloudflarestorage.com'),
      credentials: {
        accessKeyId: config.get<string>('R2_ACCESS_KEY_ID', ''),
        secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY', ''),
      },
    })
  }

  /**
   * Upload a buffer to R2. The key is the full object path, e.g.
   * `{orgId}/documents/{docId}/{filename}`.
   */
  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    )
    this.logger.log(`Uploaded ${key} (${buffer.length} bytes)`)
  }

  /**
   * Returns a short-lived signed URL for downloading a private object.
   * Falls back to public URL if R2_PUBLIC_URL is configured.
   */
  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${key}`
    }
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    this.logger.log(`Deleted ${key}`)
  }
}
