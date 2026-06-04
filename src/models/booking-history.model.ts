import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookingHistoryDocument = BookingHistory & Document;

@Schema({ timestamps: { createdAt: 'date', updatedAt: false } })
export class BookingHistory {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true })
  bookingId: Types.ObjectId;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  user: string;
}

export const BookingHistorySchema = SchemaFactory.createForClass(BookingHistory);
BookingHistorySchema.index({ bookingId: 1, date: -1 });
