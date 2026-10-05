import { Injectable, HttpException, HttpStatus, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking } from '../models/booking.model';
import { Room } from '../models/room.model';
import { RoomBlockedDate, RoomBlockedDateDocument } from '../models/room-blocked-date.model';
import { Contact } from '../models/contact.model';
import { User, UserDocument } from '../models/user.model';
import { SeasonalPricing, SeasonalPricingDocument } from '../models/seasonal-pricing.model';
import { OffersService } from '../offers/offers.service';
import { SettingsService } from '../settings/settings.service';
import { RoomsService } from '../rooms/rooms.service';
import { OccupancyResult, addDays, buildOccupancy } from './occupancy';
import { PricingService, RateCalendar } from '../pricing/pricing.service';
import Stripe from 'stripe';
import {
  RefundReason,
  describeCardPayment,
  refundCardPayment,
  refundFields,
} from '../payments/stripe-refunds';

@Injectable()
export class AdminService {
  private stripe: InstanceType<typeof Stripe>;

  constructor(
    @InjectModel('Booking') private bookingModel: Model<Booking>,
    @InjectModel('Room') private roomModel: Model<Room>,
    @InjectModel(RoomBlockedDate.name) private roomBlockedDateModel: Model<RoomBlockedDateDocument>,
    @InjectModel('Contact') private contactModel: Model<Contact>,
    @InjectModel('User') private userModel: Model<UserDocument>,
    @InjectModel(SeasonalPricing.name) private seasonalModel: Model<SeasonalPricingDocument>,
    private offersService: OffersService,
    private settingsService: SettingsService,
    private roomsService: RoomsService,
    private pricingService: PricingService,
  ) {
    this.stripe = process.env.STRIPE_SECRET_KEY 
      ? new Stripe(process.env.STRIPE_SECRET_KEY)
      : null;
  }

  async getDashboard() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const endOfYesterday = new Date(startOfYesterday.getTime() + 24 * 60 * 60 * 1000);

