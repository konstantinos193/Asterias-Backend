import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomSeasonalPricingDocument = RoomSeasonalPricing & Document;

@Schema({ timestamps: true })
export class RoomSeasonalPricing {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ type: [{ guests: Number, price: Number }], default: [] })
  pricingByOccupancy: { guests: number; price: number }[];
}

export const RoomSeasonalPricingSchema = SchemaFactory.createForClass(RoomSeasonalPricing);
RoomSeasonalPricingSchema.index({ roomId: 1, startDate: 1, endDate: 1 });
RoomSeasonalPricingSchema.index({ startDate: 1, endDate: 1 });
