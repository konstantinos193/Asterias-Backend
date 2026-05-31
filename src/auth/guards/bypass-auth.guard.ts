import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BypassAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // For development/testing, we'll allow requests without authentication
    // but still process valid JWT tokens if provided
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    
    // If no auth header, create a development admin user for testing
    if (!authHeader) {
      // Create a mock admin user for development
      request.user = {
        _id: 'dev-admin-id',
        email: 'admin@dev.local',
        role: 'ADMIN',
        username: 'dev-admin',
        name: 'Development Admin'
      };
      return true;
    }
    
    // If auth header exists, try to validate JWT
    try {
      const result = super.canActivate(context);
      
      // Handle different return types
      if (result instanceof Observable) {
        const resolved = await firstValueFrom(result);
        if (!resolved) {
          // Fallback to dev admin if JWT fails
          request.user = {
            _id: 'dev-admin-id',
            email: 'admin@dev.local',
            role: 'ADMIN',
            username: 'dev-admin',
            name: 'Development Admin'
          };
          return true;
        }
        return resolved;
      } else if (result instanceof Promise) {
        const resolved = await result;
        if (!resolved) {
          // Fallback to dev admin if JWT fails
          request.user = {
            _id: 'dev-admin-id',
            email: 'admin@dev.local',
            role: 'ADMIN',
            username: 'dev-admin',
            name: 'Development Admin'
          };
          return true;
        }
        return resolved;
      } else {
        // Boolean result
        if (!result) {
          // Fallback to dev admin if JWT fails
          request.user = {
            _id: 'dev-admin-id',
            email: 'admin@dev.local',
            role: 'ADMIN',
            username: 'dev-admin',
            name: 'Development Admin'
          };
          return true;
        }
        return result;
      }
    } catch (error) {
      // If JWT validation throws an error, fallback to dev admin
      request.user = {
        _id: 'dev-admin-id',
        email: 'admin@dev.local',
        role: 'ADMIN',
        username: 'dev-admin',
        name: 'Development Admin'
      };
      return true;
    }
  }
}
