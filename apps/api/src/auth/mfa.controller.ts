import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { generateTotpSecret, otpauthUrl, verifyTotp } from '../common/totp';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from './auth.errors';
import { AuthGuard, AuthedRequest } from './auth.guard';
import { TokenService } from './token.service';

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.') });

/** Staff 2FA (spec §14: admin 2FA mandatory). */
@Controller('v1/auth/mfa')
@UseGuards(AuthGuard)
export class MfaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /** First-time setup: returns a secret to add to an authenticator app. Re-callable until enabled. */
  @Post('setup')
  @HttpCode(200)
  async setup(@Req() req: AuthedRequest) {
    const user = await this.staffUser(req);
    if (user.totpEnabledAt) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        'MFA_ALREADY_ENABLED',
        'Two-step verification is already set up.',
      );
    }
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
    return { secret, otpauthUrl: otpauthUrl(secret, user.phone) };
  }

  /** Verifies a code, enables 2FA on first success, and returns an MFA-elevated token pair. */
  @Post('verify')
  @HttpCode(200)
  async verify(
    @Req() req: AuthedRequest,
    @Body(new ZodBodyPipe(codeSchema)) body: { code: string },
  ) {
    const user = await this.staffUser(req);
    if (!user.totpSecret || !verifyTotp(user.totpSecret, body.code)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'MFA_INVALID',
        'That code is wrong. Check your authenticator app.',
      );
    }
    const now = new Date();
    if (!user.totpEnabledAt) {
      await this.prisma.user.update({ where: { id: user.id }, data: { totpEnabledAt: now } });
    }
    await this.prisma.device.update({
      where: { id: req.auth.deviceId },
      data: { mfaVerifiedAt: now },
    });
    await this.tokens.revokeDeviceTokens(req.auth.deviceId, now);
    return this.tokens.issuePair(user.id, user.role, req.auth.deviceId);
  }

  private async staffUser(req: AuthedRequest) {
    if (req.auth.role !== 'admin' && req.auth.role !== 'reviewer') {
      throw new ApiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'You do not have access to this.');
    }
    return this.prisma.user.findUniqueOrThrow({ where: { id: req.auth.userId } });
  }
}
