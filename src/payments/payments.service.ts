import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ClientSession, Connection, Model } from 'mongoose';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Room, RoomSchema } from '../models/room.model';
import { Booking, BookingSchema } from '../models/booking.model';
import { RoomBlockedDate, RoomBlockedDateDocument } from '../models/room-blocked-date.model';
import { PricingService } from '../pricing/pricing.service';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private stripe: InstanceType<typeof Stripe>;

  constructor(
    @InjectModel('Room') private roomModel: Model<Room>,
    @InjectModel('Booking') private bookingModel: Model<Booking>,
    @InjectModel(RoomBlockedDate.name)
    private roomBlockedDateModel: Model<RoomBlockedDateDocument>,
    @InjectConnection() private connection: Connection,
    private pricingService: PricingService,
  ) {
    this.stripe = process.env.STRIPE_SECRET_KEY
      ? new Stripe(process.env.STRIPE_SECRET_KEY)
      : null;
  }

  async createPaymentIntent(createPaymentIntentDto: any) {
    if (!this.stripe) {
      throw new HttpException('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const {
      roomId,
      checkIn,
      checkOut,
      adults,
      children = 0,
      currency = 'eur',
      offerId
    } = createPaymentIntentDto;

    // Check if room exists
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }

    // Quick availability check (full atomic check happens at booking creation time)
    await this.assertUnitAvailable(roomId, room.totalRooms, new Date(checkIn), new Date(checkOut));

    // Calculate total amount
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Seasonal-aware, per-night pricing (single source of truth)
    const quote = await this.pricingService.quoteStay(room, checkInDate, checkOutDate, adults, children);
    const nights = quote.nights;
    let basePrice = quote.subtotal;
    let discountAmount = 0;
    let appliedOffer = null;

    // Apply offer discount if offerId is provided
    // TODO: apply offer discount (offerId present but offer logic not yet implemented)

    // Taxes come from PricingService — the SAME code path that backs
    // GET /rooms/:id/quote, which is what the booking wizard displays. Never
    // duplicate this math here: divergence between the two is a guest overcharge.
    const totalGuests = parseInt(adults) + parseInt(children || 0);
    const { vatAmount, municipalFee, environmentalTax, total } =
      await this.pricingService.applyTaxes(basePrice, nights, totalGuests);

    const totalAmount = Math.round(total * 100); // Convert to cents

    if (totalAmount <= 0) {
      throw new HttpException('Invalid amount', HttpStatus.BAD_REQUEST);
    }

    // Check if amount exceeds Stripe's limit
    if (totalAmount > 99999999) { // €999,999.99 in cents
      throw new HttpException('Amount exceeds maximum allowed limit', HttpStatus.BAD_REQUEST);
    }

    // Create payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: totalAmount,
      currency: currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        roomId: roomId,
        checkIn: checkIn,
        checkOut: checkOut,
        adults: adults,
        children: children,
        nights: nights,
        offerId: offerId || '',
        originalPrice: basePrice.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        finalPrice: basePrice.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        municipalFee: municipalFee.toFixed(2),
        environmentalTax: environmentalTax.toFixed(2),
        totalGuests: totalGuests.toString(),
        seasonalBreakdown: JSON.stringify(quote.perNight.map(n => ({ d: n.date, p: n.price, s: n.source }))).slice(0, 480),
      }
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalAmount / 100,
      currency: currency,
      appliedOffer: appliedOffer,
      originalPrice: basePrice,
      discountAmount: discountAmount,
      finalPrice: basePrice,
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      municipalFee: parseFloat(municipalFee.toFixed(2)),
      environmentalTax: parseFloat(environmentalTax.toFixed(2)),
      timestamp: new Date().toISOString()
    };
  }

  async confirmPayment(confirmPaymentDto: any) {
    if (!this.stripe) {
      throw new HttpException('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const { paymentIntentId, guestInfo, specialRequests } = confirmPaymentDto;

    // Retrieve payment intent from Stripe
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      throw new HttpException('Payment not completed', HttpStatus.BAD_REQUEST);
    }

    // Extract metadata
    const {
      roomId,
      checkIn,
      checkOut,
      adults,
      children,
      nights,
      offerId,
      originalPrice,
      discountAmount,
      finalPrice,
      vatAmount,
      municipalFee,
      environmentalTax,
    } = paymentIntent.metadata;

    // The breakdown recorded on the PaymentIntent when the guest was quoted.
    // Stored on the booking so the admin panel can show what the total is made
    // of without re-deriving it from rates that may since have changed.
    const num = (v?: string) => {
      const n = parseFloat(v ?? '');
      return Number.isFinite(n) ? n : null;
    };

    // Check if room still exists
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }

    // Idempotency: if a booking for this payment intent already exists, return it
    const existing = await this.bookingModel.findOne({ stripePaymentIntentId: paymentIntentId });
    if (existing) {
      return { message: 'Payment confirmed and booking created successfully', booking: existing };
    }

    const bookingNumber = await this.generateBookingNumber();
    const session = await this.connection.startSession();
    let booking: any;
    try {
      await session.withTransaction(async () => {
        await this.assertUnitAvailable(
          roomId,
          room.totalRooms,
          new Date(checkIn),
          new Date(checkOut),
          session,
        );

        booking = new this.bookingModel({
          roomId,
          guestInfo: { ...guestInfo, specialRequests: specialRequests || '' },
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          adults: parseInt(adults),
          children: parseInt(children),
          totalAmount: paymentIntent.amount / 100,
          roomSubtotal: num(originalPrice),
          vatAmount: num(vatAmount),
          municipalFee: num(municipalFee),
          environmentalTax: num(environmentalTax),
          paymentMethod: 'CARD',
          paymentStatus: 'PAID',
          bookingStatus: 'CONFIRMED',
          stripePaymentIntentId: paymentIntentId,
          bookingNumber,
        });
        await booking.save({ session });
      });
    } finally {
      await session.endSession();
    }

    return {
      message: 'Payment confirmed and booking created successfully',
      booking,
    };
  }

  async createCashBooking(createCashBookingDto: any) {
    const { roomId, checkIn, checkOut, adults, children, totalAmount, guestInfo, specialRequests, depositAmount, depositPaid } = createCashBookingDto;

    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }

    // Price the stay server-side either way: an omitted amount must fall back to
    // the tax-inclusive total (the pre-tax subtotal is not what a guest pays),
    // and we need the breakdown to record on the booking.
    const quote = await this.pricingService.quoteStay(room, new Date(checkIn), new Date(checkOut), adults, children);
    const cashGuests = (parseInt(String(adults)) || 0) + (parseInt(String(children)) || 0);
    const taxes = await this.pricingService.applyTaxes(quote.subtotal, quote.nights, cashGuests);

    // Cash is collected in person, so we honour the caller's amount (admins may
    // enter a negotiated total, and the public wizard sends the same total the
    // guest was shown).
    let resolvedTotal = parseFloat(totalAmount);
    if (!Number.isFinite(resolvedTotal) || resolvedTotal <= 0) {
      resolvedTotal = taxes.total;
    }

    // Only record a breakdown when its lines actually sum to the stored total.
    // A negotiated admin price is not explained by these figures, and showing
    // them anyway would put numbers that do not add up in front of the owner.
    const breakdown =
      Math.abs(resolvedTotal - taxes.total) < 0.01
        ? {
            roomSubtotal: quote.subtotal,
            vatAmount: taxes.vatAmount,
            municipalFee: taxes.municipalFee,
            environmentalTax: taxes.environmentalTax,
          }
        : {};

    const bookingNumber = await this.generateBookingNumber();
    const session = await this.connection.startSession();
    let booking: any;
    try {
      await session.withTransaction(async () => {
        await this.assertUnitAvailable(
          roomId,
          room.totalRooms,
          new Date(checkIn),
          new Date(checkOut),
          session,
        );

        booking = new this.bookingModel({
          roomId,
          guestInfo: { ...guestInfo, specialRequests: specialRequests || '' },
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          adults: parseInt(adults),
          children: parseInt(children),
          totalAmount: resolvedTotal,
          ...breakdown,
          paymentMethod: 'CASH',
          paymentStatus: 'PENDING',
          bookingStatus: 'CONFIRMED',
          bookingNumber,
          depositAmount: depositAmount != null ? parseFloat(depositAmount) : 0,
          depositPaid: depositPaid === true || depositPaid === 'true',
          depositPaidAt: (depositPaid === true || depositPaid === 'true') ? new Date() : null,
        });
        await booking.save({ session });
      });
    } finally {
      await session.endSession();
    }

    return {
      message: 'Cash booking created successfully',
      booking,
    };
  }

  // Explicit return type: inferring it would reference Stripe's internal
  // PaymentIntent Status union, which is not importable from here.
  async getPaymentStatus(
    paymentIntentId: string,
  ): Promise<{ status: string; amount: number; currency: string }> {
    if (!this.stripe) {
      throw new HttpException('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    
    return {
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency
    };
  }

  /**
   * A Room document is a room TYPE with `totalRooms` physical units, which is
   * how BookingsService.checkAvailability has always read it. The payment paths
   * used to reject as soon as ONE overlapping booking existed, so in high season
   * every guest after the first was told the room was unavailable and could not
   * complete a booking. Comparing against the unit count is also correct when a
   * room really is a single unit (totalRooms = 1).
   */
  private async assertUnitAvailable(
    roomId: string,
    totalRooms: number,
    checkIn: Date,
    checkOut: Date,
    session?: ClientSession,
  ): Promise<void> {
    // Dates the owner closed off. These were only ever filtered out of the room
    // LISTING, so a guest arriving on a direct booking link could still pay for
    // a closed period — the overbooking the owner asked us to prevent.
    // Same overlap rule as RoomsService.findAvailable.
    const blocked = await this.roomBlockedDateModel.countDocuments(
      {
        roomId,
        startDate: { $lt: checkOut },
        endDate: { $gt: checkIn },
      },
      session ? { session } : {},
    );

    if (blocked > 0) {
      throw new HttpException(
        'Room is not available for the selected dates',
        HttpStatus.BAD_REQUEST,
      );
    }

    const overlapping = await this.bookingModel.countDocuments(
      {
        roomId,
        bookingStatus: { $nin: ['CANCELLED'] },
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn },
      },
      session ? { session } : {},
    );

    if (overlapping >= Math.max(1, totalRooms || 1)) {
      throw new HttpException(
        'Room is not available for the selected dates',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async generateBookingNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counter = await this.bookingModel.db
      .collection('counters')
      .findOneAndUpdate(
        { _id: `booking:${year}` as any },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      );
    return `AST-${year}-${String(counter.seq).padStart(3, '0')}`;
  }

}
