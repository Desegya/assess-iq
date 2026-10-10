/* Run only from a trusted deployment shell with DATABASE_URL supplied. */
const { PrismaClient, Prisma } = require('../generated/client')
const prisma = new PrismaClient()
async function main() {
  const email = process.argv[2]
  if (!process.env.DATABASE_URL || !email || process.argv.length !== 3) throw new Error('Usage: DATABASE_URL=<deployment database> node scripts/bootstrap-nightklass-admin.cjs <existing-account-email>')
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(610101200)`
    if (await tx.nightklassAdmin.count()) throw new Error('Administration is already provisioned. An existing owner must manage further access in the dashboard.')
    const user = await tx.user.findUnique({ where: { email }, select: { id: true, status: true, role: true, organizationId: true } })
    if (!user || user.status !== 'ACTIVE' || user.organizationId !== null || user.role !== 'STUDENT') throw new Error('Provisioning requires an existing active standalone Nightklass account.')
    await tx.nightklassAdmin.create({ data: { userId: user.id, role: 'OWNER' } })
    await tx.refreshToken.updateMany({ where: { userId: user.id }, data: { isRevoked: true } })
    await tx.nightklassAdminAudit.create({ data: { actorId: user.id, action: 'OWNER_BOOTSTRAPPED', resourceType: 'user', resourceId: user.id } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  console.log('Nightklass owner provisioned. Sign in at /admin/login using the existing account password.')
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
