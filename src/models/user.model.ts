import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { USER_ROLE, USER_ROLES, UserRole } from '../common/enums';

export type UserDocument = User & Document & {
  comparePassword(candidatePassword: string): Promise<boolean>;
  getPublicProfile(): any;
};

// Interface for static methods
export interface UserModel extends Model<UserDocument> {
  findByEmail(email: string): Promise<UserDocument | null>;
  /**
   * The only read that pulls the password hash back out. Everything else gets a
   * document without it, because `password` is `select: false`.
   */
  findForAuthentication(email: string): Promise<UserDocument | null>;
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

  /**
   * The bcrypt hash. `select: false` keeps it out of every query that does not
   * ask for it by name, and the toJSON transform below strips it even if a
   * future `select('+password')` leaks into a response path.
   *
   * It was previously selected by default and kept out of responses only by
   * hand, at each call site: a destructure in AuthService, an explicit
   * `.select()` in JwtStrategy, a `.select('-password ...')` in AdminService.
   * All three were correct, and one forgotten `.select()` anywhere would have
   * shipped the hashes.
   *
   * No @ApiProperty: it used to be documented as a field of the User schema, so
   * the generated Swagger showed it as part of every user response.
   */
  @Prop({ required: true, minlength: 6, select: false })
  password: string;

  @ApiProperty({ enum: USER_ROLES })
  @Prop({ enum: USER_ROLES, default: USER_ROLE.USER })
  role: UserRole;

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
  // Optional in the schema, so optional in the type: a user can save a city
  // without a postcode.
  address: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
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

  /**
   * Set by AuthService.login(). It used to be written only by
   * `PUT /users/:id/last-login`, which the frontend had to remember to call —
   * so "last login" in the admin user list was client-reported server state,
   * and any client could set it to anything.
   */
  @ApiProperty()
  @Prop({ default: null })
  lastLogin: Date;

  // Password-reset credentials: same treatment as the hash. Not documented in
  // Swagger and never selected unless asked for by name.
  @Prop({ select: false })
  resetPasswordToken: string;

  @Prop({ select: false })
  resetPasswordExpires: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

/**
 * Defence in depth for the credential fields.
 *
 * `select: false` already keeps these out of query results, but a transform is
 * what makes a mistake safe rather than merely unlikely: any document that does
 * end up holding them — a `select('+password')` whose result is returned, a
 * document still in memory after `save()` — is serialised without them.
 */
function stripCredentials(_doc: unknown, ret: Record<string, any>) {
  delete ret.password;
  delete ret.resetPasswordToken;
  delete ret.resetPasswordExpires;
  return ret;
}
UserSchema.set('toJSON', { transform: stripCredentials });
UserSchema.set('toObject', { transform: stripCredentials });

// Add static methods to the schema
UserSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.findForAuthentication = function(email: string) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

UserSchema.statics.createAdmin = async function(adminData: Partial<User>) {
  const admin = new this({
    ...adminData,
    role: USER_ROLE.ADMIN,
  });
  return admin.save();
};

// Indexes. {role} alone is not declared: it is the prefix of {role, isActive}
// and Mongo serves a role-only query from that compound index.
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ isActive: 1, createdAt: -1 });
UserSchema.index({ name: 'text', email: 'text', username: 'text' });

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

/**
 * Kept for call sites that want the intent spelled out, but the credential
 * stripping is now the schema's own toObject transform rather than three
 * deletes here that had to be kept in step with the schema by hand.
 */
UserSchema.methods.getPublicProfile = function(this: UserDocument) {
  return this.toObject();
};
