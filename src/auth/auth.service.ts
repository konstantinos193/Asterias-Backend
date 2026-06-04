import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument, UserModel } from '../models/user.model';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: UserModel,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userModel.findByEmail(email);
    if (user && await user.comparePassword(password)) {
      const { password, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user._id, role: user.role, username: user.username };
    
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

    // Create user with password - the pre-save hook will hash it
    const user = new this.userModel(userData);
    try {
      await user.save();
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException('User with this email or username already exists');
      }
      throw err;
    }

    // Log the user in after registration
    return this.login(user);
  }

  async createAdmin(adminData: Partial<User>) {
    return this.userModel.createAdmin(adminData);
  }
}
