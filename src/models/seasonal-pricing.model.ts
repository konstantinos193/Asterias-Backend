import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type SeasonalPricingDocument = SeasonalPricing & Document;

/**
 * Property-wide seasonal pricing. A period defines a date range and a nightly
 * price PER ROOM TYPE (2beds / 3beds / 4beds), like a Booking.com / Airbnb rate
 * plan. Any type left undefined falls back to the room's base `price`.
 *
 * Dates are stored as midnight UTC of the calendar day. A period covers a NIGHT
 * when `startDate <= night <= endDate` (endDate is the last priced night).
 */
@Schema({ timestamps: true })
export class SeasonalPricing {
  @ApiProperty()
  @Prop({ required: true, trim: true })
  name: string;

  @ApiProperty()
  @Prop({ required: true })
  startDate: Date;

  @ApiProperty()
  @Prop({ required: true })
  endDate: Date;

  @ApiProperty()
  @Prop({
    type: {
      '2beds': { type: Number, min: 0 },
      '3beds': { type: Number, min: 0 },
      '4beds': { type: Number, min: 0 },
    },
    default: {},
  })
  prices: {
    '2beds'?: number;
    '3beds'?: number;
    '4beds'?: number;
  };

  @ApiProperty()
  @Prop({ default: 0 })
  priority: number;

  @ApiProperty()
  @Prop({ default: true })
  active: boolean;
}

export const SeasonalPricingSchema = SchemaFactory.createForClass(SeasonalPricing);

SeasonalPricingSchema.index({ startDate: 1, endDate: 1 });
SeasonalPricingSchema.index({ active: 1, startDate: 1, endDate: 1 });
