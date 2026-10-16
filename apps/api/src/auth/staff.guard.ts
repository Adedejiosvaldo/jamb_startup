import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ApiError } from './auth.errors';
import { AuthGuard, AuthedRequest } from './auth.guard';

const STAFF_ROLES = 'staffRoles';

@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(STAFF_ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]) ?? ['admin'];
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!roles.includes(req.auth.role)) {
      throw new ApiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'You do not have access to this.');
    }
    if (!req.auth.mfa) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'MFA_REQUIRED',
        'Enter your authenticator code to continue.',
      );
    }
    return true;
  }
}

/** Staff-only route: signed in, allowed role, and TOTP verified on this device in the last 12 h. */
export function Staff(...roles: UserRole[]) {
  return applyDecorators(
    SetMetadata(STAFF_ROLES, roles.length ? roles : ['admin']),
    UseGuards(AuthGuard, StaffGuard),
  );
}
