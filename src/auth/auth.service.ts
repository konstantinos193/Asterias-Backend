import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument, UserModel } from '../models/user.model';
import { USER_ROLE } from '../common/enums';
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
  private readonly logger = new Logger(AuthService.name);

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

    // `password` is select: false, so this is the one read that asks for it.
    const user = await this.userModel.findForAuthentication(email);

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

    // The schema's toObject transform strips the credential fields, so this no
    // longer has to destructure them out by name.
    return user.toObject();
  }

  async login(user: any) {
    const payload = { email: user.email, sub: String(user._id), role: user.role, username: user.username };

    // Record the login here, where it actually happens.
    //
    // This used to be written only by PUT /users/:id/last-login, which the
    // frontend had to remember to call — so the value in the admin user list
    // was whatever a client last claimed, and a client that never called it
    // showed no logins at all. Failure to record it must not fail the login
    // itself, so the write is awaited but its error is only logged.
    try {
      await this.userModel.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    } catch (error) {
      this.logger.warn(
        `Could not record lastLogin for ${String(user._id)}: ${error instanceof Error ? error.message : error}`,
      );
    }

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
      role: USER_ROLE.USER,
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
