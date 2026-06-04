import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from '../models/room.model';
import { Booking, BookingDocument } from '../models/booking.model';

/**
 * Calculate room availability for a specific date (for calendar display)
 * @param roomModel - Room model injected from NestJS
 * @param bookingModel - Booking model injected from NestJS
 * @param roomId - Room ID
 * @param date - Specific date to check
 * @returns Availability information for that specific date
 */
async function calculateRoomAvailabilityForDate(
  roomModel: Model<RoomDocument>,
  bookingModel: Model<BookingDocument>,
  roomId: string,
  date: Date
) {
  try {
    // Get room details
    const room = await roomModel.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Check if this specific date is booked
    const checkInDate = new Date(date);
    const checkOutDate = new Date(date);
    checkOutDate.setDate(checkOutDate.getDate() + 1);

    const existingBooking = await bookingModel.findOne({
      roomId: roomId,
      checkIn: { $lte: checkInDate },
      checkOut: { $gt: checkInDate },
      bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] },
    });

    // Room is available if no booking exists for this date
    const isAvailable = !existingBooking;

    return {
      roomId,
      roomName: room.name,
      totalRooms: room.totalRooms || 1,
      isAvailable,
      status: isAvailable ? 'available' : 'booked',
      color: isAvailable ? 'green' : 'red',
      textColor: isAvailable ? 'white' : 'white'
    };
  } catch (error) {
    console.error('Error calculating room availability for date:', error);
    // If there's an error, assume room is available
    return {
      roomId,
      roomName: 'Unknown',
      totalRooms: 1,
      isAvailable: true,
      status: 'available',
      color: 'green',
      textColor: 'white'
    };
  }
}

/**
 * Calculate availability for multiple rooms on a specific date.
 * Uses a single aggregation instead of one query per room.
 */
async function calculateDateAvailability(
  roomModel: Model<RoomDocument>,
  bookingModel: Model<BookingDocument>,
  date: Date,
  roomIds?: string[]
) {
  try {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const roomFilter = roomIds && roomIds.length > 0 ? { _id: { $in: roomIds } } : {};
    const rooms = await roomModel.find(roomFilter).lean();

    const bookedCounts: { _id: any; count: number }[] = await bookingModel.aggregate([
      {
        $match: {
          bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] },
          checkIn: { $lt: nextDay },
          checkOut: { $gt: date },
        },
      },
      { $group: { _id: '$roomId', count: { $sum: 1 } } },
    ]);

    const bookedMap = new Map(bookedCounts.map(b => [b._id.toString(), b.count]));

    return rooms.map(room => {
      const booked = bookedMap.get(room._id.toString()) ?? 0;
      const isAvailable = booked === 0;
      return {
        roomId: room._id,
        roomName: room.name,
        totalRooms: room.totalRooms || 1,
        isAvailable,
        status: isAvailable ? 'available' : 'booked',
        color: isAvailable ? 'green' : 'red',
        textColor: 'white',
      };
    });
  } catch (error) {
    console.error('Error calculating date availability:', error);
    throw error;
  }
}

/**
 * Calculate availability for a room over a month period.
 * Fetches all bookings for the month in one query, then computes per-day in memory.
 */
async function calculateMonthlyAvailability(
  roomModel: Model<RoomDocument>,
  bookingModel: Model<BookingDocument>,
  roomId: string,
  monthDate: Date
) {
  try {
    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

    const room = await roomModel.findById(roomId).lean();
    if (!room) throw new Error('Room not found');

    const bookings = await bookingModel
      .find({
        roomId,
        bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] },
        checkIn: { $lt: endOfMonth },
        checkOut: { $gt: startOfMonth },
      })
      .select('checkIn checkOut')
      .lean();

    // Pre-build Set for O(1) per-date lookups
    const bookedDateSet = new Set<string>();
    for (const b of bookings) {
      const d = new Date(b.checkIn);
      while (d < b.checkOut) {
        bookedDateSet.add(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
      }
    }

    const availability: Record<string, any> = {};

    for (let date = new Date(startOfMonth); date <= endOfMonth; date.setDate(date.getDate() + 1)) {
      const currentDate = new Date(date);
      const isAvailable = !bookedDateSet.has(currentDate.toISOString().split('T')[0]);
      availability[currentDate.toISOString().split('T')[0]] = {
        roomId,
        roomName: room.name,
        totalRooms: room.totalRooms || 1,
        isAvailable,
        status: isAvailable ? 'available' : 'booked',
        color: isAvailable ? 'green' : 'red',
        textColor: 'white',
      };
    }

    return availability;
  } catch (error) {
    console.error('Error calculating monthly availability:', error);
    throw error;
  }
}

/**
 * Calculate aggregated availability for all rooms over a month period (for calendar display)
 * @param roomModel - Room model injected from NestJS
 * @param bookingModel - Booking model injected from NestJS
 * @param monthDate - Any date in the month
 * @returns Monthly availability data aggregated across all rooms
 */
