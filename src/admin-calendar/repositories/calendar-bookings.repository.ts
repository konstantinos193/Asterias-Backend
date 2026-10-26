import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from '../../models/booking.model';
import { occupyingBookingFilter } from '../../availability/availability-rules';
import { BookingStatus, PaymentMethod, PaymentStatus } from '../calendar.constants';

export interface BookingRow {
  _id: Types.ObjectId;
  bookingNumber: string;
  bookingStatus: BookingStatus;
  source: string;
  roomId: Types.ObjectId | null;
  checkIn: Date;
  checkOut: Date;
  guestInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    specialRequests?: string;
  };
  adults: number;
  children: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes?: string;
  adminNotes?: string;
  parentBookingId?: Types.ObjectId | null;
  childBookingIds?: Types.ObjectId[];
}

/** Just enough of a stay to know which nights of which room it holds. */
export interface OccupantRow {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  checkIn: Date;
  checkOut: Date;
}

export interface NewBooking {
  bookingNumber: string;
  roomId: Types.ObjectId;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  totalAmount: number;
  roomSubtotal: number;
  vatAmount: number;
  municipalFee: number;
  environmentalTax: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  source: string;
  notes: string;
  adminNotes: string;
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    specialRequests: string;
    language: 'el' | 'en' | 'de';
  };
}

const GRID_FIELDS =
  'bookingNumber bookingStatus source roomId checkIn checkOut guestInfo adults children ' +
  'totalAmount paymentStatus paymentMethod notes adminNotes parentBookingId childBookingIds';

@Injectable()
export class CalendarBookingsRepository {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
  ) {}

  /** Every stay holding a night in [start, end), cancellations excluded. */
  async listOccupying(start: Date, end: Date): Promise<BookingRow[]> {
    return this.bookingModel
      .find(occupyingBookingFilter(start, end))
      .select(GRID_FIELDS)
      .sort({ checkIn: 1 })
      .lean<BookingRow[]>();
  }

  /** The stays competing for one room's nights, the one being moved left out. */
  async listOccupantsOfRoom(
    roomId: string,
    start: Date,
    end: Date,
    excludeBookingId?: string,
  ): Promise<OccupantRow[]> {
    const filter: Record<string, unknown> = {
      ...occupyingBookingFilter(start, end, [new Types.ObjectId(roomId)]),
    };
    if (excludeBookingId) {
      filter._id = { $ne: new Types.ObjectId(excludeBookingId) };
    }
    return this.bookingModel.find(filter).select('roomId checkIn checkOut').lean<OccupantRow[]>();
  }

  async findById(bookingId: string): Promise<BookingRow | null> {
    return this.bookingModel.findById(bookingId).select(GRID_FIELDS).lean<BookingRow>();
  }

  async listByIds(bookingIds: Types.ObjectId[]): Promise<BookingRow[]> {
    return this.bookingModel
      .find({ _id: { $in: bookingIds } })
      .select(GRID_FIELDS)
      .sort({ bookingNumber: 1 })
      .lean<BookingRow[]>();
  }

  async create(booking: NewBooking): Promise<BookingRow> {
    const created = new this.bookingModel(booking);
    await created.save();
    return created.toObject() as unknown as BookingRow;
  }

  async updateById(bookingId: string, patch: Record<string, unknown>): Promise<BookingRow | null> {
    return this.bookingModel
      .findByIdAndUpdate(bookingId, { $set: patch }, { new: true, runValidators: true })
      .select(GRID_FIELDS)
      .lean<BookingRow>();
  }

  async deleteById(bookingId: string): Promise<boolean> {
    const deleted = await this.bookingModel.findByIdAndDelete(bookingId).lean();
    return deleted !== null;
  }

  /**
   * The next number in this year's sequence, from the same `counters` document
   * the guest-facing booking flow uses, so manual and online stays share one run.
   */
  async nextBookingNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counter = await this.bookingModel.db
      .collection<{ _id: string; seq: number }>('counters')
      .findOneAndUpdate(
        { _id: `booking:${year}` },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      );
    return `AST-${year}-${String(counter?.seq ?? 1).padStart(3, '0')}`;
  }
}
