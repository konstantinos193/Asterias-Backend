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

  /**
   * Per-locale name and description overrides.
   *
   * `name` and `description` above are a single English string that every
   * locale rendered verbatim, so /el/rooms/<id>, /en/rooms/<id> and
   * /de/rooms/<id> shipped near-identical bodies. Google treats that as one
   * page in three places and indexes at most one of them — which is a large
   * part of why Search Console reports 60 URLs discovered but not indexed.
   *
   * `descriptionKey` is not a substitute: every room points at the same generic
   * key ("rooms.standard.description"), so falling back to it would swap
   * cross-locale duplication for cross-room duplication.
   *
   * Anything omitted here falls back to the English `name`/`description`, so
   * this is safe to leave empty — it simply keeps the current behaviour for
   * that locale until real copy is written in the admin panel.
   */
  @ApiProperty({
    required: false,
    description: 'Per-locale name/description overrides, e.g. { el: { name, description } }',
  })
  @Prop({
    type: {
      el: { name: { type: String }, description: { type: String } },
      en: { name: { type: String }, description: { type: String } },
      de: { name: { type: String }, description: { type: String } },
    },
    default: {},
    _id: false,
  })
  translations: {
    el?: { name?: string; description?: string };
    en?: { name?: string; description?: string };
    de?: { name?: string; description?: string };
  };

  @ApiProperty()
  @Prop({ required: true, min: 0 })
  price: number;

  @ApiProperty()
  @Prop({ type: [{ guests: Number, price: Number }], default: [] })
  pricingByOccupancy: { guests: number; price: number }[];

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
  @Prop({ enum: ['ground', 'upper'], default: 'ground' })
  floor: 'ground' | 'upper';

  /**
   * Largest occupancy this room is sold at. Descriptive only — the rate a stay
   * pays is chosen from the GUEST COUNT (see PricingService), because every room
   * here is the same layout and is sold as a 2-, 3- or 4-bed.
   */
  @ApiProperty()
  @Prop({ enum: ['2beds', '3beds', '4beds'], required: true })
  roomType: '2beds' | '3beds' | '4beds';

  /**
   * Flat €/night added on top of whatever rate applies — seasonal or base.
   * Used for the one room whose balcony has the sea view, so the premium
   * survives every seasonal period instead of being overwritten by it.
   */
  @ApiProperty()
  @Prop({ default: 0 })
  priceAdjustment: number;

  @ApiProperty()
  @Prop({ type: [String] })
  features: string[];

  @ApiProperty()
  @Prop({ type: [String], default: [] })
  customAmenities: string[];

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
  @Prop({ default: true })
  available: boolean;

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
  @Prop({ sparse: true })
  bookingcom_room_id: string;

  @ApiProperty()
  @Prop({ sparse: true, default: null })
  airbnb_room_id: string;

  @ApiProperty()
  @Prop({ enum: ['asterias', 'bookingcom'], default: 'asterias' })
  source: 'asterias' | 'bookingcom';

  @ApiProperty()
  @Prop({ default: 999, min: 0 })
  sortOrder: number;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

// Index for better query performance
RoomSchema.index({ capacity: 1 });
RoomSchema.index({ available: 1 });
RoomSchema.index({ available: 1, capacity: 1 });
RoomSchema.index({ nameKey: 1 }, { unique: true });
RoomSchema.index({ roomType: 1 });
RoomSchema.index({ roomType: 1, available: 1, sortOrder: 1 });
RoomSchema.index({ sortOrder: 1 });
RoomSchema.index({ source: 1 });
RoomSchema.index({ bookingcom_room_id: 1 }, { sparse: true });

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
