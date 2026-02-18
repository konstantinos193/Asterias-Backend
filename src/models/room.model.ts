import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type RoomDocument = Room & Document;

@Schema({ timestamps: true })
export class Room {
  @ApiProperty()
  @Prop({ required: true, trim: true })
  name: string;

  @ApiProperty()
  @Prop({ required: true })
  nameKey: string;

  @ApiProperty()
  @Prop({ required: true })
  description: string;

  @ApiProperty()
  @Prop({ required: true })
  descriptionKey: string;

  @ApiProperty()
  @Prop({ required: true, min: 0 })
  price: number;

  @ApiProperty()
  @Prop({ required: true, min: 1 })
  capacity: number;

  @ApiProperty()
  @Prop({ default: null })
  size: string;

  @ApiProperty()
  @Prop({ required: true })
  bedType: string;

  @ApiProperty()
  @Prop({ default: null })
  view: string;

  @ApiProperty()
  @Prop({ default: null })
  bathroom: string;

  @ApiProperty()
  @Prop({ type: [String] })
  features: string[];

  @ApiProperty()
  @Prop({ type: [String] })
  featureKeys: string[];

  @ApiProperty()
  @Prop({
    type: {
      wifi: { type: Boolean, default: true },
      ac: { type: Boolean, default: true },
      tv: { type: Boolean, default: true },
      minibar: { type: Boolean, default: false },
      balcony: { type: Boolean, default: false },
      seaView: { type: Boolean, default: false },
      roomService: { type: Boolean, default: false },
      safe: { type: Boolean, default: true }
    }
  })
  amenities: {
    wifi: boolean;
    ac: boolean;
    tv: boolean;
    minibar: boolean;
    balcony: boolean;
    seaView: boolean;
    roomService: boolean;
    safe: boolean;
  };

  @ApiProperty()
  @Prop({ default: 1, min: 1 })
  totalRooms: number;

  @ApiProperty()
  @Prop({ default: null })
  image: string;

  @ApiProperty()
  @Prop({ type: [String] })
  images: string[];

  @ApiProperty()
  @Prop({ default: 0, min: 0, max: 5 })
  rating: number;

  @ApiProperty()
  @Prop({ default: 0 })
  reviewCount: number;

  @ApiProperty()
  @Prop({ default: null, sparse: true })
  bookingcom_room_id: string;

  @ApiProperty()
  @Prop({ enum: ['asterias', 'bookingcom'], default: 'asterias' })
  source: 'asterias' | 'bookingcom';
}

export const RoomSchema = SchemaFactory.createForClass(Room);

// Index for better query performance
RoomSchema.index({ capacity: 1 });

// Virtual for average rating
RoomSchema.virtual('averageRating').get(function(this: RoomDocument) {
  return this.rating;
});

// Method to update rating
RoomSchema.methods.updateRating = function(this: RoomDocument, newRating: number) {
  const totalRating = (this.rating * this.reviewCount) + newRating;
  this.reviewCount += 1;
  this.rating = totalRating / this.reviewCount;
  return this.save();
};
