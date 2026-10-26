import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_NON_ADMIN_KEY } from '../decorators/require-admin.decorator';

/**
 * Fail-closed: if this guard is on the route, the caller must be an admin.
 *
 * The previous version returned true whenever `@RequireAdmin()` was absent from
 * the handler. Since `reflector.get()` does not see class-level metadata, that
 * also covered AdminController, which declares `@RequireAdmin()` on the class —
 * so the whole admin surface, plus room/offer/contact/booking writes, was
 * reachable by anyone holding any valid token.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowNonAdmin = this.reflector.getAllAndOverride<boolean>(ALLOW_NON_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowNonAdmin) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user;
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Administrator access required');
    }

    return true;
  }
}
