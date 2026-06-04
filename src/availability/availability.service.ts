import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from '../models/room.model';
import { Booking, BookingDocument } from '../models/booking.model';
import {
  calculateRoomAvailability, 
  calculateDateAvailability, 
  calculateMonthlyAvailability,
  calculateMonthlyAggregatedAvailability,
  getAvailabilityStatus 
} from '../utils/availabilityCalculator';

@Injectable()
export class AvailabilityService {
  private calendarCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CALENDAR_CACHE_TTL_MS = 5 * 60_000;

  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>
  ) {}

  async getRoomAvailability(roomId: string, date: string) {
    const startDate = new Date(date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    return await calculateRoomAvailability(this.roomModel, this.bookingModel, roomId, startDate, endDate);
  }

  async getDateAvailability(date: string) {
    const startDate = new Date(date);
    return await calculateDateAvailability(this.roomModel, this.bookingModel, startDate);
  }

  async getMonthlyAvailability(roomId: string, month?: number, year?: number) {
    let monthDate: Date;
    if (month && year) {
      monthDate = new Date(parseInt(year.toString()), parseInt(month.toString()) - 1, 1);
    } else {
      monthDate = new Date();
    }

    return await calculateMonthlyAvailability(this.roomModel, this.bookingModel, roomId, monthDate);
  }

  invalidateCalendarCache(month: number, year: number) {
    this.calendarCache.delete(`${year}-${month}`);
  }

  async getCalendarAvailability(month?: number, year?: number) {
    let monthDate: Date;
    if (month && year) {
      monthDate = new Date(parseInt(year.toString()), parseInt(month.toString()) - 1, 1);
    } else {
      monthDate = new Date();
    }

    const cacheKey = `${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`;
    const cached = this.calendarCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CALENDAR_CACHE_TTL_MS) {
      return cached.data;
    }

    const monthlyAvailability = await calculateMonthlyAggregatedAvailability(this.roomModel, this.bookingModel, monthDate);
    
    // Transform data for frontend calendar
    const calendarData = {};
    Object.keys(monthlyAvailability).forEach(date => {
      const dayData = monthlyAvailability[date];
      calendarData[date] = {
        status: dayData.status,
        color: dayData.color,
        textColor: dayData.textColor,
        availableRooms: dayData.availableRooms,
        totalRooms: dayData.totalRooms,
        isAvailable: dayData.isAvailable
      };
    });

    const result = {
      month: monthDate.getMonth() + 1,
      year: monthDate.getFullYear(),
      availability: calendarData
    };
    this.calendarCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  async getAvailabilityOverview() {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [todayData, nextWeekData, totalRooms] = await Promise.all([
      calculateDateAvailability(this.roomModel, this.bookingModel, today),
      calculateDateAvailability(this.roomModel, this.bookingModel, nextWeek),
      this.roomModel.countDocuments({ available: true }),
    ]);

    const availableToday = todayData.filter(r => r.isAvailable).length;
    const bookedToday = todayData.filter(r => !r.isAvailable).length;

    return {
      today: todayData,
      nextWeek: nextWeekData,
      totalRooms,
      availableToday,
      bookedToday,
    };
  }
}
