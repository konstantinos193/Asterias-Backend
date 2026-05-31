import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type ChannelConfigDocument = ChannelConfig & Document;

@Schema({ timestamps: true })
export class ChannelConfig {
  @ApiProperty({ required: false })
  @Prop({ type: Types.ObjectId, ref: 'Room', required: false, default: null })
  roomId: Types.ObjectId | null;

  @ApiProperty()
  @Prop({ enum: ['bookingcom', 'airbnb'], required: true })
  platform: 'bookingcom' | 'airbnb';

  @ApiProperty()
  @Prop({ required: true, trim: true })
  importUrl: string;

  @ApiProperty()
  @Prop({ default: true })
  isActive: boolean;

  @ApiProperty()
  @Prop({ default: null })
  lastSyncedAt: Date;

  @ApiProperty()
  @Prop({ default: null })
  lastSyncError: string;

  @ApiProperty()
  @Prop({ default: 0 })
  syncedCount: number;
}

export const ChannelConfigSchema = SchemaFactory.createForClass(ChannelConfig);

ChannelConfigSchema.index({ roomId: 1, platform: 1 }, { unique: true, sparse: true });
