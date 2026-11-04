import { extname } from 'node:path'

const EXTENSIONS: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
}

// Browsers can send Office documents as octet-stream or zip. Signature validation still follows.
export function documentMime(file: Pick<Express.Multer.File, 'originalname' | 'mimetype'>) {
  return EXTENSIONS[extname(file.originalname).toLowerCase()] ?? file.mimetype
}
