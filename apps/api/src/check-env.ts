import { assertProductionEnvironment } from './environment'

// Runs before `prisma migrate deploy` in the container. A misconfigured release
// must fail here, before migrations change the schema under the still-running
// previous version.
try {
  assertProductionEnvironment(process.env)
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
