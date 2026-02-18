import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Model } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type ContactDocument = Contact & Document & {
  markAsRead(): Promise<ContactDocument>;
  reply(message: string, respondedBy: Types.ObjectId): Promise<ContactDocument>;
  close(): Promise<ContactDocument>;
  fullName: string;
};

export interface ContactModel extends Model<ContactDocument> {
  getUnread(): Promise<ContactDocument[]>;
  getByStatus(status: string): Promise<ContactDocument[]>;
  getStats(): Promise<{
    total: number;
    unread: number;
    byStatus: Record<string, number>;
  }>;
}

@Schema({ timestamps: true })
export class Contact {
  @ApiProperty()
  @Prop({ required: true, trim: true })
  name: string;

  @ApiProperty()
  @Prop({ required: true, trim: true, lowercase: true })
  email: string;

  @ApiProperty()
  @Prop({ trim: true })
  phone: string;

  @ApiProperty()
  @Prop({ required: true, trim: true })
  subject: string;

  @ApiProperty()
  @Prop({ required: true })
  message: string;

  @ApiProperty()
  @Prop({ enum: ['UNREAD', 'READ', 'REPLIED', 'CLOSED'], default: 'UNREAD' })
  status: 'UNREAD' | 'READ' | 'REPLIED' | 'CLOSED';

  @ApiProperty()
  @Prop({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' })
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  assignedTo: Types.ObjectId;

  @ApiProperty()
  @Prop({
    type: {
      message: { type: String, required: true },
      respondedBy: { type: Types.ObjectId, ref: 'User' },
      respondedAt: { type: Date, required: true }
    }
  })
  response: {
    message: string;
    respondedBy: Types.ObjectId;
    respondedAt: Date;
  };

  @ApiProperty()
  @Prop([{ type: String, trim: true }])
  tags: string[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);

// Index for better query performance
ContactSchema.index({ status: 1, createdAt: -1 });
ContactSchema.index({ email: 1 });
ContactSchema.index({ assignedTo: 1 });

// Virtual for full name
ContactSchema.virtual('fullName').get(function(this: ContactDocument) {
  return this.name;
});

// Method to mark as read
ContactSchema.methods.markAsRead = function(this: ContactDocument): Promise<ContactDocument> {
  this.status = 'READ';
  return this.save();
};

// Method to reply to contact
ContactSchema.methods.reply = function(this: ContactDocument, responseMessage: string, respondedBy: Types.ObjectId): Promise<ContactDocument> {
  this.status = 'REPLIED';
  this.response = {
    message: responseMessage,
    respondedBy: respondedBy,
    respondedAt: new Date()
  };
  return this.save();
};

// Method to close contact
ContactSchema.methods.close = function(this: ContactDocument): Promise<ContactDocument> {
  this.status = 'CLOSED';
  return this.save();
};

// Static method to get unread contacts
ContactSchema.statics.getUnread = function(): Promise<ContactDocument[]> {
  return this.find({ status: 'UNREAD' }).sort({ createdAt: -1 });
};

// Static method to get contacts by status
ContactSchema.statics.getByStatus = function(status: string): Promise<ContactDocument[]> {
  return this.find({ status }).sort({ createdAt: -1 });
};

// Static method to get contact statistics
ContactSchema.statics.getStats = async function(): Promise<{
  total: number;
  unread: number;
  byStatus: Record<string, number>;
}> {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const total = await this.countDocuments();
  const unread = await this.countDocuments({ status: 'UNREAD' });

  return {
    total,
    unread,
    byStatus: stats.reduce((acc: Record<string, number>, stat: { _id: string; count: number }) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {})
  };
};
