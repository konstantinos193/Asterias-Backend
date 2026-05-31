import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Room, RoomSchema } from '../models/room.model';
import { Booking, BookingSchema } from '../models/booking.model';
import { SettingsService } from '../settings/settings.service';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private stripe: InstanceType<typeof Stripe>;

  constructor(
    @InjectModel('Room') private roomModel: Model<Room>,
    @InjectModel('Booking') private bookingModel: Model<Booking>,
    private settingsService: SettingsService,
  ) {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('⚠️  WARNING: STRIPE_SECRET_KEY is not set in environment variables');
      console.error('⚠️  Payment functionality will not work without a valid Stripe API key');
      console.error('⚠️  Please add STRIPE_SECRET_KEY to your .env file');
    }

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

    // Check availability for individual room
    const isAvailable = await this.isIndividualRoomAvailable(roomId, checkIn, checkOut);
    if (!isAvailable) {
      throw new HttpException('Room is not available for the selected dates', HttpStatus.BAD_REQUEST);
    }

    // Calculate total amount
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    // Use seasonal pricing if a period covers the stay dates
    const effectivePrice = this.getEffectivePrice(room, checkInDate, parseInt(adults) + parseInt(children || 0));
    let basePrice = nights * effectivePrice;
    let discountAmount = 0;
    let appliedOffer = null;

    // Apply offer discount if offerId is provided
    if (offerId) {
      // TODO: Implement offer logic when Offer model is available
      console.log('Offer logic not yet implemented in NestJS');
    }

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

    // Check if room still exists and is available
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }

    const isAvailable = await this.isIndividualRoomAvailable(roomId, checkIn, checkOut);
    if (!isAvailable) {
      throw new HttpException('Room is no longer available for the selected dates', HttpStatus.BAD_REQUEST);
    }

    // Generate booking number manually
    const year = new Date().getFullYear();
    const lastBooking = await this.bookingModel.findOne(
      { 
        bookingNumber: { $regex: `^AST-${year}-` }
      },
      { bookingNumber: 1 }
    ).sort({ bookingNumber: -1 });
    
    let nextNumber = 1;
    if (lastBooking && lastBooking.bookingNumber) {
      const lastNumber = parseInt(lastBooking.bookingNumber.split('-')[2]);
      nextNumber = lastNumber + 1;
    }
    
    const bookingNumber = `AST-${year}-${String(nextNumber).padStart(3, '0')}`;
    console.log('Generated booking number:', bookingNumber);

    // Create booking
    const booking = new this.bookingModel({
      roomId,
      guestInfo: {
        ...guestInfo,
        specialRequests: specialRequests || ''
      },
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      adults: parseInt(adults),
      children: parseInt(children),
      totalAmount: paymentIntent.amount / 100,
      paymentMethod: 'CARD',
      paymentStatus: 'PAID',
      bookingStatus: 'CONFIRMED',
      stripePaymentIntentId: paymentIntentId,
      bookingNumber: bookingNumber,
      offerId: offerId || undefined,
      originalPrice: parseFloat(originalPrice) || undefined,
      discountAmount: parseFloat(discountAmount) || undefined
    });

    await booking.save();
    console.log('Booking saved successfully, bookingNumber:', booking.bookingNumber);
    
    // TODO: Send confirmation email when email service is available
    console.log('Email service not yet implemented in NestJS');

    return {
      message: 'Payment confirmed and booking created successfully',
      booking
    };
  }

  async createCashBooking(createCashBookingDto: any) {
    const { roomId, checkIn, checkOut, adults, children, totalAmount, guestInfo, specialRequests, depositAmount, depositPaid } = createCashBookingDto;

    // Check if room still exists and is available
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }

    const isAvailable = await this.isIndividualRoomAvailable(roomId, checkIn, checkOut);
    if (!isAvailable) {
      throw new HttpException('Room is no longer available for the selected dates', HttpStatus.BAD_REQUEST);
    }

    // Generate booking number manually for cash booking
    const year = new Date().getFullYear();
    const lastBooking = await this.bookingModel.findOne(
      { 
        bookingNumber: { $regex: `^AST-${year}-` }
      },
      { bookingNumber: 1 }
    ).sort({ bookingNumber: -1 });
    
    let nextNumber = 1;
    if (lastBooking && lastBooking.bookingNumber) {
      const lastNumber = parseInt(lastBooking.bookingNumber.split('-')[2]);
      nextNumber = lastNumber + 1;
    }
    
    const bookingNumber = `AST-${year}-${String(nextNumber).padStart(3, '0')}`;
    console.log('Generated cash booking number:', bookingNumber);

    // Create booking
    const booking = new this.bookingModel({
      roomId,
      guestInfo: {
        ...guestInfo,
        specialRequests: specialRequests || ''
      },
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      adults: parseInt(adults),
      children: parseInt(children),
      totalAmount: parseFloat(totalAmount),
      paymentMethod: 'CASH',
      paymentStatus: 'PENDING',
      bookingStatus: 'CONFIRMED',
      bookingNumber: bookingNumber,
      depositAmount: depositAmount != null ? parseFloat(depositAmount) : 0,
      depositPaid: depositPaid === true || depositPaid === 'true',
      depositPaidAt: (depositPaid === true || depositPaid === 'true') ? new Date() : null,
    });

    await booking.save();
    console.log('Cash booking saved successfully, bookingNumber:', booking.bookingNumber);
    
    // TODO: Send confirmation email when email service is available
    console.log('Email service not yet implemented in NestJS');

    return {
      message: 'Cash booking created successfully',
      booking
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

  private getEffectivePrice(room: any, checkInDate: Date, totalGuests: number): number {
    if (!room.seasonalPricing || room.seasonalPricing.length === 0) {
      return room.price;
    }
    const match = room.seasonalPricing.find((period: any) => {
      const start = new Date(period.startDate);
      const end = new Date(period.endDate);
      return checkInDate >= start && checkInDate <= end;
    });
    if (!match) return room.price;
    if (match.pricingByOccupancy && match.pricingByOccupancy.length > 0) {
      const occupancyMatch = match.pricingByOccupancy
        .filter((p: any) => p.guests <= totalGuests)
        .sort((a: any, b: any) => b.guests - a.guests)[0];
      if (occupancyMatch) return occupancyMatch.price;
    }
    return match.price;
  }

  private async isIndividualRoomAvailable(roomId: string, checkIn: string, checkOut: string): Promise<boolean> {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    const existingBookings = await this.bookingModel.find({
      roomId: roomId,
      $or: [
        {
          checkIn: { $lt: checkOutDate },
          checkOut: { $gt: checkInDate }
        }
      ],
      bookingStatus: { $nin: ['CANCELLED'] }
    });

    return existingBookings.length === 0;
  }
}
