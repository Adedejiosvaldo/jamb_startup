import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from './auth.guard';

/** Attaches `req.auth` when a valid token is sent; lets anonymous requests through. */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthGuard) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.headers.authorization) return true;
    try {
      await this.auth.canActivate(ctx);
    } catch {
      // Anonymous on a bad token: support must always be reachable.
    }
    return true;
  }
}
