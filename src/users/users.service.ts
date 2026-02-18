import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserModel } from '../models/user.model';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: UserModel) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findByEmail(email);
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id);
  }

  async create(userData: Partial<User>): Promise<UserDocument> {
    const user = new this.userModel(userData);
    return user.save();
  }

  async updateLastLogin(id: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, { lastLogin: new Date() }, { new: true });
  }

  async getPublicProfile(id: string): Promise<any> {
    const user = await this.findById(id);
    return user?.getPublicProfile();
  }
}
