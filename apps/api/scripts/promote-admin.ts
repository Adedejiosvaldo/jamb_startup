/**
 * Bootstrap staff: `pnpm --filter @scorecoach/api admin:promote 08031234567 [admin|reviewer]`.
 * The user must have signed in once. They set up 2FA on next visit to /admin.
 */
import { PrismaClient, UserRole } from '@prisma/client';
import { normaliseNigerianPhone } from '../src/common/phone';

async function main(): Promise<void> {
  const [rawPhone, rawRole = 'admin'] = process.argv.slice(2);
  const phone = rawPhone && normaliseNigerianPhone(rawPhone);
  if (!phone || !['admin', 'reviewer'].includes(rawRole)) {
    throw new Error('Usage: admin:promote <phone> [admin|reviewer]');
  }
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.update({
      where: { phone },
      data: { role: rawRole as UserRole },
    });
    await prisma.auditLog.create({
      data: {
        action: 'promote',
        entity: 'user',
        entityId: user.id,
        after: { role: rawRole },
        actorId: null,
      },
    });
    console.log(`${phone} is now ${rawRole}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
