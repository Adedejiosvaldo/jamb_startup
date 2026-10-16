import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { SMS_SENDER, SmsMessage, SmsSender } from '../src/messaging/sms';
import { PrismaService } from '../src/prisma/prisma.service';

/** Captures outgoing SMS so tests can read the OTP. */
export class FakeSms implements SmsSender {
  readonly name = 'fake';
  sent: SmsMessage[] = [];
  fail = false;

  async send(message: SmsMessage) {
    if (this.fail) throw new Error('provider down');
    this.sent.push(message);
    return { providerId: `fake-${this.sent.length}` };
  }

  lastCodeFor(phone: string): string {
    const msg = [...this.sent].reverse().find((m) => m.to === phone);
    const code = msg?.body.match(/\b(\d{6})\b/)?.[1];
    if (!code) throw new Error(`no OTP sent to ${phone}`);
    return code;
  }
}

export async function createTestApp(): Promise<{
  app: INestApplication;
  sms: FakeSms;
  prisma: PrismaService;
}> {
  const sms = new FakeSms();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SMS_SENDER)
    .useValue(sms)
    .compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app);
  await app.init();
  return { app, sms, prisma: app.get(PrismaService) };
}

export async function resetDb(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  if (list) await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}
