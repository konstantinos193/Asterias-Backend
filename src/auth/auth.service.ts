import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument, UserModel } from '../models/user.model';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

/**
 * Compared against when no user matches, so a miss costs the same as a wrong
 * password. Without it the response time tells an attacker which addresses are
 * registered.
 */
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMye1VdLi4hOqXUXQFJ5QvR9nKDUWxRo1Vy';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: UserModel,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    // Guards run before pipes, so LocalStrategy reaches this with the raw body
    // and LoginDto's constraints have not been applied yet. Bound the inputs
    // here or an oversized password turns every login attempt into a bcrypt
    // workout for the server.
    if (typeof email !== 'string' || typeof password !== 'string') {
      return null;
    }
    if (email.length > 254 || password.length === 0 || password.length > 72) {
      return null;
    }

    const user = await this.userModel.findByEmail(email);

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      return null;
    }

    const passwordMatches = await user.comparePassword(password);
    // Deactivating an account has to actually lock it out; the old check only
    // looked at the password.
    if (!passwordMatches || user.isActive === false) {
      return null;
    }

    const { password: _password, resetPasswordToken, resetPasswordExpires, ...result } = user.toObject();
    return result;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: String(user._id), role: user.role, username: user.username };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        username: user.username,
      },
    };
  }

  async register(userData: Partial<User>) {
    const existingUser = await this.userModel.findOne({
      $or: [
        { email: userData.email },
        { username: userData.username }
      ]
    });

    if (existingUser) {
      throw new ConflictException('User with this email or username already exists');
    }

    // Self-service registration never mints an admin. The DTO drops `role`
    // before we get here; pinning it again means a future DTO change cannot
    // quietly reopen the escalation. Admins are created by seed/CLI through
    // UserModel.createAdmin.
    const user = new this.userModel({
      ...userData,
      role: 'USER',
      isActive: true,
    });

    try {
      await user.save();
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException('User with this email or username already exists');
      }
      throw err;
    }

    return this.login(user);
  }

  async createAdmin(adminData: Partial<User>) {
    return this.userModel.createAdmin(adminData);
  }
}
