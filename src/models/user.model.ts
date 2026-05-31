import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';

export type UserDocument = User & Document & {
  comparePassword(candidatePassword: string): Promise<boolean>;
  getPublicProfile(): any;
  updateLastLogin(): Promise<UserDocument>;
};

// Interface for static methods
export interface UserModel extends Model<UserDocument> {
  findByEmail(email: string): Promise<UserDocument | null>;
  findByUsername(username: string): Promise<UserDocument | null>;
  createAdmin(adminData: Partial<User>): Promise<UserDocument>;
}

@Schema({ timestamps: true })
export class User {
  @ApiProperty()
  @Prop({ required: true, trim: true })
  name: string;

  @ApiProperty()
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  username: string;

  @ApiProperty()
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @ApiProperty()
  @Prop({ required: true, minlength: 6 })
  password: string;

  @ApiProperty()
  @Prop({ enum: ['ADMIN', 'USER'], default: 'USER' })
  role: 'ADMIN' | 'USER';

  @ApiProperty()
  @Prop({ trim: true })
  phone: string;

  @ApiProperty()
  @Prop({
    type: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  })
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  @ApiProperty()
  @Prop({
    type: {
      language: { type: String, default: 'en' },
      currency: { type: String, default: 'EUR' },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false }
      }
    }
  })
  preferences: {
    language: string;
    currency: string;
    notifications: {
      email: boolean;
      sms: boolean;
    };
  };

  @ApiProperty()
  @Prop({ default: true })
  isActive: boolean;

  @ApiProperty()
  @Prop({ default: null })
  lastLogin: Date;

  @ApiProperty()
  @Prop()
  resetPasswordToken: string;

  @ApiProperty()
  @Prop()
  resetPasswordExpires: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add static methods to the schema
UserSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.findByUsername = function(username: string) {
  return this.findOne({ username: username.toLowerCase() });
};

UserSchema.statics.createAdmin = async function(adminData: Partial<User>) {
  const admin = new this({
    ...adminData,
    role: 'ADMIN'
  });
  return admin.save();
};

// Index for better query performance
UserSchema.index({ role: 1 });

// Pre-save middleware to hash password
UserSchema.pre('save', async function() {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return;
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    // In Mongoose pre-save hooks without next(), we throw the error
    throw error;
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword: string) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile (without password)
UserSchema.methods.getPublicProfile = function(this: UserDocument) {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpires;
  return userObject;
};

// Method to update last login
UserSchema.methods.updateLastLogin = function(this: UserDocument) {
  this.lastLogin = new Date();
  return this.save();
};
