import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Model } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Room, RoomDocument } from './room.model';

export type OfferDocument = Offer & Document & {
  isValidForDates(checkIn: Date, checkOut: Date): boolean;
  calculateDiscountedPrice(originalPrice: number): number;
};

// Interface for static methods
export interface OfferModel extends Model<OfferDocument> {
  getActiveOffers(): Promise<OfferDocument[]>;
  findByCode(code: string): Promise<OfferDocument | null>;
}

@Schema({ timestamps: true })
export class Offer {
  @ApiProperty()
  @Prop({ required: true, trim: true })
  title: string;

  @ApiProperty()
  @Prop({ required: false, trim: true })
  titleKey: string;

  @ApiProperty()
  @Prop({ required: true })
  description: string;

  @ApiProperty()
  @Prop({ required: false })
  descriptionKey: string;

  @ApiProperty()
  @Prop({ default: null })
  image: string;

  @ApiProperty()
  @Prop({ required: true, min: 0, max: 100 })
  discount: number;

  @ApiProperty()
  @Prop({ required: true })
  startDate: Date;

  @ApiProperty()
  @Prop({ required: true })
  endDate: Date;

  @ApiProperty()
  @Prop({ default: true })
  active: boolean;

  @ApiProperty()
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Room' }] })
  applicableRooms: Types.ObjectId[];

  @ApiProperty()
  @Prop({ default: 1, min: 1 })
  minStay: number;

  @ApiProperty()
  @Prop({ default: null })
  maxStay: number;

  @ApiProperty()
  @Prop({ default: '' })
  conditions: string;

  @ApiProperty()
  @Prop({ unique: true, sparse: true })
  code: string;

  @ApiProperty()
  @Prop()
  badgeKey: string;

  @ApiProperty()
  @Prop()
  roomTypeKey: string;

  @ApiProperty()
  @Prop({ type: [String] })
  includesKeys: string[];

  @ApiProperty()
  @Prop({ default: false })
  featured: boolean;
}

export const OfferSchema = SchemaFactory.createForClass(Offer);

// Index for better query performance
OfferSchema.index({ active: 1, startDate: 1, endDate: 1 });

// Virtual for checking if offer is currently valid
OfferSchema.virtual('isValid').get(function(this: OfferDocument) {
  const now = new Date();
  return this.active && 
         this.startDate <= now && 
         this.endDate >= now;
});

// Method to check if offer is valid for given dates
OfferSchema.methods.isValidForDates = function(checkIn: Date, checkOut: Date) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  return this.active && 
         this.startDate <= checkInDate && 
         this.endDate >= checkOutDate;
};

// Method to calculate discounted price
OfferSchema.methods.calculateDiscountedPrice = function(originalPrice: number) {
  return originalPrice * (1 - this.discount / 100);
};

// Static method to get active offers
OfferSchema.statics.getActiveOffers = function() {
  const now = new Date();
  return this.find({
    active: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).populate('applicableRooms');
};

// Static method to find offer by code
OfferSchema.statics.findByCode = function(code: string) {
  return this.findOne({ code: code.toUpperCase() });
};
