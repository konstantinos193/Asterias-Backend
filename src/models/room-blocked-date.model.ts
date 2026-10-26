import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { bumpRevisionOnWrite } from '../availability/availability-revision';

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

  /**
   * A closure the owner has parked rather than deleted: the row stays so the
   * dates and reason can be put back in one click, but availability ignores it.
   * See closureFilter — nothing inactive reaches the occupancy grid.
   */
  @Prop({ default: true })
  active: boolean;
}

export const RoomBlockedDateSchema = SchemaFactory.createForClass(RoomBlockedDate);

// Closing or reopening dates has to reach the guest calendar immediately.
bumpRevisionOnWrite(RoomBlockedDateSchema);

RoomBlockedDateSchema.index({ roomId: 1, startDate: 1, endDate: 1 });
RoomBlockedDateSchema.index({ startDate: 1, endDate: 1 });
