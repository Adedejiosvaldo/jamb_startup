import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ACTIVITY_WRITE_INTERVAL_MS } from './auth.constants';
import { ApiError } from './auth.errors';
import { AccessClaims, TokenService } from './token.service';

export interface AuthedRequest extends Request {
  auth: AccessClaims;
}

/**
 * Bearer access-token guard. Also checks the device hasn't been revoked, so
 * "log out other device" takes effect immediately rather than after 15 min.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'TOKEN_MISSING', 'Please sign in.');
    }
    const claims = await this.tokens.verifyAccess(token);

    const device = await this.prisma.device.findUnique({
      where: { id: claims.deviceId },
      select: {
        userId: true,
        revokedAt: true,
        lastActiveAt: true,
        user: { select: { status: true } },
      },
    });
    if (
      !device ||
      device.userId !== claims.userId ||
      device.revokedAt ||
      device.user.status !== 'active'
    ) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Please sign in again.');
    }

    const now = Date.now();
    if (now - device.lastActiveAt.getTime() > ACTIVITY_WRITE_INTERVAL_MS) {
      const at = new Date(now);
      await this.prisma.$transaction([
        this.prisma.device.update({ where: { id: claims.deviceId }, data: { lastActiveAt: at } }),
        this.prisma.user.update({ where: { id: claims.userId }, data: { lastSeenAt: at } }),
      ]);
    }

    req.auth = claims;
    return true;
  }
}
