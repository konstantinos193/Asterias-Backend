import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument, BookingModel } from '../models/booking.model';
import { Room, RoomDocument } from '../models/room.model';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { SendEmailDto } from './dto/send-email.dto';
import { EmailService } from '../email/email.service';
import { RoomCombinationService, CombinationRequest, RoomCombination } from './room-combination.service';
import { RoomCombinationRequestDto, MultiRoomBookingDto } from './dto/room-combination.dto';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: BookingModel,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    private emailService: EmailService,
    private roomCombinationService: RoomCombinationService
  ) {}

  async create(createBookingDto: CreateBookingDto): Promise<Booking> {
    const booking = new this.bookingModel(createBookingDto);
    return booking.save();
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
      this.bookingModel.find(filter).populate('roomId').sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.bookingModel.countDocuments(filter),
    ]);

    return {
      bookings,
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
      this.bookingModel.find(filter).populate('roomId').sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.bookingModel.countDocuments(filter),
    ]);

    return {
      bookings,
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
    if (status === 'CANCELLED') return booking as unknown as Booking;

    return this.bookingModel.findByIdAndUpdate(
      bookingId,
      {
        bookingStatus: 'CANCELLED',
        cancelledAt: new Date(),
        $push: {
          history: {
            date: new Date(),
            action: 'Booking cancelled by guest',
            user: 'Guest',
          },
        },
      },
      { returnDocument: 'after' },
    ).exec();
  }

  async findAll(): Promise<Booking[]> {
    return this.bookingModel.find().populate('roomId').populate('userId').exec();
  }

  async findOne(id: string): Promise<Booking | null> {
    return this.bookingModel.findById(id).populate('roomId').populate('userId').exec();
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

  async checkAvailability(roomId: string, checkIn: Date, checkOut: Date): Promise<boolean> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }
    
    const booked = await this.bookingModel.countDocuments({
      roomId,
      bookingStatus: { $nin: ['CANCELLED'] },
      $or: [
        { checkIn: { $lt: checkOut, $gte: checkIn } },
        { checkOut: { $gt: checkIn, $lte: checkOut } },
        { checkIn: { $lte: checkIn }, checkOut: { $gte: checkOut } }
      ]
    });
    
    return booked < room.totalRooms;
  }

  async sendEmail(id: string, sendEmailDto: SendEmailDto): Promise<any> {
    const booking = await this.bookingModel.findById(id).populate('roomId');
    
    if (!booking) {
      throw new Error('Booking not found');
    }

    if (!booking.guestInfo || !booking.guestInfo.email) {
      throw new Error('Guest email not found');
    }

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
          checkInTime: '15:00',
          checkOutTime: '11:00',
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
        throw new Error('Invalid email type');
    }

    if (emailResult.success) {
      // Add to booking history
      if (!booking.history) booking.history = [];
      booking.history.push({
        date: new Date(),
        action: `Αποστολή email: ${sendEmailDto.emailType === 'confirmation' ? 'Επιβεβαίωση' : sendEmailDto.emailType === 'reminder' ? 'Υπενθύμιση' : 'Προσωπικό μήνυμα'}`,
        user: 'Διαχειριστής'
      });
      await booking.save();

      return { 
        success: true, 
        message: `Email sent successfully to ${booking.guestInfo.email}`,
        emailType: sendEmailDto.emailType
      };
    } else {
      throw new Error('Failed to send email');
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
   * Create multi-room booking
   */
  async createMultiRoomBooking(multiRoomBookingDto: MultiRoomBookingDto): Promise<Booking[]> {
    const { combination, checkIn, checkOut, guestFirstName, guestLastName, guestEmail, guestPhone, specialRequests, language, paymentMethod, totalAmount } = multiRoomBookingDto;

    const bookings: Booking[] = [];
    const baseBookingNumber = await this.generateBookingNumber();

    for (let i = 0; i < combination.rooms.length; i++) {
      const room = combination.rooms[i];
      
      for (let j = 0; j < room.count; j++) {
        const bookingNumber = combination.rooms.length > 1 ? `${baseBookingNumber}-${String.fromCharCode(65 + i)}${j + 1}` : baseBookingNumber;
        
        const bookingData = {
          bookingNumber,
          roomId: new (require('mongoose').Types.ObjectId)(room.roomId),
          guestInfo: {
            firstName: guestFirstName,
            lastName: guestLastName,
            email: guestEmail,
            phone: guestPhone,
            specialRequests: specialRequests || '',
            language: language || 'en'
          },
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          adults: Math.min(room.occupancy, 2), // Simple split, can be improved
          children: Math.max(0, room.occupancy - 2),
          totalAmount: room.totalPrice / room.count,
          paymentMethod,
          paymentStatus: 'PENDING' as const,
          bookingStatus: 'CONFIRMED' as const,
          notes: `Part of multi-room booking ${baseBookingNumber}. Room ${i + 1} of ${combination.rooms.length}.`,
          roomCombination: combination
        };

        const booking = new this.bookingModel(bookingData);
        bookings.push(await booking.save());
      }
    }

    // Link bookings together
    if (bookings.length > 1) {
      const parentBooking = bookings[0] as BookingDocument;
      const childBookingIds = bookings.slice(1).map(b => (b as BookingDocument)._id);
      
      await this.bookingModel.updateMany(
        { _id: { $in: childBookingIds } },
        { parentBookingId: parentBooking._id }
      );
      
      await this.bookingModel.findByIdAndUpdate(
        parentBooking._id,
        { childBookingIds }
      );
    }

    return bookings;
  }

  /**
   * Quick room search for backward compatibility
   */
  async findBestRoom(adults: number, children: number, checkIn: Date, checkOut: Date): Promise<Room | null> {
    return this.roomCombinationService.findBestRoom(adults, children, checkIn, checkOut);
  }

  /**
   * Generate unique booking number
   */
  private async generateBookingNumber(): Promise<string> {
    const prefix = 'AST';
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    let bookingNumber = `${prefix}${dateStr}${random}`;
    
    // Ensure uniqueness
    const existing = await this.bookingModel.findOne({ bookingNumber });
    if (existing) {
      // Add a suffix if collision occurs
      bookingNumber += Math.floor(Math.random() * 100);
    }
    
    return bookingNumber;
  }
}
