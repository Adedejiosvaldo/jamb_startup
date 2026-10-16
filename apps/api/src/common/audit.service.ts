import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Every staff write goes through here (spec §14: "All admin actions in audit_log"). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    actorId: string | null,
    action: string,
    entity: string,
    entityId: string | null,
    before?: unknown,
    after?: unknown,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        before: toJson(before),
        after: toJson(after),
      },
    });
  }
}

function toJson(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (v === undefined || v === null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
