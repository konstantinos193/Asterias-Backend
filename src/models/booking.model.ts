import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Model } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { addDays, dayStart, todayAtProperty } from '../availability/availability-rules';
import {
  BOOKING_SOURCE,
  BOOKING_SOURCES,
  BOOKING_STATUS,
  BOOKING_STATUSES,
  BookingSource,
  BookingStatus,
  GUEST_LANGUAGE,
  GUEST_LANGUAGES,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  PAYMENT_STATUSES,
  PaymentMethod,
  PaymentStatus,
} from '../common/enums';

export type BookingDocument = Booking & Document & {
  totalGuests: number;
  nights: number;
};

/**
 * Static methods on the Booking model.
 *
 * This interface used to also declare isApartmentAvailable,
 * getAvailableApartmentCount and isIndividualRoomAvailable — a third copy of
 * the availability rules, after AvailabilityEngine and the deleted
 * availabilityCalculator.js. Because they were declared here they were
 * autocomplete-visible as `this.bookingModel.isApartmentAvailable(...)` from
 * every module that injects Booking, so any of them could have silently
 * bypassed the engine. AvailabilityEngine is the only availability authority;
 * nothing else may answer "is this bookable".
 */
export interface BookingModel extends Model<BookingDocument> {
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
      // Contact details are required of a guest booking online, but a walk-in
      // written down at the desk may have neither. Anything that emails a guest
      // skips a booking without an address rather than failing on it.
      email: { type: String, default: '', trim: true, lowercase: true },
      phone: { type: String, default: '', trim: true },
      specialRequests: { type: String, default: '' },
      language: { type: String, enum: GUEST_LANGUAGES, default: GUEST_LANGUAGE.EN }
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

  @ApiProperty({ description: 'Tax-inclusive amount charged to the guest' })
  @Prop({ required: true, min: 0 })
  totalAmount: number;

  // Price breakdown, frozen at booking time. Rates in settings can change later,
  // so recomputing a past booking would not reproduce what the guest actually
  // paid. Null on bookings made before this was recorded, and on admin bookings
  // with a manually negotiated total.
  @ApiProperty({ description: 'Pre-tax room subtotal for the whole stay, after any offer discount', required: false })
  @Prop({ default: null })
  roomSubtotal: number;

  // Already taken off roomSubtotal: roomSubtotal + discountAmount is the room
  // price before the offer. The title is copied so a deleted offer still reads.
  @ApiProperty({ description: 'Offer discount taken off the room subtotal', required: false })
  @Prop({ default: null })
  discountAmount: number;

  @ApiProperty({ description: 'Offer applied to the price', required: false })
  @Prop({ type: Types.ObjectId, ref: 'Offer', default: null })
  offerId: Types.ObjectId;

  @ApiProperty({ description: 'Offer title at booking time', required: false })
  @Prop({ default: null })
  offerTitle: string;

  @ApiProperty({ description: 'VAT charged on the room subtotal', required: false })
  @Prop({ default: null })
  vatAmount: number;

  @ApiProperty({ description: 'Municipal fee for the whole stay', required: false })
  @Prop({ default: null })
  municipalFee: number;

  @ApiProperty({ description: 'Climate resilience fee for the whole stay', required: false })
  @Prop({ default: null })
  environmentalTax: number;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @Prop({ enum: PAYMENT_METHODS, required: true })
  paymentMethod: PaymentMethod;

  @ApiProperty({ enum: PAYMENT_STATUSES })
  @Prop({ enum: PAYMENT_STATUSES, default: PAYMENT_STATUS.PENDING })
  paymentStatus: PaymentStatus;

  @ApiProperty({ enum: BOOKING_STATUSES })
  @Prop({ enum: BOOKING_STATUSES, default: BOOKING_STATUS.CONFIRMED })
  bookingStatus: BookingStatus;

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

  @ApiProperty({ enum: BOOKING_SOURCES })
  @Prop({ enum: BOOKING_SOURCES, default: BOOKING_SOURCE.ASTERIAS })
  source: BookingSource;

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

  /**
   * A guest asked to pay on arrival and the property has not accepted it yet.
   * Such a request holds no room — see occupyingBookingFilter — because
   * nothing has been paid and anyone can send one. Cleared when the owner
   * confirms the booking.
   */
  @ApiProperty()
  @Prop({ default: false })
  awaitingPropertyConfirmation: boolean;

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

// Any booking write changes what is for sale, so the cached availability goes.

// Indexes. Every one of these is write amplification on a collection written
// on every booking, cancellation and status change, so a single-field index
// whose field is already the prefix of a compound index below is not declared:
// Mongo can serve the single-field query from the compound one.
//   - {paymentStatus} is covered by {paymentStatus, createdAt}
//   - {roomId, checkIn, checkOut} is covered by
//     {roomId, bookingStatus, checkIn, checkOut} only for roomId-only queries,
//     so it is kept: the date-range predicate needs checkIn in position 2.
BookingSchema.index({ roomId: 1, checkIn: 1, checkOut: 1 });
BookingSchema.index({ userId: 1 });
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

/**
 * One booking per Stripe payment, enforced by the database.
 *
 * This is the only durable guarantee against double-booking a payment. The
 * application-level defences are both per-process and therefore both lost the
 * moment a second container is alive — which is exactly what happens during
 * every blue/green cutover:
 *
 *   - the in-flight Map in PaymentsService serialises concurrent callers, but
 *     only within one process;
 *   - the findOne({ stripePaymentIntentId }) check before the insert is a
 *     read-then-write race, and it runs outside the transaction.
 *
 * The return page and the webhook routinely arrive for the same payment inside
 * the same second. With two processes both missed the read, both passed
 * assertSellable in separate sessions, and both inserted. Unique here turns
 * that into an E11000 on the second insert, which the caller reads as
 * "already booked" — see PaymentsService.isDuplicatePaymentBooking.
 *
 * sparse: cash bookings and OTA imports have no payment intent, and a unique
 * index would otherwise collide on their shared null.
 */
// Sparse indexes include explicit nulls (the schema default on cash bookings).
// Only actual payment ids participate in the uniqueness guarantee.
BookingSchema.index({ stripePaymentIntentId: 1 }, {
  unique: true,
  partialFilterExpression: { stripePaymentIntentId: { $type: 'string' } },
});

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

BookingSchema.statics.getStats = async function() {
  // "Today" means today at the property, not today in the container's zone.
  // This used to build the window from new Date(y, m, d) in local time, which
  // only agreed with the stored UTC-midnight dates because the container has no
  // TZ set. Setting TZ=Europe/Athens would have shifted the window by 2-3 hours
  // and quietly moved bookings in and out of "today's arrivals".
  const today = todayAtProperty();
  const startOfDay = dayStart(today);
  const endOfDay = dayStart(addDays(today, 1));

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
