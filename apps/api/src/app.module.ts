import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { CommerceModule } from './commerce/commerce.module';
import { AuditModule } from './common/audit.service';
import { ContentModule } from './content/content.module';
import { TestsModule } from './tests/tests.module';
import { ConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';
import { MeModule } from './me/me.module';
import { MessagingModule } from './messaging/messaging.module';
import { OpsModule } from './ops.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MessagingModule,
    // Per-IP backstop. Nigerian mobile networks use carrier-grade NAT and a
    // school lab shares one IP, so keep this generous; per-phone OTP limits
    // in OtpService do the real work.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    AuditModule,
    AuthModule,
    MeModule,
    CatalogueModule,
    ContentModule,
    TestsModule,
    CommerceModule,
    OpsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
