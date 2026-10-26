import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ACCESS_LEVEL } from '../decorators/access.decorator';
import { USER_ROLE } from '../../common/enums';

/** New routes require a database-validated admin unless explicitly opened. */
@Injectable()
export class DefaultAccessGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) { super(); }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = this.reflector.getAllAndOverride<string>(ACCESS_LEVEL, [
      context.getHandler(), context.getClass(),
    ]);
    if (access === 'public') return true;
    await super.canActivate(context);
    if (access === 'authenticated') return true;
    if (context.switchToHttp().getRequest().user?.role !== USER_ROLE.ADMIN) {
      throw new ForbiddenException('Administrator access required');
    }
    return true;
  }
}
