import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { join } from 'path'
import { AppModule } from './app.module'
import { configureApp } from './configure-app'
import { assertProductionEnvironment } from './environment'

async function bootstrap() {
  assertProductionEnvironment(process.env)
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // SIGTERM (redeploys) runs onModuleDestroy, letting background workers stop
  // claiming work and release their leases instead of waiting for expiry.
  app.enableShutdownHooks()

  // ─── Local file storage (development only) ────────────────────────────────
  // Production refuses to start without object storage (see environment.ts), so
  // private uploads are never served from this unauthenticated static route.
  if (process.env.NODE_ENV !== 'production')
    app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' })

  // APP_URL supports a comma-separated list — kwikeval.com (assessment) and
  // nightklass.com (study) are separate frontends sharing this same API.
  configureApp(app)

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