async function calculateMonthlyAggregatedAvailability(
  roomModel: Model<RoomDocument>,
  bookingModel: Model<BookingDocument>,
  monthDate: Date
) {
  try {
    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    // End of month at end-of-day so the last day is included
    const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

    const totalRooms = await roomModel.countDocuments({ available: true });

    // One query: all bookings that overlap this month at all
    const bookings = await bookingModel
      .find({
        checkIn: { $lt: endOfMonth },
        checkOut: { $gt: startOfMonth },
        bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] },
      })
      .select('checkIn checkOut')
      .lean();

    // Pre-compute booked count per date for O(1) lookups
    const bookedCountByDate = new Map<string, number>();
    for (const b of bookings) {
      const d = new Date(b.checkIn);
      while (d < b.checkOut) {
        const ds = d.toISOString().split('T')[0];
        bookedCountByDate.set(ds, (bookedCountByDate.get(ds) ?? 0) + 1);
        d.setDate(d.getDate() + 1);
      }
    }

    const availability: Record<string, any> = {};

    for (
      let date = new Date(startOfMonth);
      date <= endOfMonth;
      date.setDate(date.getDate() + 1)
    ) {
      const currentDate = new Date(date);
      const dateStr = currentDate.toISOString().split('T')[0];

      const bookedRooms = bookedCountByDate.get(dateStr) ?? 0;

      const availableRooms = Math.max(0, totalRooms - bookedRooms);

      let status: string, color: string, textColor: string;
      if (availableRooms === 0) {
        status = 'booked';
        color = 'red';
        textColor = 'white';
      } else if (availableRooms <= 2) {
        status = 'limited';
        color = 'yellow';
        textColor = 'black';
      } else {
        status = 'available';
        color = 'green';
        textColor = 'white';
      }

      availability[dateStr] = {
        status,
        color,
        textColor,
        availableRooms,
        totalRooms,
        isAvailable: availableRooms > 0,
      };
    }

    return availability;
  } catch (error) {
    console.error('Error calculating monthly aggregated availability:', error);
    throw error;
  }
}

/**
 * Calculate room availability for a specific date range (for backward compatibility)
 * @param roomModel - Room model injected from NestJS
 * @param bookingModel - Booking model injected from NestJS
 * @param roomId - Room ID
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Availability information
 */
async function calculateRoomAvailability(
  roomModel: Model<RoomDocument>,
  bookingModel: Model<BookingDocument>,
  roomId: string,
  startDate: Date,
  endDate: Date
) {
  try {
    // Get room details
    const room = await roomModel.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Get all bookings for this room in the date range
    const bookings = await bookingModel.find({
      roomId: roomId,
      $or: [
        // Check-in date falls within the range
        { checkIn: { $gte: startDate, $lt: endDate } },
        // Check-out date falls within the range
        { checkOut: { $gt: startDate, $lte: endDate } },
        // Booking spans the entire range
        { checkIn: { $lte: startDate }, checkOut: { $gte: endDate } }
      ],
      bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] } // Only count active bookings
    });

    // Pre-build a Set for O(1) per-date lookups
    const bookedDateSet = new Set<string>();
    for (const booking of bookings) {
      const d = new Date(booking.checkIn);
      while (d < booking.checkOut) {
        bookedDateSet.add(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
      }
    }

    let totalBookedNights = 0;
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    for (let date = new Date(rangeStart); date < rangeEnd; date.setDate(date.getDate() + 1)) {
      if (bookedDateSet.has(date.toISOString().split('T')[0])) {
        totalBookedNights++;
      }
    }

    const totalNights = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
    const availableNights = totalNights - totalBookedNights;
    const availabilityPercentage = (availableNights / totalNights) * 100;

    // Determine availability status and color
    let status: string, color: string, textColor: string;
    
    if (availabilityPercentage === 0) {
      status = 'booked';
      color = 'red';
      textColor = 'white';
    } else if (availabilityPercentage <= 30) {
      status = 'limited';
      color = 'yellow';
      textColor = 'black';
    } else {
      status = 'available';
      color = 'green';
      textColor = 'white';
    }

    return {
      roomId,
      roomName: room.name,
      totalRooms: room.totalRooms,
      totalNights,
      availableNights,
      bookedNights: totalBookedNights,
      availabilityPercentage,
      status,
      color,
      textColor,
      isAvailable: availabilityPercentage > 0
    };
  } catch (error) {
    console.error('Error calculating room availability:', error);
    throw error;
  }
}

/**
 * Get availability status for calendar display
 * @param availableRooms - Number of available rooms
 * @param totalRooms - Total number of rooms
 * @returns Status information for calendar
 */
function getAvailabilityStatus(availableRooms: number, totalRooms: number) {
  if (availableRooms === 0) {
    return {
      status: 'booked',
      color: 'red',
      textColor: 'white',
      text: {
        el: 'Κλεισμένο',
        de: 'Gebucht',
        en: 'Booked'
      }
    };
  } else if (availableRooms <= Math.ceil(totalRooms * 0.3)) {
    return {
      status: 'limited',
      color: 'yellow',
      textColor: 'black',
      text: {
        el: 'Περιορισμένο',
        de: 'Eingeschränkt',
        en: 'Limited'
      }
    };
  } else {
    return {
      status: 'available',
      color: 'green',
      textColor: 'white',
      text: {
        el: 'Διαθέσιμο',
        de: 'Verfügbar',
        en: 'Available'
      }
    };
  }
}

export {
  calculateRoomAvailability,
  calculateRoomAvailabilityForDate,
  calculateDateAvailability,
  calculateMonthlyAvailability,
  calculateMonthlyAggregatedAvailability,
  getAvailabilityStatus
};
