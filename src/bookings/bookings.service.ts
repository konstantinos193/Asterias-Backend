import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument, BookingModel } from '../models/booking.model';
import { Room, RoomDocument } from '../models/room.model';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { SendEmailDto } from './dto/send-email.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: BookingModel,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    private emailService: EmailService
) {}

  async create(createBookingDto: CreateBookingDto): Promise<Booking> {
    const booking = new this.bookingModel(createBookingDto);
    return booking.save();
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
}
