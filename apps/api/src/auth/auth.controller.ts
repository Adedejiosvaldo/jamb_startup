import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import {
  OtpRequestDto,
  otpRequestSchema,
  OtpVerifyDto,
  otpVerifySchema,
  RefreshDto,
  refreshSchema,
  ReplaceDeviceDto,
  replaceDeviceSchema,
} from './auth.dto';
import { AuthGuard, AuthedRequest } from './auth.guard';
import { AuthService, SignInResult } from './auth.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly otp: OtpService,
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Post('otp/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  requestOtp(@Body(new ZodBodyPipe(otpRequestSchema)) body: OtpRequestDto) {
    return this.otp.request(body.phone, body.channel);
  }

  @Post('otp/verify')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async verifyOtp(
    @Body(new ZodBodyPipe(otpVerifySchema)) body: OtpVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      await this.auth.verifyOtpAndSignIn(body.phone, body.code, body.device),
      res,
    );
  }

  @Post('devices/replace')
  async replaceDevice(
    @Body(new ZodBodyPipe(replaceDeviceSchema)) body: ReplaceDeviceDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(await this.auth.replaceDevice(body.pendingToken, body.revokeDeviceId), res);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodBodyPipe(refreshSchema)) body: RefreshDto) {
    return this.tokens.rotate(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(@Req() req: AuthedRequest): Promise<void> {
    await this.auth.revokeDevice(req.auth.userId, req.auth.deviceId);
  }

  /** 200 when signed in; 409 when the user must first remove a device (F-ACC-02). */
  private respond(result: SignInResult, res: Response) {
    res.status(result.status === 'signed_in' ? 200 : 409);
    return result;
  }
}
