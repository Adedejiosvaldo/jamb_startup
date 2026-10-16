import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { randomToken, sha256Hex } from '../common/crypto';
import { ENV, Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  DEVICE_LIMIT_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_MS,
} from './auth.constants';
import { ApiError } from './auth.errors';

export interface AccessClaims {
  userId: string;
  role: UserRole;
  deviceId: string;
}

export interface DeviceLimitClaims {
  userId: string;
  fingerprint: string;
  userAgent?: string;
  label?: string;
}

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

const ISSUER = 'scorecoach-api';

@Injectable()
export class TokenService {
  private readonly key: Uint8Array;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) env: Env,
  ) {
    this.key = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  }

  async issuePair(
    userId: string,
    role: UserRole,
    deviceId: string,
    familyId: string = randomUUID(),
  ): Promise<TokenPair> {
    const refreshToken = await this.createRefreshToken(userId, deviceId, familyId);
    return {
      accessToken: await this.signAccess({ userId, role, deviceId }),
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
    };
  }

  async signAccess(claims: AccessClaims): Promise<string> {
    return new SignJWT({ role: claims.role, did: claims.deviceId, typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.key);
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        algorithms: ['HS256'],
      });
      if (payload.typ !== 'access' || !payload.sub || typeof payload.did !== 'string')
        throw new Error('bad claims');
      return { userId: payload.sub, role: payload.role as UserRole, deviceId: payload.did };
    } catch {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Please sign in again.');
    }
  }

  /** Short-lived token letting a user finish sign-in by choosing a device to remove. */
  async signDeviceLimit(claims: DeviceLimitClaims): Promise<string> {
    return new SignJWT({
      typ: 'device_limit',
      fp: claims.fingerprint,
      ua: claims.userAgent,
      lbl: claims.label,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${DEVICE_LIMIT_TOKEN_TTL_SECONDS}s`)
      .sign(this.key);
  }

  async verifyDeviceLimit(token: string): Promise<DeviceLimitClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        algorithms: ['HS256'],
      });
      if (payload.typ !== 'device_limit' || !payload.sub || typeof payload.fp !== 'string')
        throw new Error('bad claims');
      return {
        userId: payload.sub,
        fingerprint: payload.fp,
        userAgent: typeof payload.ua === 'string' ? payload.ua : undefined,
        label: typeof payload.lbl === 'string' ? payload.lbl : undefined,
      };
    } catch {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Please sign in again.');
    }
  }

  /**
   * Rotate a refresh token. Presenting a token that was already rotated or
   * revoked is treated as theft: the whole rotation family is revoked.
   */
  async rotate(rawToken: string, now = new Date()): Promise<TokenPair> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256Hex(rawToken) },
      include: { device: true, user: true },
    });
    if (!record) throw this.invalid();

    if (record.rotatedAt || record.revokedAt) {
      await this.revokeFamily(record.familyId, now);
      throw this.invalid();
    }
    if (record.expiresAt <= now || record.device.revokedAt || record.user.status !== 'active') {
      throw this.invalid();
    }

    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, rotatedAt: null, revokedAt: null },
      data: { rotatedAt: now },
    });
    if (claimed.count !== 1) {
      // Lost a race with a concurrent refresh using the same token.
      await this.revokeFamily(record.familyId, now);
      throw this.invalid();
    }

    await this.prisma.device.update({
      where: { id: record.deviceId },
      data: { lastActiveAt: now },
    });
    return this.issuePair(record.userId, record.user.role, record.deviceId, record.familyId);
  }

  async revokeDeviceTokens(deviceId: string, now = new Date()): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private async createRefreshToken(
    userId: string,
    deviceId: string,
    familyId: string,
  ): Promise<string> {
    const raw = randomToken(32);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        deviceId,
        familyId,
        tokenHash: sha256Hex(raw),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return raw;
  }

  private async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private invalid(): ApiError {
    return new ApiError(HttpStatus.UNAUTHORIZED, 'REFRESH_INVALID', 'Please sign in again.');
  }
}
