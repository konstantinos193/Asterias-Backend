import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    console.log('🔍 LocalStrategy.validate called with:', { email, passwordLength: password?.length });
    
    const user = await this.authService.validateUser(email, password);
    
    console.log('🔍 AuthService returned:', user ? { 
      id: user._id, 
      email: user.email, 
      role: user.role 
    } : 'null');
    
    if (!user) {
      console.log('🔍 Throwing UnauthorizedException');
      throw new UnauthorizedException();
    }
    
    console.log('🔍 LocalStrategy validation successful');
    return user;
  }
}
