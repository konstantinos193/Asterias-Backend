import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_ADMIN_KEY } from '../decorators/require-admin.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireAdmin = this.reflector.get<boolean>(
      REQUIRE_ADMIN_KEY,
      context.getHandler(),
    );

    if (!requireAdmin) {
      return true; // No admin requirement
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user or not admin, deny access
    if (!user || user.role !== 'ADMIN') {
      return false;
    }

    return true;
  }
}
