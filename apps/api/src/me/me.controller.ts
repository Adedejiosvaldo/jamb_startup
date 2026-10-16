import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { AuthService, toPublicUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async me(@Req() req: AuthedRequest) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: req.auth.userId } });
    return toPublicUser(user);
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
