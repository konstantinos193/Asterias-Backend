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

  async getCalendarAvailability(month?: number, year?: number) {
    let monthDate: Date;
    if (month && year) {
      monthDate = new Date(parseInt(year.toString()), parseInt(month.toString()) - 1, 1);
    } else {
      monthDate = new Date();
    }

    const monthlyAvailability = await calculateMonthlyAggregatedAvailability(this.bookingModel, monthDate);
    
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

    return {
      month: monthDate.getMonth() + 1,
      year: monthDate.getFullYear(),
      availability: calendarData
    };
  }

  async getAvailabilityOverview() {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const overview = {
      today: await calculateDateAvailability(this.roomModel, this.bookingModel, today),
      nextWeek: await calculateDateAvailability(this.roomModel, this.bookingModel, nextWeek),
      totalRooms: 7, // Total Standard Apartments
      availableToday: 0,
      bookedToday: 0
    };

    // Calculate today's stats
    overview.today.forEach(room => {
      if (room.isAvailable) {
        overview.availableToday += room.availableNights;
      } else {
        overview.bookedToday += room.bookedNights;
      }
    });

    return overview;
  }
}
