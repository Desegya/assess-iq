import { Logger, ValidationPipe, VersioningType } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import type { NextFunction, Request, Response } from 'express'

/**
 * Parses TRUST_PROXY into an Express "trust proxy" value. Only an explicit hop
 * count, `loopback`, or a comma-separated address/subnet list is accepted:
 * trusting every proxy would let clients forge X-Forwarded-For and evade the
 * anonymous rate limits.
 */
export function trustProxySetting(raw: string | undefined): number | string | undefined {
  const value = raw?.trim()
  if (!value || value === 'false' || value === '0') return undefined
  if (/^\d+$/.test(value)) return Number(value)
  if (value === 'true') throw new Error('TRUST_PROXY=true trusts every proxy; set a hop count such as 1')
  return value
}

export function allowedOrigins() {
  return (process.env.APP_URL ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

// The API only serves JSON (and, in local development, uploaded files), so a
// deny-all policy is safe and prevents any response from rendering as a page.
function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
  if (!req.path.startsWith('/api/docs'))
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
}

/** Shared by main.ts, integration tests and the browser fixture server so all exercise one configuration. */
export function configureApp(app: NestExpressApplication, corsOrigins = allowedOrigins()) {
  const trustProxy = trustProxySetting(process.env.TRUST_PROXY)
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy)
  else if (process.env.NODE_ENV === 'production')
    new Logger('Bootstrap').warn(
      'TRUST_PROXY is not set: behind a reverse proxy every anonymous client shares one rate-limit address.',
    )
  app.disable('x-powered-by')
  app.use(securityHeaders)
  // Bounded JSON payloads accommodate saved written papers and shared teaching notes.
  app.useBodyParser('json', { limit: '2mb' })
  app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] })
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
  app.enableCors({ origin: corsOrigins, credentials: true })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )
  return app
}
