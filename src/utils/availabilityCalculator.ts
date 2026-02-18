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
      $or: [
        // Check-in date falls on or before this date
        { checkIn: { $lte: checkInDate } },
        // Check-out date falls after this date
        { checkOut: { $gt: checkInDate } }
      ],
      bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] } // Only count active bookings
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
 * Calculate availability for multiple rooms on a specific date
 * @param roomModel - Room model injected from NestJS
 * @param bookingModel - Booking model injected from NestJS
 * @param date - Date to check
 * @returns Array of room availability for the date
 */
async function calculateDateAvailability(
  roomModel: Model<RoomDocument>,
  bookingModel: Model<BookingDocument>,
  date: Date
) {
  try {
    const rooms = await roomModel.find({});
    const availability = [];

    for (const room of rooms) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      const roomAvailability = await calculateRoomAvailabilityForDate(roomModel, bookingModel, room._id.toString(), date);
      availability.push(roomAvailability);
    }

    return availability;
  } catch (error) {
    console.error('Error calculating date availability:', error);
    throw error;
  }
}

/**
 * Calculate availability for a room over a month period
 * @param roomModel - Room model injected from NestJS
 * @param bookingModel - Booking model injected from NestJS
 * @param roomId - Room ID
 * @param monthDate - Any date in the month
 * @returns Monthly availability data
 */
async function calculateMonthlyAvailability(
  roomModel: Model<RoomDocument>,
  bookingModel: Model<BookingDocument>,
  roomId: string,
  monthDate: Date
) {
  try {
    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    
    const availability = {};
    
    for (let date = new Date(startOfMonth); date <= endOfMonth; date.setDate(date.getDate() + 1)) {
      const currentDate = new Date(date);
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayAvailability = await calculateRoomAvailabilityForDate(roomModel, bookingModel, roomId, currentDate);
      availability[currentDate.toISOString().split('T')[0]] = dayAvailability;
    }
    
    return availability;
  } catch (error) {
    console.error('Error calculating monthly availability:', error);
    throw error;
  }
}

/**
 * Calculate aggregated availability for all rooms over a month period (for calendar display)
 * @param bookingModel - Booking model injected from NestJS
 * @param monthDate - Any date in the month
 * @returns Monthly availability data aggregated across all rooms
 */
async function calculateMonthlyAggregatedAvailability(
  bookingModel: Model<BookingDocument>,
  monthDate: Date
) {
  try {
    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    
    // We have 7 identical standard rooms
    const totalRooms = 7;
    
    console.log(`[DEBUG] Calculating availability for ${totalRooms} standard rooms`);
    
    const availability = {};
    
    for (let date = new Date(startOfMonth); date <= endOfMonth; date.setDate(date.getDate() + 1)) {
      const currentDate = new Date(date);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // For each date, check how many rooms are booked
      const bookedRooms = await bookingModel.countDocuments({
        $and: [
          // Check-in date is on or before this date
          { checkIn: { $lte: currentDate } },
          // Check-out date is after this date (room is still occupied)
          { checkOut: { $gt: currentDate } },
          // Only count confirmed/active bookings
          { bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] } }
        ]
      });
      
      const availableRooms = totalRooms - bookedRooms;
      
      console.log(`[DEBUG] Date ${dateStr}: ${availableRooms}/${totalRooms} rooms available (${bookedRooms} booked)`);
      
      // Determine status and color based on availability percentage
      let status: string, color: string, textColor: string;
      const availabilityPercentage = (availableRooms / totalRooms) * 100;
      
      if (availableRooms === 0) {
        status = 'booked';
        color = 'red';
        textColor = 'white';
      } else if (availableRooms <= 2) { // 1-2 rooms available = limited
        status = 'limited';
        color = 'yellow';
        textColor = 'black';
      } else { // 3+ rooms available = good availability
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
        isAvailable: availableRooms > 0
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

    // Calculate total booked nights in the range
    let totalBookedNights = 0;
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    for (let date = new Date(rangeStart); date < rangeEnd; date.setDate(date.getDate() + 1)) {
      const currentDate = new Date(date);
      
      // Check if this date is booked
      const isBooked = bookings.some(booking => {
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        return currentDate >= checkIn && currentDate < checkOut;
      });

      if (isBooked) {
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
