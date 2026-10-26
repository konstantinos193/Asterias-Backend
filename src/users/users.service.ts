import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserModel } from '../models/user.model';
import { USER_ROLE } from '../common/enums';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: UserModel) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findByEmail(email);
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id);
  }

  /**
   * No longer reachable over HTTP. Kept for internal callers, with the role
   * pinned so it cannot become an admin-creation path again — admins come from
   * UserModel.createAdmin.
   */
  async create(userData: Partial<User>): Promise<UserDocument> {
    const user = new this.userModel({ ...userData, role: USER_ROLE.USER });
    return user.save();
  }

  // updateLastLogin() is gone, along with the route that called it.
  // AuthService.login() records it where the login actually happens.

  async getPublicProfile(id: string): Promise<any> {
    const user = await this.findById(id);
    return user?.getPublicProfile();
  }
}
