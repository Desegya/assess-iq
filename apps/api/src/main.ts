import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { join } from 'path'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // Bounded JSON payloads accommodate saved written papers and shared teaching notes.
  app.useBodyParser('json', { limit: '2mb' })

  // ─── Local file storage (dev fallback when R2 is not configured) ──────────
  // Serves uploads/ as static files at /uploads/...
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' })

  // ─── Global prefix & versioning ───────────────────────────────────────────
  app.setGlobalPrefix('api')
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })

  // ─── CORS ─────────────────────────────────────────────────────────────────
  // APP_URL supports a comma-separated list — kwikeval.com (assessment) and
  // nightklass.com (study) are separate frontends sharing this same API.
  const allowedOrigins = (process.env.APP_URL ?? 'http://localhost:3000')
    .split(',')
    .map(origin => origin.trim())
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  })

  // ─── Global validation pipe ───────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // ─── Swagger (dev only) ───────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AssessIQ API')
      .setDescription('AssessIQ Learn + Assess — REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
  }

  const port = process.env.PORT ?? 3001
  await app.listen(port)
  console.warn(`🚀 AssessIQ API running on http://localhost:${port}/api/v1`)
  console.warn(`📚 Swagger docs at http://localhost:${port}/api/docs`)
}

bootstrap()
