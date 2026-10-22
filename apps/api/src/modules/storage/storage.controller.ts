import { Controller, Get, NotFoundException, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { Public } from '../auth/decorators/public.decorator'
import { StorageService } from './storage.service'

/**
 * Local-development stand-in for R2 presigned URLs. Access is granted only by a
 * valid, unexpired HMAC signature issued after the API authorized the requester;
 * production never serves this route because local storage cannot start there.
 */
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}
  @Public()
  @Get('local')
  download(
    @Query('key') key: string,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    const path = typeof key === 'string' ? this.storage.verifyLocalUrl(key, expires, sig) : null
    if (!path) throw new NotFoundException('Link expired or invalid')
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Content-Disposition', 'attachment')
    res.sendFile(path, (err) => {
      if (err && !res.headersSent) res.status(404).json({ statusCode: 404, message: 'File not found' })
    })
  }
}
