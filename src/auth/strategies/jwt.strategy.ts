import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET') || 'your-secret-key';
    console.log('🔍 JWT Strategy initialized with secret:', jwtSecret.substring(0, 10) + '...');
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    console.log('🔍 JWT Strategy validate called with payload:', payload);
    const user = { 
      _id: payload.sub, 
      email: payload.email, 
      role: payload.role,
      username: payload.username || null
    };
    console.log('🔍 JWT Strategy returning user:', user);
    return user;
  }
}
