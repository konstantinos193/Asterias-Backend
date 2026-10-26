import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Booking, BookingDocument, BookingModel } from '../models/booking.model';
import { BookingHistory, BookingHistoryDocument } from '../models/booking-history.model';
import { Room, RoomDocument } from '../models/room.model';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { SendEmailDto } from './dto/send-email.dto';
import { EmailService } from '../email/email.service';
import { RoomCombinationService, CombinationRequest, RoomCombination } from './room-combination.service';
import { RoomCombinationRequestDto, MultiRoomBookingDto } from './dto/room-combination.dto';
import { AvailabilityEngine } from '../availability/availability-engine';
import { PricingService } from '../pricing/pricing.service';
import { BookingNumberService } from '../common/booking-number/booking-number.service';
import { BOOKING_STATUS } from '../common/enums';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: BookingModel,
    @InjectModel(BookingHistory.name) private bookingHistoryModel: Model<BookingHistoryDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectConnection() private connection: Connection,
    private emailService: EmailService,
    private roomCombinationService: RoomCombinationService,
    private readonly availability: AvailabilityEngine,
    private readonly pricingService: PricingService,
    private readonly bookingNumbers: BookingNumberService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Create a booking from the admin API.
   *
   * This used to be two lines — `new this.bookingModel(dto).save()` — with no
   * availability guard, no transaction and no price recomputation: it stored
   * whatever `totalAmount` arrived in the body. Admin-guarded, so the blast
   * radius was small, but it was a hole in the one invariant the whole
   * availability and pricing consolidation exists to protect, and it was the
   * fourth of six booking-creation sites to get it wrong.
   *
   * It now does what the checkout path does:
   *   - assertSellable inside the transaction, so the room is actually free and
   *     stays free for the length of the insert;
   *   - the stay priced by PricingService, not by the caller;
   *   - the booking number issued by BookingNumberService.
   *
   * `totalAmount` is still honoured when sent, because an admin may be
   * recording a negotiated price — but that is now an explicit override of a
   * computed figure rather than the only number available.
   */
  async create(createBookingDto: CreateBookingDto): Promise<Booking> {
    const { roomId, checkIn, checkOut, adults, children, totalAmount, bookingNumber, ...rest } =
      createBookingDto;

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const occupancy = adults + (children ?? 0);

    const session = await this.connection.startSession();
    try {
      let created: BookingDocument;

      await session.withTransaction(async () => {
        await this.availability.assertSellable(roomId, checkInDate, checkOutDate, session);

        const quote = await this.pricingService.quoteStay(
          roomId,
          checkIn,
          checkOut,
          adults,
          children ?? 0,
        );
        const taxes = await this.pricingService.applyTaxes(quote.subtotal, quote.nights, occupancy);

        const booking = new this.bookingModel({
          ...rest,
          bookingNumber: bookingNumber || (await this.bookingNumbers.next(session)),
          roomId: new Types.ObjectId(roomId),
          checkIn: checkInDate,
          checkOut: checkOutDate,
          adults,
          children: children ?? 0,
          // An admin-supplied figure wins; otherwise the stay is priced here.
          totalAmount: totalAmount ?? taxes.total,
          roomSubtotal: quote.subtotal,
          vatAmount: taxes.vatAmount,
          municipalFee: taxes.municipalFee,
          environmentalTax: taxes.environmentalTax,
        });

        created = await booking.save({ session });
      });

      return created;
    } finally {
      await session.endSession();
    }
  }

  async findAllPaginated(params?: { page?: number; limit?: number; status?: string }): Promise<{ bookings: Booking[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (params?.status) {
      filter.bookingStatus = params.status.toUpperCase();
    }

    const [bookings, total] = await Promise.all([
      this.bookingModel.find(filter).populate('roomId', 'name roomType price images').sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.bookingModel.countDocuments(filter),
    ]);

    return {
      bookings: bookings as unknown as Booking[],
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async findMyBookings(userId: string, params?: { page?: number; limit?: number; status?: string }): Promise<{ bookings: Booking[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const skip = (page - 1) * limit;

    const filter: any = { userId: new Types.ObjectId(userId) };
    if (params?.status) {
      filter.bookingStatus = params.status.toUpperCase();
    }

    const [bookings, total] = await Promise.all([
      this.bookingModel.find(filter).populate('roomId', 'name roomType price images').sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.bookingModel.countDocuments(filter),
    ]);

    return {
      bookings: bookings as unknown as Booking[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async cancelBooking(bookingId: string, userId?: string): Promise<Booking | null> {
    const filter: any = { _id: bookingId };
    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    }

    const booking = await this.bookingModel.findOne(filter).exec();
    if (!booking) return null;

    const status = (booking as any).bookingStatus as string;
    if (status === BOOKING_STATUS.CANCELLED) return booking as unknown as Booking;

    // The `cancellationPolicy` setting now applies.
    //
    // The owner could set a 48-hour cancellation window in the admin panel and
    // a guest could still cancel from the account page minutes before arrival:
    // SettingsService.getCancellationDeadline() was written for this and had
    // no callers. An admin cancelling through the admin API is unaffected —
    // that path is AdminService.cancelBooking and is the owner's own decision.
    if (!(await this.settingsService.isCancellableNow(booking.checkIn))) {
      const deadline = await this.settingsService.getCancellationDeadline(booking.checkIn);
      throw new BadRequestException(
        `This booking can no longer be cancelled online. The deadline was ` +
          `${deadline?.toISOString().slice(0, 16).replace('T', ' ')} UTC. ` +
          `Please contact the property.`,
      );
    }

    const [updated] = await Promise.all([
      this.bookingModel.findByIdAndUpdate(
        bookingId,
        { bookingStatus: BOOKING_STATUS.CANCELLED, cancelledAt: new Date() },
        { returnDocument: 'after' },
      ).exec(),
      this.bookingHistoryModel.create({
        bookingId: new Types.ObjectId(bookingId),
        action: 'Booking cancelled by guest',
        user: 'Guest',
      }),
    ]);
    return updated;
  }

  async findAll(): Promise<Booking[]> {
    return this.bookingModel.find().populate('roomId', 'name roomType price').populate('userId', 'name email').sort({ createdAt: -1 }).limit(500).lean().exec() as Promise<Booking[]>;
  }

  async findOne(id: string): Promise<Booking | null> {
    return this.bookingModel.findById(id).populate('roomId', 'name roomType price capacity amenities').populate('userId', 'name email phone').exec();
  }

  async update(id: string, updateBookingDto: UpdateBookingDto): Promise<Booking | null> {
    return this.bookingModel.findByIdAndUpdate(id, updateBookingDto, { returnDocument: 'after' }).exec();
  }

  async remove(id: string): Promise<Booking | null> {
    return this.bookingModel.findByIdAndDelete(id).exec();
  }

  async getStats(): Promise<any> {
    return this.bookingModel.getStats();
  }

  /**
   * Can this room be sold for these dates? Closures and the room's own on-sale
   * flag count, not only the bookings — this answer is what the booking page
   * shows the guest, so it has to match what checkout will accept.
   */
  async checkAvailability(roomId: string, checkIn: Date, checkOut: Date): Promise<boolean> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return this.availability.isSellable(roomId, checkIn, checkOut);
  }

  async sendEmail(id: string, sendEmailDto: SendEmailDto): Promise<any> {
    const booking = await this.bookingModel.findById(id).populate('roomId');
    
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!booking.guestInfo || !booking.guestInfo.email) {
      throw new BadRequestException('Guest email not found');
    }

    // Check-in and check-out times come from settings, not from literals.
    // '15:00' was hardcoded in three separate files while the owner had a
    // checkInTime setting that nothing read.
    const settings = await this.settingsService.getEffectiveSettings();

    // Use the proper EmailService methods
    let emailResult;
    const emailData = {
      bookingId: booking.bookingNumber,
      guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName}`,
      guestEmail: booking.guestInfo.email,
      bookingNumber: booking.bookingNumber,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      roomName: (booking.roomId as any)?.name || 'Δωμάτιο',
      totalAmount: booking.totalAmount,
      customMessage: sendEmailDto.customMessage || ''
    };

    switch (sendEmailDto.emailType) {
      case 'confirmation':
        emailResult = await this.emailService.sendBookingConfirmation({
          ...emailData,
          bookingId: booking.bookingNumber,
          totalPrice: booking.totalAmount
        }, { 
          language: booking.guestInfo.language || 'el' 
        });
        break;
      case 'reminder':
        const reminderData = {
          bookingId: booking.bookingNumber,
          guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName}`,
          guestEmail: booking.guestInfo.email,
          guestPhone: booking.guestInfo.phone,
          roomName: (booking.roomId as any)?.name || 'Δωμάτιο',
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          checkInTime: settings.checkInTime,
          checkOutTime: settings.checkOutTime,
          guests: `${booking.adults} adults${booking.children > 0 ? `, ${booking.children} children` : ''}`,
          totalPrice: booking.totalAmount,
          nights: Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24))
        };
        emailResult = await this.emailService.sendEmail('arrivalReminder', reminderData, { 
          language: booking.guestInfo.language || 'el' 
        });
        break;
      case 'custom':
        emailResult = await this.emailService.sendEmail('bookingConfirmation', emailData, { 
          language: booking.guestInfo.language || 'el' 
        });
        break;
      default:
        throw new BadRequestException('Invalid email type');
    }

    if (emailResult.success) {
      await this.bookingHistoryModel.create({
        bookingId: (booking as any)._id,
        action: `Αποστολή email: ${sendEmailDto.emailType === 'confirmation' ? 'Επιβεβαίωση' : sendEmailDto.emailType === 'reminder' ? 'Υπενθύμιση' : 'Προσωπικό μήνυμα'}`,
        user: 'Διαχειριστής',
      });

      return { 
        success: true, 
        message: `Email sent successfully to ${booking.guestInfo.email}`,
        emailType: sendEmailDto.emailType
      };
    } else {
      throw new BadRequestException('Failed to send email');
    }
  }

  /**
   * Get optimal room combinations for given guests and dates
   */
  async getRoomCombinations(request: RoomCombinationRequestDto): Promise<RoomCombination[]> {
    const combinationRequest: CombinationRequest = {
      adults: request.adults,
      children: request.children,
      checkIn: request.checkIn,
      checkOut: request.checkOut,
      maxCombinations: request.maxCombinations || 10,
      preferMultiRoom: request.preferMultiRoom !== false // Default to true
    };

    return this.roomCombinationService.generateOptimalCombinations(combinationRequest);
  }

  /**
   * Create multi-room booking — all sub-bookings in a single transaction so a
   * mid-loop failure cannot leave orphaned documents.
   */
  async createMultiRoomBooking(multiRoomBookingDto: MultiRoomBookingDto): Promise<Booking[]> {
    const { combination, checkIn, checkOut, guestFirstName, guestLastName, guestEmail, guestPhone, specialRequests, language, paymentMethod } = multiRoomBookingDto;

    const baseBookingNumber = await this.bookingNumbers.next();
    const session = await this.connection.startSession();

    try {
      let bookings: Booking[] = [];

      await session.withTransaction(async () => {
        bookings = [];

        for (let i = 0; i < combination.rooms.length; i++) {
          const room = combination.rooms[i];

          // Same guard as checkout: the combination was priced minutes ago and
          // the apartment may have been sold or closed since.
          await this.availability.assertSellable(
            room.roomId,
            new Date(checkIn),
            new Date(checkOut),
            session,
          );

          // Price it here, from PricingService, instead of trusting the amount
          // in the request: the body says WHICH apartments, never what they
          // cost. One sub-booking is one apartment, so the quote is per unit.
          const quote = await this.pricingService.quoteStay(
            room.roomId,
            checkIn,
            checkOut,
            room.occupancy,
          );
          const taxes = await this.pricingService.applyTaxes(
            quote.subtotal,
            quote.nights,
            room.occupancy,
          );

          for (let j = 0; j < room.count; j++) {
            await this.availability.assertSellable(room.roomId, new Date(checkIn), new Date(checkOut), session);
            const bookingNumber = combination.rooms.length > 1 || room.count > 1
              ? `${baseBookingNumber}-${String.fromCharCode(65 + i)}${j + 1}`
              : baseBookingNumber;

            const bookingData = {
              bookingNumber,
              roomId: new Types.ObjectId(room.roomId),
              guestInfo: {
                firstName: guestFirstName,
                lastName: guestLastName,
                email: guestEmail,
                phone: guestPhone,
                specialRequests: specialRequests || '',
                language: language || 'en',
              },
              checkIn: new Date(checkIn),
              checkOut: new Date(checkOut),
              adults: Math.min(room.occupancy, 2),
              children: Math.max(0, room.occupancy - 2),
              totalAmount: taxes.total,
              vatAmount: taxes.vatAmount,
              municipalFee: taxes.municipalFee,
              paymentMethod,
              paymentStatus: 'PENDING' as const,
              bookingStatus: 'CONFIRMED' as const,
              notes: `Part of multi-room booking ${baseBookingNumber}. Room ${i + 1} of ${combination.rooms.length}.`,
              roomCombination: combination,
            };

            const booking = new this.bookingModel(bookingData);
            bookings.push(await booking.save({ session }));
          }
        }

        if (bookings.length > 1) {
          const parentBooking = bookings[0] as BookingDocument;
          const childBookingIds = bookings.slice(1).map(b => (b as BookingDocument)._id);

          await this.bookingModel.updateMany(
            { _id: { $in: childBookingIds } },
            { parentBookingId: parentBooking._id },
            { session },
          );

          await this.bookingModel.findByIdAndUpdate(
            parentBooking._id,
            { childBookingIds },
            { session },
          );
        }
      });

      return bookings;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Quick room search for backward compatibility
   */
  async findBestRoom(adults: number, children: number, checkIn: Date, checkOut: Date): Promise<Room | null> {
    return this.roomCombinationService.findBestRoom(adults, children, checkIn, checkOut);
  }

  // generateBookingNumber() is gone. It was one of two byte-for-byte copies of
  // the same counter increment, both reaching past Mongoose into a raw
  // `counters` collection. BookingNumberService is now the only generator.
}
