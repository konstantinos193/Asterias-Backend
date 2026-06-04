import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomBlockedDateDocument = RoomBlockedDate & Document;

@Schema({ timestamps: true })
export class RoomBlockedDate {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ default: '' })
  reason: string;
}

export const RoomBlockedDateSchema = SchemaFactory.createForClass(RoomBlockedDate);
RoomBlockedDateSchema.index({ roomId: 1, startDate: 1, endDate: 1 });
RoomBlockedDateSchema.index({ startDate: 1, endDate: 1 });
