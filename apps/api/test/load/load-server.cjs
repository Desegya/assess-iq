// Load-test API process: the real AppModule and configureApp, with the AI provider
// stubbed (configurable latency and failure rate). Never use in production.
require('reflect-metadata')
const { NestFactory } = require('@nestjs/core')
const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid')
if (!['localhost', '127.0.0.1'].includes(url.hostname) && process.env.LOAD_ALLOW_REMOTE_DB !== 'yes')
  throw new Error('Load server refuses non-local databases unless LOAD_ALLOW_REMOTE_DB=yes (never production)')
process.env.EXAM_ACCESS = 'OPEN'
process.env.R2_ACCESS_KEY_ID = ''
process.env.R2_ENDPOINT = ''
const latency = [Number(process.env.AI_MIN_MS || 5000), Number(process.env.AI_MAX_MS || 20000)]
const failureRate = Number(process.env.AI_FAILURE_RATE || 0.2)
;(async () => {
  const { AppModule } = require('../../dist/app.module')
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'], forceCloseConnections: true })
  require('../../dist/configure-app').configureApp(app)
  app.enableShutdownHooks()
  const { AiService } = require('../../dist/modules/ai/ai.service')
  const ai = app.get(AiService)
  let calls = 0, failures = 0
  ai.gradeWrittenAnswers = async (answers) => {
    calls++
    await new Promise((r) => setTimeout(r, latency[0] + Math.random() * (latency[1] - latency[0])))
    if (Math.random() < failureRate) { failures++; throw new Error('Load-test provider failure') }
    return { model: 'load-stub', promptVersion: 'load-stub', grades: answers.map((a) => ({ id: a.id, score: Math.round(a.marks * Math.random() * 2) / 2, feedback: 'Load-test feedback.', missingPoints: [] })) }
  }
  app.getHttpAdapter().get('/__load/stats', (_req, res) => res.json({ aiCalls: calls, aiFailures: failures, memoryMb: Math.round(process.memoryUsage().rss / 1e6) }))
  await app.listen(Number(process.env.PORT || 3201), '127.0.0.1')
  process.send?.('ready')
})().catch((e) => { console.error(e); process.exit(1) })
