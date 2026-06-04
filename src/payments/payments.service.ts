import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Connection, Model, Types } from 'mongoose';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Room, RoomSchema } from '../models/room.model';
import { Booking, BookingSchema } from '../models/booking.model';
import { RoomSeasonalPricing, RoomSeasonalPricingDocument } from '../models/room-seasonal-pricing.model';
import { SettingsService } from '../settings/settings.service';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private stripe: InstanceType<typeof Stripe>;

  constructor(
    @InjectModel('Room') private roomModel: Model<Room>,
    @InjectModel('Booking') private bookingModel: Model<Booking>,
    @InjectModel(RoomSeasonalPricing.name) private seasonalPricingModel: Model<RoomSeasonalPricingDocument>,
    @InjectConnection() private connection: Connection,
    private settingsService: SettingsService,
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
    const overlap = await this.bookingModel.countDocuments({
      roomId,
      bookingStatus: { $nin: ['CANCELLED'] },
      $or: [{ checkIn: { $lt: new Date(checkOut) }, checkOut: { $gt: new Date(checkIn) } }],
    });
    if (overlap > 0) {
      throw new HttpException('Room is not available for the selected dates', HttpStatus.BAD_REQUEST);
    }

    // Calculate total amount
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    // Use seasonal pricing if a period covers the stay dates
    const effectivePrice = await this.getEffectivePrice((room as any)._id, checkInDate, parseInt(adults) + parseInt(children || 0), (room as any).price);
    let basePrice = nights * effectivePrice;
    let discountAmount = 0;
    let appliedOffer = null;

    // Apply offer discount if offerId is provided
    // TODO: apply offer discount (offerId present but offer logic not yet implemented)

    // Load tax rates from settings (fallback to defaults if not configured)
    const settings = await this.settingsService.getSettings();
    const vatRate = (settings?.taxRate ?? 13) / 100;
    const municipalFee = (settings?.municipalFee ?? 2.00) * nights;
    const totalGuests = parseInt(adults) + parseInt(children || 0);
    const environmentalTax = (settings?.environmentalTax ?? 2.00) * nights * Math.max(totalGuests, 1);

    const vatAmount = basePrice * vatRate;
    const totalAmount = Math.round((basePrice + vatAmount + municipalFee + environmentalTax) * 100); // Convert to cents

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
        originalPrice: (nights * effectivePrice).toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        finalPrice: basePrice.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        municipalFee: municipalFee.toFixed(2),
        environmentalTax: environmentalTax.toFixed(2),
        totalGuests: totalGuests.toString(),
      }
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalAmount / 100,
      currency: currency,
      appliedOffer: appliedOffer,
      originalPrice: nights * effectivePrice,
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
      finalPrice
    } = paymentIntent.metadata;

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
        const overlap = await this.bookingModel.countDocuments({
          roomId,
          bookingStatus: { $nin: ['CANCELLED'] },
          $or: [{ checkIn: { $lt: new Date(checkOut) }, checkOut: { $gt: new Date(checkIn) } }],
        }, { session });

        if (overlap > 0) {
          throw new HttpException('Room is no longer available for the selected dates', HttpStatus.BAD_REQUEST);
        }

        booking = new this.bookingModel({
          roomId,
          guestInfo: { ...guestInfo, specialRequests: specialRequests || '' },
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          adults: parseInt(adults),
          children: parseInt(children),
          totalAmount: paymentIntent.amount / 100,
          paymentMethod: 'CARD',
          paymentStatus: 'PAID',
          bookingStatus: 'CONFIRMED',
          stripePaymentIntentId: paymentIntentId,
          bookingNumber,
          offerId: offerId || undefined,
          originalPrice: parseFloat(originalPrice) || undefined,
          discountAmount: parseFloat(discountAmount) || undefined,
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

    const bookingNumber = await this.generateBookingNumber();
    const session = await this.connection.startSession();
    let booking: any;
    try {
      await session.withTransaction(async () => {
        const overlap = await this.bookingModel.countDocuments({
          roomId,
          bookingStatus: { $nin: ['CANCELLED'] },
          $or: [{ checkIn: { $lt: new Date(checkOut) }, checkOut: { $gt: new Date(checkIn) } }],
        }, { session });

        if (overlap > 0) {
          throw new HttpException('Room is no longer available for the selected dates', HttpStatus.BAD_REQUEST);
        }

        booking = new this.bookingModel({
          roomId,
          guestInfo: { ...guestInfo, specialRequests: specialRequests || '' },
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          adults: parseInt(adults),
          children: parseInt(children),
          totalAmount: parseFloat(totalAmount),
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

  async getPaymentStatus(paymentIntentId: string) {
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

  private async getEffectivePrice(roomId: Types.ObjectId, checkInDate: Date, totalGuests: number, basePrice: number): Promise<number> {
    const match = await this.seasonalPricingModel.findOne({
      roomId,
      startDate: { $lte: checkInDate },
      endDate: { $gte: checkInDate },
    }).lean();
    if (!match) return basePrice;
    if (match.pricingByOccupancy && match.pricingByOccupancy.length > 0) {
      const occupancyMatch = match.pricingByOccupancy
        .filter((p: any) => p.guests <= totalGuests)
        .sort((a: any, b: any) => b.guests - a.guests)[0];
      if (occupancyMatch) return occupancyMatch.price;
    }
    return match.price;
  }

}
