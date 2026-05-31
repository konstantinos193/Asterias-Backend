import { Injectable, UnauthorizedException } from '@nestjs/common';
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
    console.log('🔍 NestJS AuthService.validateUser called with:', { email, passwordLength: password?.length });
    
    const user = await this.userModel.findByEmail(email);
    console.log('🔍 User found:', user ? { 
      id: user._id, 
      email: user.email, 
      username: user.username, 
      role: user.role,
      isActive: user.isActive 
    } : 'null');
    
    if (user && await user.comparePassword(password)) {
      console.log('🔍 Password validation successful');
      const { password, ...result } = user.toObject();
      return result;
    }
    
    console.log('🔍 Password validation failed or user not found');
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
      throw new UnauthorizedException('User with this email or username already exists');
    }

    // Create user with password - the pre-save hook will hash it
    const user = new this.userModel(userData);
    await user.save();

    // Log the user in after registration
    return this.login(user);
  }

  async createAdmin(adminData: Partial<User>) {
    return this.userModel.createAdmin(adminData);
  }
}
