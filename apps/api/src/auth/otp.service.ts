import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { OtpChannel } from '@prisma/client';
import { hmacHex, randomNumericCode, safeEqualHex } from '../common/crypto';
import { maskPhone } from '../common/phone';
import { ENV, Env } from '../config/env';
import { SMS_SENDER, SmsSender } from '../messaging/sms';
import { PrismaService } from '../prisma/prisma.service';
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from './auth.constants';
import { ApiError } from './auth.errors';

export interface OtpRequestResult {
  expiresInSeconds: number;
  resendInSeconds: number;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  /** `phone` must already be normalised to E.164. */
  async request(
    phone: string,
    channel: OtpChannel = 'sms',
    now = new Date(),
  ): Promise<OtpRequestResult> {
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recent = await this.prisma.otpRequest.findMany({
      where: { phone, createdAt: { gt: hourAgo } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const last = recent[0];
    if (last) {
      const sinceLast = now.getTime() - last.createdAt.getTime();
      if (sinceLast < OTP_RESEND_COOLDOWN_MS) {
        throw new ApiError(
          HttpStatus.TOO_MANY_REQUESTS,
          'OTP_COOLDOWN',
          'Please wait before requesting another code.',
          {
            retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_MS - sinceLast) / 1000),
          },
        );
      }
    }
    if (recent.length >= OTP_MAX_PER_HOUR) {
      const oldest = recent[recent.length - 1]!;
      throw new ApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        'OTP_HOURLY_LIMIT',
        'Too many codes requested. Try again later.',
        {
          retryAfterSeconds: Math.ceil(
            (oldest.createdAt.getTime() + 60 * 60 * 1000 - now.getTime()) / 1000,
          ),
        },
      );
    }

    const code = randomNumericCode(OTP_LENGTH);
    // Only the newest code is valid: expire any outstanding ones.
    await this.prisma.$transaction([
      this.prisma.otpRequest.updateMany({
        where: { phone, consumedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      }),
      this.prisma.otpRequest.create({
        data: {
          phone,
          channel,
          codeHash: this.hash(phone, code),
          expiresAt: new Date(now.getTime() + OTP_TTL_MS),
          createdAt: now,
        },
      }),
    ]);

    const minutes = OTP_TTL_MS / 60_000;
    const body = `Your ScoreCoach code is ${code}. It expires in ${minutes} minutes. Never share this code with anyone.`;
    try {
      const result = await this.sms.send({ to: phone, body });
      await this.logMessage(phone, 'sent', result.providerId);
    } catch (err) {
      this.logger.error(`OTP send failed for ${maskPhone(phone)}: ${(err as Error).message}`);
      await this.logMessage(phone, 'failed');
      throw new ApiError(
        HttpStatus.BAD_GATEWAY,
        'OTP_SEND_FAILED',
        'We could not send your code. Please try again.',
      );
    }

    return { expiresInSeconds: OTP_TTL_MS / 1000, resendInSeconds: OTP_RESEND_COOLDOWN_MS / 1000 };
  }

  /** Consumes the code on success. Throws ApiError otherwise. */
  async verify(phone: string, code: string, now = new Date()): Promise<void> {
    const otp = await this.prisma.otpRequest.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'OTP_INVALID',
        'That code is wrong or has expired.',
      );
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new ApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        'OTP_LOCKED',
        'Too many wrong attempts. Request a new code.',
      );
    }

    if (!safeEqualHex(this.hash(phone, code), otp.codeHash)) {
      await this.prisma.otpRequest.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'OTP_INVALID',
        'That code is wrong or has expired.',
      );
    }

    // Atomic consume so two concurrent verifies can't both succeed.
    const consumed = await this.prisma.otpRequest.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'OTP_INVALID',
        'That code is wrong or has expired.',
      );
    }
  }

  private hash(phone: string, code: string): string {
    return hmacHex(this.env.OTP_HASH_SECRET, `${phone}:${code}`);
  }

  private async logMessage(phone: string, status: string, providerId?: string): Promise<void> {
    await this.prisma.messageLog.create({
      data: {
        phone,
        channel: 'sms',
        template: 'otp',
        payload: { provider: this.sms.name }, // never the code
        status,
        providerId,
        sentAt: status === 'sent' ? new Date() : null,
      },
    });
  }
}
