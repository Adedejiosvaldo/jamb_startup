import { HttpStatus, Injectable } from '@nestjs/common';
import { Device, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_ACTIVE_DEVICES } from './auth.constants';
import { ApiError } from './auth.errors';
import { OtpService } from './otp.service';
import { TokenPair, TokenService } from './token.service';

export interface DeviceInput {
  fingerprint: string;
  userAgent?: string;
  label?: string;
}

export type SignInResult =
  | { status: 'signed_in'; user: PublicUser; isNewUser: boolean; tokens: TokenPair }
  | { status: 'device_limit'; pendingToken: string; devices: PublicDevice[] };

export interface PublicUser {
  id: string;
  phone: string;
  name: string | null;
  role: User['role'];
}

export interface PublicDevice {
  id: string;
  label: string | null;
  userAgent: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  current?: boolean;
}

export function toPublicUser(u: User): PublicUser {
  return { id: u.id, phone: u.phone, name: u.name, role: u.role };
}

export function toPublicDevice(d: Device, currentDeviceId?: string): PublicDevice {
  return {
    id: d.id,
    label: d.label,
    userAgent: d.userAgent,
    lastActiveAt: d.lastActiveAt,
    createdAt: d.createdAt,
    ...(currentDeviceId ? { current: d.id === currentDeviceId } : {}),
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

  async verifyOtpAndSignIn(
    phone: string,
    code: string,
    device: DeviceInput,
  ): Promise<SignInResult> {
    await this.otp.verify(phone, code);

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing && existing.status !== 'active') {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'ACCOUNT_INACTIVE',
        'This account is not active. Contact support.',
      );
    }
    const user = existing ?? (await this.prisma.user.create({ data: { phone } }));
    const now = new Date();

    const known = await this.prisma.device.findFirst({
      where: { userId: user.id, deviceFingerprint: device.fingerprint, revokedAt: null },
    });
    if (known) {
      await this.prisma.device.update({
        where: { id: known.id },
        data: {
          lastActiveAt: now,
          userAgent: device.userAgent ?? known.userAgent,
          label: device.label ?? known.label,
        },
      });
      return this.signedIn(user, known.id, !existing);
    }

    const active = await this.activeDevices(user.id);
    if (active.length >= MAX_ACTIVE_DEVICES) {
      return {
        status: 'device_limit',
        pendingToken: await this.tokens.signDeviceLimit({ userId: user.id, ...device }),
        devices: active.map((d) => toPublicDevice(d)),
      };
    }

    const created = await this.createDevice(user.id, device);
    return this.signedIn(user, created.id, !existing);
  }

  /** Finish a sign-in that hit the device limit by removing one of the user's devices. */
  async replaceDevice(pendingToken: string, revokeDeviceId: string): Promise<SignInResult> {
    const claims = await this.tokens.verifyDeviceLimit(pendingToken);
    const user = await this.prisma.user.findUnique({ where: { id: claims.userId } });
    if (!user || user.status !== 'active') {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', 'Please sign in again.');
    }
    await this.revokeDevice(user.id, revokeDeviceId);

    const active = await this.activeDevices(user.id);
    if (active.length >= MAX_ACTIVE_DEVICES) {
      return {
        status: 'device_limit',
        pendingToken,
        devices: active.map((d) => toPublicDevice(d)),
      };
    }
    const created = await this.createDevice(user.id, {
      fingerprint: claims.fingerprint,
      userAgent: claims.userAgent,
      label: claims.label,
    });
    return this.signedIn(user, created.id, false);
  }

  async listDevices(userId: string, currentDeviceId: string): Promise<PublicDevice[]> {
    const devices = await this.activeDevices(userId);
    return devices.map((d) => toPublicDevice(d, currentDeviceId));
  }

  /** Revokes the device and all its refresh tokens. Idempotent for already-revoked devices. */
  async revokeDevice(userId: string, deviceId: string): Promise<void> {
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, userId } });
    if (!device) throw new ApiError(HttpStatus.NOT_FOUND, 'DEVICE_NOT_FOUND', 'Device not found.');
    if (device.revokedAt) return;
    const now = new Date();
    await this.prisma.device.update({ where: { id: device.id }, data: { revokedAt: now } });
    await this.tokens.revokeDeviceTokens(device.id, now);
  }

  private activeDevices(userId: string): Promise<Device[]> {
    return this.prisma.device.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  private createDevice(userId: string, device: DeviceInput): Promise<Device> {
    return this.prisma.device.create({
      data: {
        userId,
        deviceFingerprint: device.fingerprint,
        userAgent: device.userAgent,
        label: device.label,
      },
    });
  }

  private async signedIn(user: User, deviceId: string, isNewUser: boolean): Promise<SignInResult> {
    await this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    return {
      status: 'signed_in',
      user: toPublicUser(user),
      isNewUser,
      tokens: await this.tokens.issuePair(user.id, user.role, deviceId),
    };
  }
}