    // 5 parallel queries instead of 12: booking stats collapsed into one $facet aggregation
    const [bookingFacets, totalRoomsCount, recentBookings, todayArrivals, unreadContacts] = await Promise.all([
      this.bookingModel.aggregate([
        { $facet: {
          todayArrivalsCount: [
            { $match: { checkIn: { $gte: startOfDay, $lt: endOfDay }, bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] } } },
            { $count: 'n' },
          ],
          todayDeparturesCount: [
            { $match: { checkOut: { $gte: startOfDay, $lt: endOfDay }, bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } } },
            { $count: 'n' },
          ],
          yesterdayArrivals: [
            { $match: { checkIn: { $gte: startOfYesterday, $lt: endOfYesterday }, bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] } } },
            { $count: 'n' },
          ],
          occupiedRooms: [
            { $match: { checkIn: { $lte: today }, checkOut: { $gte: today }, bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] } } },
            { $count: 'n' },
          ],
          yesterdayOccupiedRooms: [
            { $match: { checkIn: { $lte: yesterday }, checkOut: { $gte: yesterday }, bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] } } },
            { $count: 'n' },
          ],
          todayGuests: [
            { $match: { checkIn: { $gte: startOfDay, $lt: endOfDay }, bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] } } },
            { $group: { _id: null, total: { $sum: { $add: ['$adults', '$children'] } } } },
          ],
          yesterdayGuests: [
            { $match: { checkIn: { $gte: startOfYesterday, $lt: endOfYesterday }, bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] } } },
            { $group: { _id: null, total: { $sum: { $add: ['$adults', '$children'] } } } },
          ],
          monthlyRevenue: [
            { $match: { createdAt: { $gte: startOfMonth, $lte: endOfMonth }, paymentStatus: 'PAID' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
          ],
        }},
      ]).option({ maxTimeMS: 5000 }),
      this.roomModel.countDocuments({}),
      this.bookingModel.find()
        .populate('roomId', 'name')
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      this.bookingModel.find({
        checkIn: { $gte: startOfDay, $lt: endOfDay },
        bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] },
      })
        .populate('roomId', 'name')
        .populate('userId', 'name email')
        .sort({ checkIn: 1 })
        .limit(10)
        .lean(),
      this.contactModel.countDocuments({ status: 'UNREAD' }),
    ]);

    const f = bookingFacets[0];
    const todayArrivalsCount     = f.todayArrivalsCount[0]?.n ?? 0;
    const todayDeparturesCount   = f.todayDeparturesCount[0]?.n ?? 0;
    const yesterdayArrivals      = f.yesterdayArrivals[0]?.n ?? 0;
    const occupiedRooms          = f.occupiedRooms[0]?.n ?? 0;
    const yesterdayOccupiedRooms = f.yesterdayOccupiedRooms[0]?.n ?? 0;
    const todayGuestsCount       = f.todayGuests[0]?.total ?? 0;
    const yesterdayGuestsCount   = f.yesterdayGuests[0]?.total ?? 0;
    const monthlyRevenueTotal    = f.monthlyRevenue[0]?.total ?? 0;

    const availableRooms = Math.max(0, totalRoomsCount - occupiedRooms);
    const occupancyRate = totalRoomsCount > 0 ? Math.round((occupiedRooms / totalRoomsCount) * 100) : 0;
    const yesterdayOccupancyRate = totalRoomsCount > 0 ? Math.round((yesterdayOccupiedRooms / totalRoomsCount) * 100) : 0;

    const calculateChange = (current, previous) => {
      if (previous === 0) {
        return current > 0 ? { change: `+${current}`, changeType: 'increase' } : { change: '', changeType: 'neutral' };
      }
      const diff = current - previous;
      const percentage = Math.round((diff / previous) * 100);
      if (percentage > 0) return { change: `+${percentage}%`, changeType: 'increase' };
      if (percentage < 0) return { change: `${percentage}%`, changeType: 'decrease' };
      return { change: '0%', changeType: 'neutral' };
    };

    const arrivalsChange = calculateChange(todayArrivalsCount, yesterdayArrivals);
    const guestsChange = calculateChange(todayGuestsCount, yesterdayGuestsCount);
    const occupancyChange = calculateChange(occupancyRate, yesterdayOccupancyRate);

    const availabilityPercentage = totalRoomsCount > 0 ? Math.round((availableRooms / totalRoomsCount) * 100) : 0;
    const yesterdayAvailableRooms = totalRoomsCount - yesterdayOccupiedRooms;
    const yesterdayAvailabilityPercentage = totalRoomsCount > 0 ? Math.round((yesterdayAvailableRooms / totalRoomsCount) * 100) : 0;
    const availabilityChange = calculateChange(availabilityPercentage, yesterdayAvailabilityPercentage);

    return {
      stats: {
        todayArrivals: { value: todayArrivalsCount, change: arrivalsChange.change, changeType: arrivalsChange.changeType },
        availableRooms: { value: availableRooms, change: availabilityChange.change, changeType: availabilityChange.changeType },
        totalGuests: { value: todayGuestsCount, change: guestsChange.change, changeType: guestsChange.changeType },
        occupancyRate: { value: `${occupancyRate}%`, change: occupancyChange.change, changeType: occupancyChange.changeType },
      },
      recentBookings,
      todayArrivals,
      todayDeparturesCount,
      monthlyRevenue: monthlyRevenueTotal,
      unreadContacts,
    };
  }

  async getAnalytics(params: { period?: string; startDate?: string; endDate?: string }) {
    const { period = '30', startDate, endDate } = params;
    
    try {
      // Calculate date range
      let start, end;
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        end = new Date();
        start = new Date();
        start.setDate(end.getDate() - parseInt(period));
      }

      // Booking Statistics
      const bookingStats = await this.bookingModel.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            confirmedBookings: {
              $sum: { $cond: [{ $eq: ['$bookingStatus', 'CONFIRMED'] }, 1, 0] }
            },
            cancelledBookings: {
              $sum: { $cond: [{ $eq: ['$bookingStatus', 'CANCELLED'] }, 1, 0] }
            },
            checkedInBookings: {
              $sum: { $cond: [{ $eq: ['$bookingStatus', 'CHECKED_IN'] }, 1, 0] }
            },
            checkedOutBookings: {
              $sum: { $cond: [{ $eq: ['$bookingStatus', 'CHECKED_OUT'] }, 1, 0] }
            },
            totalRevenue: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, '$totalAmount', 0] }
            },
            averageBookingValue: { $avg: '$totalAmount' },
            totalGuests: { $sum: { $add: ['$adults', '$children'] } },
            totalNights: {
              $sum: {
                $divide: [
                  { $subtract: ['$checkOut', '$checkIn'] },
                  1000 * 60 * 60 * 24
                ]
              }
            }
          }
        }
      ]).option({ maxTimeMS: 5000 });

      // Ensure we have valid data even if no bookings found
      const safeStats = bookingStats && bookingStats.length > 0 ? bookingStats[0] : null;
      
      return {
        dateRange: { start, end },
        bookingStatistics: safeStats || {
          totalBookings: 0,
          confirmedBookings: 0,
          cancelledBookings: 0,
          checkedInBookings: 0,
          checkedOutBookings: 0,
          totalRevenue: 0,
          averageBookingValue: 0,
          totalGuests: 0,
          totalNights: 0
        }
      };
    } catch (error) {
      console.error('Error in getAnalytics:', error);
      // Return safe default data
      const now = new Date();
      const defaultStart = new Date();
      defaultStart.setDate(now.getDate() - parseInt(period));
      
      return {
        dateRange: { start: defaultStart, end: now },
        bookingStatistics: {
          totalBookings: 0,
          confirmedBookings: 0,
          cancelledBookings: 0,
          checkedInBookings: 0,
          checkedOutBookings: 0,
          totalRevenue: 0,
          averageBookingValue: 0,
          totalGuests: 0,
          totalNights: 0
        }
      };
    }
  }

  async getRevenueReports(period?: string) {
    const periodNum = parseInt(period) || 12;
    
    const end = new Date();
    const start = new Date();
    start.setMonth(end.getMonth() - periodNum);

    try {
      // Monthly revenue breakdown
      const monthlyRevenue = await this.bookingModel.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            paymentStatus: 'PAID'
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            revenue: { $sum: '$totalAmount' },
            bookings: { $sum: 1 },
            averageBookingValue: { $avg: '$totalAmount' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]).option({ maxTimeMS: 5000 });

      // Ensure we have valid data even if no bookings found
      const safeMonthlyRevenue = monthlyRevenue || [];
      const totalRevenue = safeMonthlyRevenue.reduce((sum, item) => sum + (item?.revenue || 0), 0);

      return {
        monthlyRevenue: safeMonthlyRevenue,
        totalRevenue,
        period: periodNum,
        dateRange: { start, end }
      };
    } catch (error) {
      console.error('Error in getRevenueReports:', error);
      // Return safe default data
      return {
        monthlyRevenue: [],
        totalRevenue: 0,
        period: periodNum,
        dateRange: { start, end }
      };
    }
  }

  async getBookings(params: any) {
    const {
      status,
      paymentStatus,
      checkIn,
      checkOut,
      guestEmail,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = params;

    // Build filter
    const filter: any = {};
    if (status) filter.bookingStatus = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (checkIn) filter.checkIn = { $gte: new Date(checkIn) };
    if (checkOut) filter.checkOut = { $lte: new Date(checkOut) };
    if (guestEmail) {
      const escaped = guestEmail.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter['guestInfo.email'] = { $regex: `^${escaped}` };
    }

    // Build sort
    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await this.bookingModel.find(filter)
      .populate('roomId', 'name')
      .populate('userId', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await this.bookingModel.countDocuments(filter);

    return {
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };
  }

  async getBookingById(bookingId: string) {
    const booking = await this.bookingModel.findById(bookingId)
      .populate('roomId', 'name')
      .populate('userId', 'name email');
    
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    
    return booking;
  }

  /**
   * The payment behind a booking. Card payments are read live from Stripe, so a
   * refund made in the Stripe dashboard shows here too; the booking is brought
   * in line with Stripe when the two disagree.
   */
  async getBookingPayment(bookingId: string) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.paymentMethod === 'CARD' && booking.stripePaymentIntentId) {
      this.requireStripe();
      const { summary, charge } = await describeCardPayment(this.stripe, booking.stripePaymentIntentId);
      const fields = refundFields(charge);
      if (
        Math.abs((booking.refundAmount || 0) - fields.refundAmount) >= 0.005 ||
        (booking.paymentStatus === 'PAID' || booking.paymentStatus === 'REFUNDED') &&
          booking.paymentStatus !== fields.paymentStatus
      ) {
        await this.bookingModel.updateOne({ _id: booking._id }, fields);
      }
      return summary;
    }

    // Cash and manual bookings: nothing to ask Stripe, the booking is the record.
    const paid = booking.paymentStatus === 'PAID' || booking.paymentStatus === 'REFUNDED';
    const refunded = booking.refundAmount || 0;
    return {
      provider: 'manual' as const,
      paid,
      amount: booking.totalAmount || 0,
      amountRefunded: refunded,
      refundable: paid ? Math.max(0, (booking.totalAmount || 0) - refunded) : 0,
      fullyRefunded: booking.paymentStatus === 'REFUNDED',
    };
  }

  /**
   * Refunds part or all of what the guest paid, without cancelling the stay.
   * Card payments go back through Stripe; for cash the refund is only recorded,
   * since the money is handed back in person.
   */
  async refundBooking(
    bookingId: string,
    body: { amount?: number; reason?: RefundReason; note?: string },
  ) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (body.amount != null && !(Number(body.amount) > 0)) {
      throw new BadRequestException('Enter an amount above zero');
    }

    let update: Record<string, any>;
    let refundId: string | null = null;

    if (booking.paymentMethod === 'CARD' && booking.stripePaymentIntentId) {
      this.requireStripe();
      const { refund, charge } = await refundCardPayment(this.stripe, {
        paymentIntentId: booking.stripePaymentIntentId,
        bookingId,
        bookingNumber: booking.bookingNumber,
        amount: body.amount,
        reason: body.reason,
        note: body.note,
      });
      refundId = refund.id;
      update = refundFields(charge, refund.id);
      console.log(`✅ Stripe refund ${refund.id} for booking ${booking.bookingNumber}: €${(refund.amount / 100).toFixed(2)}`);
    } else {
      if (booking.paymentStatus !== 'PAID') {
        throw new BadRequestException('Nothing has been paid on this booking');
      }
      const refundable = Math.max(0, (booking.totalAmount || 0) - (booking.refundAmount || 0));
      const amount = body.amount == null ? refundable : Number(body.amount);
      if (amount <= 0 || amount - refundable > 0.005) {
        throw new BadRequestException(`The refund must be between €0.01 and €${refundable.toFixed(2)}`);
      }
      const total = Math.round(((booking.refundAmount || 0) + amount) * 100) / 100;
      update = {
        refundAmount: total,
        refundedAt: new Date(),
        paymentStatus: total >= (booking.totalAmount || 0) - 0.005 ? 'REFUNDED' : 'PAID',
      };
    }

    if (body.note?.trim()) {
      const line = `[${new Date().toISOString().slice(0, 10)}] Επιστροφή: ${body.note.trim()}`;
      update.adminNotes = booking.adminNotes ? `${booking.adminNotes}\n${line}` : line;
    }

    const updated = await this.bookingModel.findByIdAndUpdate(bookingId, update, { returnDocument: 'after' });

    return {
      message: 'Refund processed',
      refundId,
      booking: {
        id: updated._id,
        paymentStatus: updated.paymentStatus,
        refundAmount: updated.refundAmount,
        stripeRefundId: updated.stripeRefundId,
      },
    };
  }

  async cancelBooking(bookingId: string, body: any) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check if booking can be cancelled
    if (booking.bookingStatus === 'CANCELLED') {
      throw new BadRequestException('Booking is already cancelled');
    }

    if (booking.bookingStatus === 'CHECKED_OUT') {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    // Zero or no amount cancels without a refund (a non-refundable stay). The
    // refund runs first, so a refund Stripe refuses leaves the booking as it was.
    const requested = Number(body.refundAmount) || 0;
    let refundUpdate: Record<string, any> = {};

    if (requested > 0 && booking.paymentMethod === 'CARD' && booking.stripePaymentIntentId) {
      this.requireStripe();
      const { refund, charge } = await refundCardPayment(this.stripe, {
        paymentIntentId: booking.stripePaymentIntentId,
        bookingId,
        bookingNumber: booking.bookingNumber,
        amount: requested,
        note: body.cancellationReason,
      });
      refundUpdate = refundFields(charge, refund.id);
      console.log(`✅ Stripe refund ${refund.id} for cancelled booking ${booking.bookingNumber}: €${requested.toFixed(2)}`);
    } else if (requested > 0) {
      const total = Math.round(((booking.refundAmount || 0) + requested) * 100) / 100;
      refundUpdate = {
        refundAmount: total,
        refundedAt: new Date(),
        ...(booking.paymentStatus === 'PAID' && total >= (booking.totalAmount || 0) - 0.005
          ? { paymentStatus: 'REFUNDED' }
          : {}),
      };
      console.log(`💵 Refund recorded for cancelled booking ${booking.bookingNumber}: €${requested.toFixed(2)}`);
    }

    const updateData: any = {
      bookingStatus: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: body.cancellationReason || 'Cancelled by admin',
      ...(body.adminNotes ? { adminNotes: body.adminNotes } : {}),
      ...refundUpdate,
    };

    // Update booking using findOneAndUpdate to avoid save() issues
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      bookingId,
      updateData,
      { returnDocument: 'after', runValidators: true }
    );

    return {
      message: 'Booking cancelled successfully',
      booking: {
        id: updatedBooking._id,
        status: updatedBooking.bookingStatus,
        cancelledAt: updatedBooking.cancelledAt,
        cancellationReason: updatedBooking.cancellationReason,
        refundAmount: updatedBooking.refundAmount,
        stripeRefundId: updatedBooking.stripeRefundId,
        paymentStatus: updatedBooking.paymentStatus,
        paymentMethod: updatedBooking.paymentMethod
      }
    };
  }

  private requireStripe() {
    if (!this.stripe) {
      throw new HttpException('Stripe is not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async updateBookingStatus(bookingId: string, body: { status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'; adminNotes?: string }) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Validate status transition
    const validStatuses = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];
    if (!validStatuses.includes(body.status)) {
      throw new BadRequestException('Invalid status');
    }

    // Prepare update data
    const updateData: any = {
      bookingStatus: body.status,
      adminNotes: body.adminNotes || booking.adminNotes
    };

    // Handle specific status changes
    if (body.status === 'CHECKED_IN') {
      updateData.checkedInAt = new Date();
    } else if (body.status === 'CHECKED_OUT') {
      updateData.checkedOutAt = new Date();
    }

    // Update booking using findOneAndUpdate to avoid save() issues
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      bookingId,
      updateData,
      { returnDocument: 'after', runValidators: true }
    );

    return {
      message: 'Booking status updated successfully',
      booking: {
        id: updatedBooking._id,
        status: updatedBooking.bookingStatus
      }
    };
  }

  async updateBooking(bookingId: string, body: {
    bookingStatus?: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
    paymentStatus?: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
    adminNotes?: string;
    notes?: string;
    totalAmount?: number;
    depositAmount?: number;
    depositPaid?: boolean;
    depositPaidAt?: Date;
    postCheckoutEmailSent?: boolean;
  }) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const updateData: any = {};

    if (body.bookingStatus !== undefined) updateData.bookingStatus = body.bookingStatus;
    if (body.paymentStatus !== undefined) updateData.paymentStatus = body.paymentStatus;
    if (body.adminNotes !== undefined) updateData.adminNotes = body.adminNotes;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.totalAmount !== undefined) updateData.totalAmount = body.totalAmount;
    if (body.depositAmount !== undefined) updateData.depositAmount = body.depositAmount;
    if (body.depositPaid !== undefined) {
      updateData.depositPaid = body.depositPaid;
      if (body.depositPaid && !booking.depositPaidAt) {
        updateData.depositPaidAt = body.depositPaidAt ?? new Date();
      }
    }
    if (body.depositPaidAt !== undefined) updateData.depositPaidAt = body.depositPaidAt;
    if (body.postCheckoutEmailSent !== undefined) updateData.postCheckoutEmailSent = body.postCheckoutEmailSent;

    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      bookingId,
      updateData,
      { returnDocument: 'after', runValidators: true }
    );

    return {
      message: 'Booking updated successfully',
      booking: updatedBooking
    };
  }

  async bulkDeleteBookings(bookingIds: string[]) {
    if (!bookingIds || bookingIds.length === 0) {
      throw new BadRequestException('No booking IDs provided');
    }
    
    const result = await this.bookingModel.deleteMany({ _id: { $in: bookingIds } });
    
    if (result.deletedCount === 0) {
      throw new NotFoundException('No bookings found with the provided IDs');
    }
    
    return {
      message: `Successfully deleted ${result.deletedCount} bookings`,
      deletedCount: result.deletedCount
    };
  }

  async bulkUpdateBookingStatus(body: { bookingIds: string[]; status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'; adminNotes?: string }) {
    if (!body.bookingIds || body.bookingIds.length === 0) {
      throw new BadRequestException('No booking IDs provided');
    }
    
    const result = await this.bookingModel.updateMany(
      { _id: { $in: body.bookingIds } },
      { 
        $set: { 
          bookingStatus: body.status,
          adminNotes: body.adminNotes || ''
        }
      }
    );
    
    if (result.modifiedCount === 0) {
      throw new NotFoundException('No bookings found with the provided IDs');
    }
    
    return {
      message: `Successfully updated ${result.modifiedCount} bookings`,
      modifiedCount: result.modifiedCount
    };
  };

  async getRooms(params: any) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = params;

    // Build filter - only filter by fields that actually exist
    const filter: any = {};

    // Build sort
    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [rooms, total] = await Promise.all([
      this.roomModel.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      this.roomModel.countDocuments(filter),
    ]);

    return {
      rooms,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };
  }

  async getRoomById(id: string) {
    const room = await this.roomModel.findById(id).lean();

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const blockedDates = await this.roomBlockedDateModel
      .find({ roomId: room._id })
      .sort({ startDate: 1 })
      .lean();

    return { room: { ...room, blockedDates } };
  }

  async createRoom(roomData: any) {
    const room = new this.roomModel(roomData);
    await room.save();
    // RoomsService caches findAll() for 60s and only invalidates on writes made
    // through itself. Without this, the public /api/rooms list keeps serving the
    // pre-edit inventory after an admin change.
    this.roomsService.clearRoomsCache();

    return room;
  }

  async updateRoom(id: string, roomData: any) {
    const room = await this.roomModel.findByIdAndUpdate(
      id,
      { $set: roomData },
      { new: true, runValidators: true }
    );

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    this.roomsService.clearRoomsCache();

    return room;
  }

  async deleteRoom(id: string) {
    const room = await this.roomModel.findByIdAndDelete(id);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    this.roomsService.clearRoomsCache();

    return {
      message: 'Room deleted successfully',
      room
    };
  }

  async getOffers(params: { page: number; limit: number; active?: boolean }) {
    return await this.offersService.getAllOffers(params.page, params.limit, params.active);
  }

  async getOfferById(offerId: string) {
    return await this.offersService.getOfferById(offerId);
  }

  async createOffer(offerData: any) {
    try {
      const offer = await this.offersService.createOffer(offerData);
      return {
        message: 'Offer created successfully',
        offer
      };
    } catch (error) {
      console.error('AdminService.createOffer error:', error);
      throw error;
    }
  }

  async updateOffer(offerId: string, offerData: any) {
    const offer = await this.offersService.updateOffer(offerId, offerData);
    return {
      message: 'Offer updated successfully',
      offer
    };
  }

  async deleteOffer(offerId: string) {
    await this.offersService.deleteOffer(offerId);
    return { message: 'Offer deleted successfully' };
  }

  async toggleOfferStatus(offerId: string) {
    const offer = await this.offersService.toggleOfferStatus(offerId);
    return {
      message: `Offer ${offer.active ? 'activated' : 'deactivated'} successfully`,
      offer
    };
  }

  // ── Seasonal pricing (property-wide, per room type) ──────────────────────────

  private normalizeSeasonalInput(body: any) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) throw new BadRequestException('Name is required');

    const start = new Date(body?.startDate);
    const end = new Date(body?.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Valid start and end dates are required');
    }
    // Store as midnight UTC of the calendar day (matches PricingService).
    const startDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endDate = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('End date must be on or after start date');
    }

    const prices: { '2beds'?: number; '3beds'?: number; '4beds'?: number } = {};
    for (const key of ['2beds', '3beds', '4beds'] as const) {
      const raw = body?.prices?.[key];
      if (raw !== undefined && raw !== null && raw !== '') {
        const num = Number(raw);
        if (isNaN(num) || num < 0) throw new BadRequestException(`Invalid price for ${key}`);
        prices[key] = num;
      }
    }
    if (prices['2beds'] === undefined && prices['3beds'] === undefined && prices['4beds'] === undefined) {
      throw new BadRequestException('Set at least one price (2beds / 3beds / 4beds)');
    }

    const result: any = { name, startDate, endDate, prices };
    if (body?.priority !== undefined && body?.priority !== null && body?.priority !== '') {
      const p = Number(body.priority);
      if (!isNaN(p)) result.priority = p;
    }
    if (body?.active !== undefined) result.active = body.active === true || body.active === 'true';
    return result;
  }

  async getSeasonalPricing() {
    const periods = await this.seasonalModel.find().sort({ startDate: 1 }).lean();
    return { periods };
  }

  getRateCalendar(from: string, days: number): Promise<RateCalendar> {
    return this.pricingService.rateCalendar(from, days);
  }

  async createSeasonalPricing(body: any) {
    const data = this.normalizeSeasonalInput(body);
    const period = await this.seasonalModel.create(data);
    return { message: 'Seasonal period created successfully', period };
  }

  async updateSeasonalPricing(id: string, body: any) {
    const data = this.normalizeSeasonalInput(body);

    // Build the update by explicit path. Handing Mongoose a nested `prices`
    // object turns into $set on dotted paths (prices.2beds …), which MERGES:
    // a room type the admin cleared keeps its old price and the change looks
    // like it never saved. Absent types must be $unset, not merely omitted.
    const $set: Record<string, any> = {
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
    };
    if (data.priority !== undefined) $set.priority = data.priority;
    if (data.active !== undefined) $set.active = data.active;

    const $unset: Record<string, ''> = {};
    for (const key of ['2beds', '3beds', '4beds'] as const) {
      if (data.prices[key] !== undefined) $set[`prices.${key}`] = data.prices[key];
      else $unset[`prices.${key}`] = '';
    }

    const update: Record<string, any> = { $set };
    if (Object.keys($unset).length > 0) update.$unset = $unset;

    const period = await this.seasonalModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!period) throw new NotFoundException('Seasonal period not found');
    return { message: 'Seasonal period updated successfully', period };
  }

  async deleteSeasonalPricing(id: string) {
    const deleted = await this.seasonalModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Seasonal period not found');
    return { message: 'Seasonal period deleted successfully' };
  }

  async getUsers(params: {
    page?: number;
    limit?: number;
    role?: 'ADMIN' | 'USER';
    isActive?: boolean;
    search?: string;
  }) {
    const {
      page = 1,
      limit = 20,
      role,
      isActive,
      search
    } = params;

    const filter: any = {};

    if (role) {
      filter.role = role;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-password -resetPasswordToken -resetPasswordExpires')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.userModel.countDocuments(filter)
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  // Room Management methods for Milestone 2
  async getRoomTypes() {
    const roomTypes = await this.roomModel.aggregate([
      {
        $group: {
          _id: '$nameKey',
          name: { $first: '$name' },
          description: { $first: '$description' },
          capacity: { $first: '$capacity' },
          bedType: { $first: '$bedType' },
          price: { $first: '$price' },
          totalRooms: { $sum: '$totalRooms' },
          images: { $first: '$images' },
          amenities: { $first: '$amenities' },
          floor: { $first: '$floor' }
        }
      },
      {
        $sort: { capacity: 1 }
      }
    ]).option({ maxTimeMS: 5000 });

    return roomTypes.map(type => ({
      id: type._id,
      name: type.name,
      description: type.description,
      capacity: type.capacity,
      bedType: type.bedType,
      price: type.price,
      totalRooms: type.totalRooms,
      images: type.images,
      amenities: type.amenities,
      floor: type.floor || 'ground'
    }));
  }

  /**
   * Every room, night by night, for `days` nights starting `from`: booked,
   * closed or free. Bookings are matched by overlap, so a stay that started
   * before the window or ends after it still colours the nights it covers.
   */
  async getOccupancy(from: string, days: number): Promise<OccupancyResult> {
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${addDays(from, days)}T00:00:00.000Z`);

    const [rooms, bookings, blocks] = await Promise.all([
      this.roomModel.find().sort({ sortOrder: 1, name: 1 })
        .select('name roomType available totalRooms').lean(),
      this.bookingModel.find({
        roomId: { $ne: null },
        bookingStatus: { $nin: ['CANCELLED'] },
        checkIn: { $lt: end },
        checkOut: { $gt: start },
      })
        .select('bookingNumber bookingStatus source checkIn checkOut roomId guestInfo.firstName guestInfo.lastName')
        .sort({ checkIn: 1 })
        .lean(),
      this.roomBlockedDateModel.find({
        startDate: { $lt: end },
        endDate: { $gt: start },
      }).lean(),
    ]);

    return buildOccupancy(from, days, rooms as any[], bookings as any[], blocks as any[]);
  }

  async getRoomAvailability(roomId: string, startDate: string, endDate: string) {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    
    const bookings = await this.bookingModel.find({
      roomId: room._id,
      bookingStatus: { $nin: ['CANCELLED'] },
      $or: [
        { checkIn: { $lte: new Date(endDate) }, checkOut: { $gte: new Date(startDate) } },
      ]
    }).sort({ checkIn: 1 }).lean();
    
    // Generate availability calendar
    const availability = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const isBooked = bookings.some(booking => 
        current >= booking.checkIn && current < booking.checkOut
      );
      
      availability.push({
        date: dateStr,
        available: !isBooked,
        bookedCount: isBooked ? 1 : 0,
        totalRooms: room.totalRooms
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return {
      room: room,
      availability
    };
  }

  async updateRoomAvailability(roomId: string, available: boolean) {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    
    room.available = available;
    return room.save();
  }

  async updateRoomPricing(roomId: string, pricingData: {
    basePrice: number;
    pricingByOccupancy?: { guests: number; price: number }[];
    taxes?: {
      vat?: number;
      municipalFees?: number;
      environmentalTax?: number;
    };
  }) {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    
    room.price = pricingData.basePrice;
    if (pricingData.pricingByOccupancy) {
      room.pricingByOccupancy = pricingData.pricingByOccupancy;
    }
    
    return room.save();
  }

  async getRoomStats() {
    const totalRooms = await this.roomModel.countDocuments();
    const availableRooms = await this.roomModel.countDocuments({ available: true });

    const roomTypes = await this.roomModel.aggregate([
      {
        $group: {
          _id: '$capacity',
          count: { $sum: '$totalRooms' },
          avgPrice: { $avg: '$price' }
        }
      }
    ]);

    return {
      totalRooms,
      availableRooms,
      occupiedRooms: totalRooms - availableRooms,
      roomTypes: roomTypes.map(type => ({
        capacity: type._id,
        count: type.count,
        avgPrice: type.avgPrice
      }))
    };
  }

  async blockRoomDates(roomId: string, startDate: string, endDate: string, reason?: string) {
    const rid = new Types.ObjectId(roomId);
    const room = await this.roomModel.findById(rid).lean();
    if (!room) throw new NotFoundException('Room not found');
    const entry = await this.roomBlockedDateModel.create({
      roomId: rid,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: reason || '',
    });
    return { success: true, data: { ...room, blockedDate: entry } };
  }

  async unblockRoomDates(roomId: string, blockId: string) {
    await this.roomBlockedDateModel.findByIdAndDelete(blockId);
    return { success: true };
  }

  async getSettings() {
    const settings = await this.settingsService.getSettings();
    return { success: true, data: settings || this.defaultSettings() };
  }

  async updateSettings(data: any) {
    const updated = await this.settingsService.upsertSettings(data);
    return { success: true, data: updated };
  }

  private defaultSettings() {
    return {
      checkInTime: '15:00',
      checkOutTime: '11:00',
      minAdvanceBooking: 1,
      maxAdvanceBooking: 365,
      cancellationPolicy: 48,
      overbookingAllowed: false,
      currency: 'EUR',
      taxRate: 0,
      municipalFee: 2.00,
      environmentalTax: 0,
      automaticPricing: false,
      directBookingDiscount: 5,
      emailNotifications: true,
      bookingConfirmations: true,
      reminderNotifications: true,
      newBookingAlerts: true,
      lowInventoryAlerts: true,
      reminderHours: 24,
      maintenanceMode: false,
    };
  }
}
