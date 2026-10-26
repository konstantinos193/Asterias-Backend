import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { User, UserModel } from '../../models/user.model';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectModel(User.name) private userModel: UserModel,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    if (jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      algorithms: ['HS256'],
    });
  }

  /**
   * The role comes from the database, not from the token. Tokens live for days,
   * so a payload-trusted role meant demoting an admin — or deactivating an
   * account entirely — did nothing until the token expired on its own.
   */
  async validate(payload: any) {
    if (!payload?.sub || !Types.ObjectId.isValid(String(payload.sub))) {
      throw new UnauthorizedException();
    }

    const user = await this.userModel
      .findById(payload.sub)
      .select('_id email role username isActive')
      .lean()
      .exec();

    if (!user || user.isActive === false) {
      throw new UnauthorizedException();
    }

    return {
      _id: String(user._id),
      email: user.email,
      role: user.role,
      username: user.username || null,
    };
  }
}
