import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking } from '../models/booking.model';
import { Room } from '../models/room.model';
import { Contact } from '../models/contact.model';
import { User, UserDocument } from '../models/user.model';
import { OffersService } from '../offers/offers.service';
import Stripe from 'stripe';

@Injectable()
export class AdminService {
  private stripe: Stripe;

  constructor(
    @InjectModel('Booking') private bookingModel: Model<Booking>,
    @InjectModel('Room') private roomModel: Model<Room>,
    @InjectModel('Contact') private contactModel: Model<Contact>,
    @InjectModel('User') private userModel: Model<UserDocument>,
    private offersService: OffersService,
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

    // Yesterday's dates for comparison
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const endOfYesterday = new Date(startOfYesterday.getTime() + 24 * 60 * 60 * 1000);

    // Today's arrivals count
    const todayArrivalsCount = await this.bookingModel.countDocuments({
      checkIn: { $gte: startOfDay, $lt: endOfDay },
      bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] }
    });

    // Yesterday's arrivals for comparison
    const yesterdayArrivals = await this.bookingModel.countDocuments({
      checkIn: { $gte: startOfYesterday, $lt: endOfYesterday },
      bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] }
    });

    // Available rooms - calculate individual room availability
    const allRooms = await this.roomModel.find({}, 'name totalRooms');
    const totalRoomsCount = allRooms.reduce((sum, room) => sum + room.totalRooms, 0);
    
    // Currently occupied rooms - count actual occupied individual rooms
    const occupiedRooms = await this.bookingModel.countDocuments({
      checkIn: { $lte: today },
      checkOut: { $gte: today },
      bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] }
    });
    
    const availableRooms = Math.max(0, totalRoomsCount - occupiedRooms);
    const occupancyRate = totalRoomsCount > 0 ? Math.round((occupiedRooms / totalRoomsCount) * 100) : 0;

    // Total guests today
    const todayGuests = await this.bookingModel.aggregate([
      {
        $match: {
          checkIn: { $gte: startOfDay, $lt: endOfDay },
          bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $add: ['$adults', '$children'] } }
        }
      }
    ]);

    // Yesterday's guests for comparison
    const yesterdayGuests = await this.bookingModel.aggregate([
      {
        $match: {
          checkIn: { $gte: startOfYesterday, $lt: endOfYesterday },
          bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $add: ['$adults', '$children'] } }
        }
      }
    ]);

    // Yesterday's occupancy for comparison
    const yesterdayOccupiedRooms = await this.bookingModel.countDocuments({
      checkIn: { $lte: yesterday },
      checkOut: { $gte: yesterday },
      bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] }
    });
    const yesterdayOccupancyRate = totalRoomsCount > 0 ? Math.round((yesterdayOccupiedRooms / totalRoomsCount) * 100) : 0;

    // Calculate changes
    const calculateChange = (current, previous) => {
      if (previous === 0) {
        return current > 0 ? { change: `+${current}`, changeType: 'increase' } : { change: '', changeType: 'neutral' };
      }
      const diff = current - previous;
      const percentage = Math.round((diff / previous) * 100);
      if (percentage > 0) {
        return { change: `+${percentage}%`, changeType: 'increase' };
      } else if (percentage < 0) {
        return { change: `${percentage}%`, changeType: 'decrease' };
      } else {
        return { change: '0%', changeType: 'neutral' };
      }
    };

    const todayGuestsCount = todayGuests[0]?.total || 0;
    const yesterdayGuestsCount = yesterdayGuests[0]?.total || 0;

    const arrivalsChange = calculateChange(todayArrivalsCount, yesterdayArrivals);
    const guestsChange = calculateChange(todayGuestsCount, yesterdayGuestsCount);
    const occupancyChange = calculateChange(occupancyRate, yesterdayOccupancyRate);
    
    // For available rooms, we compare with total rooms as a percentage
    const availabilityPercentage = totalRoomsCount > 0 ? Math.round((availableRooms / totalRoomsCount) * 100) : 0;
    const yesterdayAvailableRooms = totalRoomsCount - yesterdayOccupiedRooms;
    const yesterdayAvailabilityPercentage = totalRoomsCount > 0 ? Math.round((yesterdayAvailableRooms / totalRoomsCount) * 100) : 0;
    const availabilityChange = calculateChange(availabilityPercentage, yesterdayAvailabilityPercentage);

    // Recent bookings
    const recentBookings = await this.bookingModel.find()
      .populate('roomId', 'name')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Today's arrivals (bookings with check-in today)
    const todayArrivals = await this.bookingModel.find({
      checkIn: { $gte: startOfDay, $lt: endOfDay },
      bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] }
    })
      .populate('roomId', 'name')
      .populate('userId', 'name email')
      .sort({ checkIn: 1 })
      .limit(10);

    // Monthly revenue
    const monthlyRevenue = await this.bookingModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
          paymentStatus: 'PAID'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Contact inquiries
    const unreadContacts = await this.contactModel.countDocuments({ status: 'UNREAD' });

    return {
      stats: {
        todayArrivals: {
          value: todayArrivalsCount,
          change: arrivalsChange.change,
          changeType: arrivalsChange.changeType
        },
        availableRooms: {
          value: availableRooms,
          change: availabilityChange.change,
          changeType: availabilityChange.changeType
        },
        totalGuests: {
          value: todayGuestsCount,
          change: guestsChange.change,
          changeType: guestsChange.changeType
        },
        occupancyRate: {
          value: `${occupancyRate}%`,
          change: occupancyChange.change,
          changeType: occupancyChange.changeType
        }
      },
      recentBookings,
      todayArrivals,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      unreadContacts
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
      ]);

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
      ]);

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
    if (guestEmail) filter['guestInfo.email'] = { $regex: guestEmail, $options: 'i' };

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
      .limit(parseInt(limit));

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
      throw new Error('Booking not found');
    }
    
    return booking;
  }

  async cancelBooking(bookingId: string, body: any) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Check if booking can be cancelled
    if (booking.bookingStatus === 'CANCELLED') {
      throw new Error('Booking is already cancelled');
    }

    if (booking.bookingStatus === 'CHECKED_OUT') {
      throw new Error('Cannot cancel a completed booking');
    }

    let actualRefundAmount = body.refundAmount || 0;
    let stripeRefundId = null;

    // Process Stripe refund if payment was made with card and has a payment intent
    if (booking.paymentMethod === 'CARD' && booking.paymentStatus === 'PAID' && booking.stripePaymentIntentId) {
      if (!this.stripe) {
        throw new Error('Stripe is not configured. Cannot process refund.');
      }

      try {
        // Get the payment intent to find the charge
        const paymentIntent = await this.stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
        
        if (paymentIntent.latest_charge) {
          // Convert refund amount to cents for Stripe
          const refundAmountCents = Math.round(actualRefundAmount * 100);
          
          // Create the refund
          const refund = await this.stripe.refunds.create({
            charge: paymentIntent.latest_charge as string,
            amount: refundAmountCents,
            reason: 'requested_by_customer',
            metadata: {
              bookingId: bookingId,
              cancellationReason: body.cancellationReason || 'Cancelled by admin'
            }
          });
          
          stripeRefundId = refund.id;
          console.log(`✅ Stripe refund processed: ${refund.id} for booking ${bookingId}, amount €${actualRefundAmount}`);
        } else {
          console.warn(`⚠️ No charge found for payment intent ${booking.stripePaymentIntentId}`);
        }
      } catch (stripeError) {
        console.error(`❌ Stripe refund failed for booking ${bookingId}:`, stripeError);
        throw new Error(`Failed to process Stripe refund: ${stripeError.message}`);
      }
    } else if (booking.paymentMethod === 'CASH') {
      console.log(`💵 Cash booking refund recorded for booking ${bookingId}, amount €${actualRefundAmount}`);
    }

    // Prepare update data
    const updateData: any = {
      bookingStatus: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: body.cancellationReason || 'Cancelled by admin',
      adminNotes: body.adminNotes || '',
      refundAmount: actualRefundAmount,
      stripeRefundId: stripeRefundId
    };

    // If payment was made, update payment status
    if (booking.paymentStatus === 'PAID') {
      updateData.paymentStatus = 'REFUNDED';
      updateData.refundedAt = new Date();
    }

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
        paymentMethod: updatedBooking.paymentMethod
      }
    };
  }

  async updateBookingStatus(bookingId: string, body: { status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'; adminNotes?: string }) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Validate status transition
    const validStatuses = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];
    if (!validStatuses.includes(body.status)) {
      throw new Error('Invalid status');
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

  async bulkDeleteBookings(bookingIds: string[]) {
    if (!bookingIds || bookingIds.length === 0) {
      throw new Error('No booking IDs provided');
    }
    
    const result = await this.bookingModel.deleteMany({ _id: { $in: bookingIds } });
    
    if (result.deletedCount === 0) {
      throw new Error('No bookings found with the provided IDs');
    }
    
    return {
      message: `Successfully deleted ${result.deletedCount} bookings`,
      deletedCount: result.deletedCount
    };
  }

  async bulkUpdateBookingStatus(body: { bookingIds: string[]; status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'; adminNotes?: string }) {
    if (!body.bookingIds || body.bookingIds.length === 0) {
      throw new Error('No booking IDs provided');
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
      throw new Error('No bookings found with the provided IDs');
    }
    
    return {
      message: `Successfully updated ${result.modifiedCount} bookings`,
      modifiedCount: result.modifiedCount
    };
  }

  async getRoomAvailability() {
    const today = new Date();
    
    // Get all room types with their individual rooms
    const allRooms = await this.roomModel.find({}, 'name totalRooms price capacity size');
    
    // Get all active bookings for today
    const activeBookings = await this.bookingModel.find({
      checkIn: { $lte: today },
      checkOut: { $gte: today },
      bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] }
    }).populate('roomId', 'name');
    
    // Create detailed room availability
    const roomAvailability = [];
    
    allRooms.forEach(roomType => {
      for (let i = 1; i <= roomType.totalRooms; i++) {
        const individualRoomName = `${roomType.name} ${i}`;
        
        // Check if this individual room is occupied
        const isOccupied = activeBookings.some(booking => {
          const bookingRoomName = (booking.roomId as any).name;
          return bookingRoomName === individualRoomName;
        });
        
        roomAvailability.push({
          _id: roomType._id, // Include the actual room type ID
          roomName: individualRoomName,
          roomType: roomType.name,
          isOccupied,
          price: roomType.price,
          capacity: roomType.capacity,
          size: roomType.size,
          status: isOccupied ? 'Occupied' : 'Available'
        });
      }
    });
    
    return {
      totalRooms: roomAvailability.length,
      availableRooms: roomAvailability.filter(room => !room.isOccupied).length,
      occupiedRooms: roomAvailability.filter(room => room.isOccupied).length,
      rooms: roomAvailability
    };
  }

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

    const rooms = await this.roomModel.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await this.roomModel.countDocuments(filter);

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
    const room = await this.roomModel.findById(id);
    
    if (!room) {
      throw new Error('Room not found');
    }

    return { room };
  }

  async createRoom(roomData: any) {
    const room = new this.roomModel(roomData);
    await room.save();

    return room;
  }

  async updateRoom(id: string, roomData: any) {
    console.log('🔧 Backend updateRoom called:', { id, roomData });
    
    const room = await this.roomModel.findByIdAndUpdate(
      id,
      roomData,
      { returnDocument: 'after', runValidators: true }
    );
    
    console.log('🔧 Backend updateRoom result:', { room: room?.toObject() });
    
    if (!room) {
      throw new Error('Room not found');
    }

    return room;
  }

  async deleteRoom(id: string) {
    const room = await this.roomModel.findByIdAndDelete(id);
    
    if (!room) {
      throw new Error('Room not found');
    }

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
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
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
}
