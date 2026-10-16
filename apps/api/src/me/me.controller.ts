import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { EntitlementsService } from '../commerce/entitlements.service';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import {
  parentLinkSchema,
  ProfilePatch,
  profilePatchSchema,
  subjectsSchema,
} from '../profile/profile.dto';
import { ProfileService } from '../profile/profile.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(
    private readonly auth: AuthService,
    private readonly profile: ProfileService,
    private readonly entitlements: EntitlementsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  me(@Req() req: AuthedRequest) {
    return this.profile.me(req.auth.userId);
  }

  @Patch()
  update(@Req() req: AuthedRequest, @Body(new ZodBodyPipe(profilePatchSchema)) body: ProfilePatch) {
    return this.profile.update(req.auth.userId, body);
  }

  @Put('subjects')
  subjects(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(subjectsSchema)) body: z.infer<typeof subjectsSchema>,
  ) {
    return this.profile.setSubjects(req.auth.userId, body.subjectCodes);
  }

  @Post('parent-link')
  parentLink(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(parentLinkSchema)) body: z.infer<typeof parentLinkSchema>,
  ) {
    return this.profile.linkParent(req.auth.userId, body.parentPhone);
  }

  @Get('entitlements')
  async myEntitlements(@Req() req: AuthedRequest) {
    const rows = await this.prisma.entitlement.findMany({
      where: { userId: req.auth.userId },
      include: { product: true },
      orderBy: { startsAt: 'desc' },
    });
    const active = await this.entitlements.active(req.auth.userId);
    return {
      active: active ? { productCode: active.product.code, endsAt: active.endsAt } : null,
      history: rows.map((r) => ({
        id: r.id,
        productCode: r.product.code,
        productName: r.product.name,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        revoked: !!r.revokedAt,
      })),
    };
  }

  @Get('devices')
  async devices(@Req() req: AuthedRequest) {
    return { devices: await this.auth.listDevices(req.auth.userId, req.auth.deviceId) };
  }

  @Delete('devices/:id')
  @HttpCode(204)
  async removeDevice(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.auth.revokeDevice(req.auth.userId, id);
  }
}
