import {
  Inject,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
import { AvailabilityEngine } from '../availability/availability-engine';
import {
  OccupancyResult,
  addDays,
  dayKey,
  dayStart,
  summarizeProperty,
  todayAtProperty,
} from '../availability/availability-rules';
import { PricingService, RateCalendar } from '../pricing/pricing.service';
import Stripe from 'stripe';
import { STRIPE_CLIENT, StripeClient } from '../stripe/stripe.module';
import { BOOKING_STATUS, PAYMENT_STATUS, USER_ROLE } from '../common/enums';
import { UpdateBookingDto, UpdateRoomPricingDto, UpdateSettingsDto } from './dto/admin.dto';
import { CreateRoomDto } from '../rooms/dto/create-room.dto';
import { UpdateRoomDto } from '../rooms/dto/update-room.dto';
import { SETTINGS_DEFAULTS } from '../models/settings.model';
import { parseListLimit } from '../common/limits';
import {
  RefundReason,
  describeCardPayment,
  refundCardPayment,
  refundFields,
} from '../payments/stripe-refunds';
import { safeSort } from '../common/sort';

/** Fields a caller may sort the room list by. */
const ROOM_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'nameKey',
  'price',
  'capacity',
  'sortOrder',
  'available',
  'roomType',
] as const;

/** Fields a caller may sort the booking list by. */
const BOOKING_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'checkIn',
  'checkOut',
  'totalAmount',
  'bookingStatus',
  'paymentStatus',
  'bookingNumber',
] as const;

@Injectable()
export class AdminReportingService {
  private readonly logger = new Logger(AdminReportingService.name);
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectModel(Contact.name) private readonly contactModel: Model<Contact>,
    private readonly availability: AvailabilityEngine,
  ) {}
  async getDashboard() {
    // Day boundaries at the property, not in the container's zone.
    //
    // These were built with new Date(y, m, d), which is local time, while
    // bookings store checkIn/checkOut at UTC midnight. The two agreed only
    // because the container has no TZ set. The property is in Greece (UTC+2/+3),
    // so "today's arrivals" was computed on a UTC day boundary — wrong for the
    // first 2-3 hours of every local day — and setting TZ=Europe/Athens would
    // have made the two conventions diverge permanently.
    const todayKey = todayAtProperty();
    const startOfDay = dayStart(todayKey);
    const endOfDay = dayStart(addDays(todayKey, 1));
    const startOfYesterday = dayStart(addDays(todayKey, -1));
    const endOfYesterday = startOfDay;
    // This month, as a half-open range [startOfMonth, startOfNextMonth).
    //
    // The upper bound used to be `new Date(y, m + 1, 0)` — the last day of the
    // month at midnight — compared with $lte. That included only the instant of
    // midnight on the final day, so every booking made during the last day of
    // the month was missing from the month's revenue.
    const [year, month] = todayKey.split('-').map(Number);
    const startOfMonth = dayStart(`${todayKey.slice(0, 7)}-01`);
    const startOfNextMonth = dayStart(
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`,
    );

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
          // Occupied tonight/last night is NOT counted here: it comes from
          // AvailabilityEngine below, so the dashboard, the grid and the site
          // agree on which apartments are taken. This match counted
          // `checkOut >= today`, so a guest who left this morning still held a
          // room, and it ignored both PENDING stays and closures.
          todayGuests: [
            { $match: { checkIn: { $gte: startOfDay, $lt: endOfDay }, bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] } } },
            { $group: { _id: null, total: { $sum: { $add: ['$adults', '$children'] } } } },
          ],
          yesterdayGuests: [
            { $match: { checkIn: { $gte: startOfYesterday, $lt: endOfYesterday }, bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] } } },
            { $group: { _id: null, total: { $sum: { $add: ['$adults', '$children'] } } } },
          ],
          monthlyRevenue: [
            { $match: { createdAt: { $gte: startOfMonth, $lt: startOfNextMonth }, paymentStatus: PAYMENT_STATUS.PAID } },
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
    const todayGuestsCount       = f.todayGuests[0]?.total ?? 0;
    const yesterdayGuestsCount   = f.yesterdayGuests[0]?.total ?? 0;
    const monthlyRevenueTotal    = f.monthlyRevenue[0]?.total ?? 0;

    // Free and occupied both come from AvailabilityEngine — the same room ×
    // night grid the calendar draws and the site sells from. Deriving "free" as
    // totalRooms - bookings counted a closed or off-sale apartment as
    // available, so the dashboard said 7 free while the grid under it was grey.
    const tonight = this.availability.today();
    const lastNight = addDays(tonight, -1);
    const occupancy = await this.availability.getOccupancy(lastNight, 2);
    const nights = summarizeProperty(occupancy);
    const unitCount = nights[tonight]?.totalRooms ?? totalRoomsCount;

    const bookedOn = (index: number) =>
      occupancy.rooms.filter(room => room.nights[index]?.status === 'booked').length;
    const occupiedRooms = bookedOn(1);
    const yesterdayOccupiedRooms = bookedOn(0);

    const availableRooms = nights[tonight]?.availableRooms ?? Math.max(0, totalRoomsCount - occupiedRooms);
    const occupancyRate = unitCount > 0 ? Math.round((occupiedRooms / unitCount) * 100) : 0;
    const yesterdayOccupancyRate = unitCount > 0 ? Math.round((yesterdayOccupiedRooms / unitCount) * 100) : 0;

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

    const availabilityPercentage = unitCount > 0 ? Math.round((availableRooms / unitCount) * 100) : 0;
    const yesterdayAvailableRooms = nights[lastNight]?.availableRooms ?? Math.max(0, totalRoomsCount - yesterdayOccupiedRooms);
    const yesterdayAvailabilityPercentage = unitCount > 0 ? Math.round((yesterdayAvailableRooms / unitCount) * 100) : 0;
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
      this.logger.error(`getAnalytics failed, returning empty analytics: ${error instanceof Error ? error.message : error}`);
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
      this.logger.error(`getRevenueReports failed, returning empty report: ${error instanceof Error ? error.message : error}`);
      // Return safe default data
      return {
        monthlyRevenue: [],
        totalRevenue: 0,
        period: periodNum,
        dateRange: { start, end }
      };
    }
  }

}
