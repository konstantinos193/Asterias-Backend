import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import { Booking, BookingDocument } from '../../models/booking.model';
import { AvailabilityEngine } from '../../availability/availability-engine';
import { PricingService } from '../../pricing/pricing.service';
import { BookingNumberService } from '../../common/booking-number/booking-number.service';

export interface BookingWritePolicy {
  session?: ClientSession;
  pricing: 'quote' | 'paid' | 'negotiated' | 'external';
  inventory?: 'reserve' | 'override';
}

/** All booking inserts cross this boundary. External charges and owner prices
 * are explicit policies; ordinary bookings always reprice and reserve in Mongo.
 */
@Injectable()
export class BookingWriter {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<BookingDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly availability: AvailabilityEngine,
    private readonly pricing: PricingService,
    private readonly numbers: BookingNumberService,
  ) {}

  async create(input: Record<string, unknown>, policy: BookingWritePolicy): Promise<BookingDocument> {
    if (!policy.session) {
      const session = await this.connection.startSession();
      try {
        let booking: BookingDocument;
        await session.withTransaction(async () => { booking = await this.create(input, { ...policy, session }); });
        return booking;
      } finally { await session.endSession(); }
    }
    const data = { ...input };
    const roomId = String(data.roomId);
    const checkIn = new Date(data.checkIn as string | Date);
    const checkOut = new Date(data.checkOut as string | Date);
    if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime()) || checkOut <= checkIn) {
      throw new BadRequestException('Check-out must follow a valid check-in date');
    }
    if (policy.pricing !== 'external' && policy.inventory !== 'override') {
      await this.availability.assertSellable(roomId, checkIn, checkOut, policy.session);
    }
    if (policy.pricing === 'quote') {
      const adults = Number(data.adults), children = Number(data.children ?? 0);
      const quote = await this.pricing.quoteStay(roomId, checkIn, checkOut, adults, children);
      const taxes = await this.pricing.applyTaxes(quote.subtotal, quote.nights, adults + children);
      Object.assign(data, { totalAmount: taxes.total, roomSubtotal: quote.subtotal,
        vatAmount: taxes.vatAmount, municipalFee: taxes.municipalFee, environmentalTax: taxes.environmentalTax });
    }
    const amount = Number(data.totalAmount);
    if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException('Invalid booking amount');
    data.bookingNumber ||= await this.numbers.next(policy.session);
    const booking = new this.bookings(data);
    return booking.save({ session: policy.session });
  }
}
