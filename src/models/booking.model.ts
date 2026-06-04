import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Model } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Room, RoomDocument } from './room.model';

export type BookingDocument = Booking & Document & {
  totalGuests: number;
  nights: number;
};

// Interface for static methods
export interface BookingModel extends Model<BookingDocument> {
  isApartmentAvailable(roomTypeId: Types.ObjectId, checkIn: Date, checkOut: Date, roomModel: Model<RoomDocument>, excludeBookingId?: Types.ObjectId): Promise<boolean>;
  getAvailableApartmentCount(roomTypeId: Types.ObjectId, checkIn: Date, checkOut: Date, roomModel: Model<RoomDocument>): Promise<number>;
  isIndividualRoomAvailable(roomId: Types.ObjectId, checkIn: Date, checkOut: Date, excludeBookingId?: Types.ObjectId): Promise<boolean>;
  getStats(): Promise<any>;
}

@Schema({ timestamps: true })
export class Booking {
  @ApiProperty()
  @Prop({ required: true, unique: true })
  bookingNumber: string;

  @ApiProperty({ required: false })
  @Prop({ type: Types.ObjectId, ref: 'Room', required: false, default: null })
  roomId: Types.ObjectId | null;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  userId: Types.ObjectId;

  @ApiProperty()
  @Prop({
    type: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
      specialRequests: { type: String, default: '' },
      language: { type: String, enum: ['el', 'en', 'de'], default: 'en' }
    }
  })
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    specialRequests: string;
    language: 'el' | 'en' | 'de';
  };

  @ApiProperty()
  @Prop({ required: true })
  checkIn: Date;

  @ApiProperty()
  @Prop({ required: true })
  checkOut: Date;

  @ApiProperty()
  @Prop({ required: true, min: 1 })
  adults: number;

  @ApiProperty()
  @Prop({ default: 0, min: 0 })
  children: number;

  @ApiProperty()
  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @ApiProperty()
  @Prop({ enum: ['CARD', 'CASH'], required: true })
  paymentMethod: 'CARD' | 'CASH';

  @ApiProperty()
  @Prop({ enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING' })
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

  @ApiProperty()
  @Prop({ enum: ['CONFIRMED', 'PENDING', 'CANCELLED', 'CHECKED_IN', 'CHECKED_OUT'], default: 'CONFIRMED' })
  bookingStatus: 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT';

  @ApiProperty()
  @Prop({ default: null })
  stripePaymentIntentId: string;

  @ApiProperty()
  @Prop({ default: '' })
  notes: string;

  @ApiProperty()
  @Prop({ default: null })
  adminNotes: string;

  @ApiProperty()
  @Prop({ default: null })
  checkedInAt: Date;

  @ApiProperty()
  @Prop({ default: null })
  checkedOutAt: Date;

  @ApiProperty()
  @Prop({ default: null })
  bookingcom_booking_id: string;

  @ApiProperty()
  @Prop({ default: null })
  externalId: string;

  @ApiProperty()
  @Prop({ enum: ['asterias', 'bookingcom', 'airbnb'], default: 'asterias' })
  source: 'asterias' | 'bookingcom' | 'airbnb';

  @ApiProperty()
  @Prop({ default: null })
  cancelledAt: Date;

  @ApiProperty()
  @Prop({ default: null })
  cancellationReason: string;

  @ApiProperty()
  @Prop({ default: null })
  refundAmount: number;

  @ApiProperty()
  @Prop({ default: null })
  refundedAt: Date;

  @ApiProperty()
  @Prop({ default: 0 })
  depositAmount: number;

  @ApiProperty()
  @Prop({ default: false })
  depositPaid: boolean;

  @ApiProperty()
  @Prop({ default: null })
  depositPaidAt: Date;

  @ApiProperty()
  @Prop({ default: false })
  postCheckoutEmailSent: boolean;

  @ApiProperty()
  @Prop({ default: null })
  stripeRefundId: string;

  @ApiProperty()
  @Prop({ default: false })
  reminderSent: boolean;

  @ApiProperty({ description: 'Parent booking ID for multi-room bookings', required: false })
  @Prop({ default: null })
  parentBookingId: Types.ObjectId;

  @ApiProperty({ description: 'Child booking IDs for multi-room bookings', type: [Types.ObjectId], default: [] })
  @Prop({ type: [Types.ObjectId], default: [] })
  childBookingIds: Types.ObjectId[];

  @ApiProperty({ description: 'Room combination details for multi-room bookings', required: false })
  @Prop({ 
    type: {
      rooms: [{
        roomId: { type: Types.ObjectId, required: true },
        roomName: { type: String, required: true },
        count: { type: Number, required: true, min: 1 },
        occupancy: { type: Number, required: true, min: 1 },
        pricePerRoom: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 }
      }],
      totalCapacity: { type: Number, required: true, min: 1 },
      totalPrice: { type: Number, required: true, min: 0 },
      unusedBeds: { type: Number, required: true, min: 0 },
      combinationType: { type: String, enum: ['cheapest', 'best_value', 'most_comfortable'], required: true }
    },
    default: null
  })
  roomCombination: {
    rooms: Array<{
      roomId: Types.ObjectId;
      roomName: string;
      count: number;
      occupancy: number;
      pricePerRoom: number;
      totalPrice: number;
    }>;
    totalCapacity: number;
    totalPrice: number;
    unusedBeds: number;
    combinationType: 'cheapest' | 'best_value' | 'most_comfortable';
  };
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

// Index for better query performance
BookingSchema.index({ roomId: 1, checkIn: 1, checkOut: 1 });
BookingSchema.index({ userId: 1 });
BookingSchema.index({ paymentStatus: 1 });
BookingSchema.index({ bookingStatus: 1 });
BookingSchema.index({ parentBookingId: 1 });
BookingSchema.index({ childBookingIds: 1 });
BookingSchema.index({ createdAt: -1 });
BookingSchema.index({ paymentStatus: 1, createdAt: -1 });
BookingSchema.index({ checkIn: 1, bookingStatus: 1 });
BookingSchema.index({ checkOut: 1, bookingStatus: 1 });
BookingSchema.index({ 'guestInfo.email': 1 });
BookingSchema.index({ bookingcom_booking_id: 1 }, { sparse: true });
BookingSchema.index({ externalId: 1 }, { sparse: true });
BookingSchema.index({ checkIn: 1, checkOut: 1, bookingStatus: 1 });
BookingSchema.index({ source: 1, bookingStatus: 1 });
BookingSchema.index({ roomId: 1, bookingStatus: 1, checkIn: 1, checkOut: 1 });
BookingSchema.index({ stripePaymentIntentId: 1 }, { sparse: true });

// Virtual for total guests
BookingSchema.virtual('totalGuests').get(function(this: BookingDocument) {
  return this.adults + this.children;
});

// Virtual for nights
BookingSchema.virtual('nights').get(function(this: BookingDocument) {
  const checkIn = new Date(this.checkIn);
  const checkOut = new Date(this.checkOut);
  const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Static methods
BookingSchema.statics.isApartmentAvailable = async function(
  roomTypeId: Types.ObjectId,
  checkIn: Date,
  checkOut: Date,
  roomModel: Model<RoomDocument>,
  excludeBookingId: Types.ObjectId = null,
) {
  const roomType = await roomModel.findById(roomTypeId);
  if (!roomType) throw new Error('Room type not found');

  const query: any = {
    roomId: roomTypeId,
    bookingStatus: { $nin: ['CANCELLED'] },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const conflictingBookings = await this.countDocuments(query);
  return conflictingBookings < (roomType.totalRooms ?? 1);
};

BookingSchema.statics.getAvailableApartmentCount = async function(
  roomTypeId: Types.ObjectId,
  checkIn: Date,
  checkOut: Date,
  roomModel: Model<RoomDocument>,
) {
  const roomType = await roomModel.findById(roomTypeId);
  if (!roomType) return 0;

  const allRoomsOfType = await roomModel.find({ nameKey: roomType.nameKey });
  const totalRoomsOfType = allRoomsOfType.length;
  if (totalRoomsOfType === 0) return 0;

  const conflictingBookings = await this.countDocuments({
    roomId: { $in: allRoomsOfType.map((r: any) => r._id) },
    bookingStatus: { $nin: ['CANCELLED'] },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  });

  return Math.max(0, totalRoomsOfType - conflictingBookings);
};

BookingSchema.statics.isIndividualRoomAvailable = async function(
  roomId: Types.ObjectId,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId: Types.ObjectId = null,
) {
  const query: any = {
    roomId,
    bookingStatus: { $nin: ['CANCELLED'] },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const conflictingBookings = await this.countDocuments(query);
  return conflictingBookings === 0;
};

BookingSchema.statics.getStats = async function() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const [result] = await this.aggregate([
    {
      $facet: {
        overall: [
          {
            $group: {
              _id: null,
              totalBookings: { $sum: 1 },
              totalRevenue: { $sum: '$totalAmount' },
              averageBookingValue: { $avg: '$totalAmount' },
            },
          },
        ],
        today: [
          { $match: { checkIn: { $gte: startOfDay, $lt: endOfDay } } },
          { $count: 'count' },
        ],
      },
    },
  ]).option({ maxTimeMS: 5000 });

  return {
    ...result.overall[0],
    todayBookings: result.today[0]?.count ?? 0,
  };
};
