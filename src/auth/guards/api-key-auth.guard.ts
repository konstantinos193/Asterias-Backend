import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-api-key'];
    
    if (!key || key !== process.env.API_KEY) {
      throw new UnauthorizedException('Access token required');
    }
    
    return true;
  }
}
