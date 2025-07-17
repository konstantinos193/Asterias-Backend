const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Contact = require('../models/Contact');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get comprehensive analytics/reports (admin only)
router.get('/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '30', startDate, endDate } = req.query;
    
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
    const bookingStats = await Booking.aggregate([
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

    // Booking trends by day
    const bookingTrends = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            }
          },
          count: { $sum: 1 },
          revenue: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, '$totalAmount', 0] }
          }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Room type performance
    const roomPerformance = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          paymentStatus: 'PAID'
        }
      },
      {
        $lookup: {
          from: 'rooms',
          localField: 'roomId',
          foreignField: '_id',
          as: 'room'
        }
      },
      { $unwind: '$room' },
      {
        $group: {
          _id: '$room.name',
          bookings: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          averageRate: { $avg: '$totalAmount' },
          totalNights: {
            $sum: {
              $divide: [
                { $subtract: ['$checkOut', '$checkIn'] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // Lead time analysis (days between booking and check-in)
    const leadTimeAnalysis = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $project: {
          leadTime: {
            $divide: [
              { $subtract: ['$checkIn', '$createdAt'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          averageLeadTime: { $avg: '$leadTime' },
          minLeadTime: { $min: '$leadTime' },
          maxLeadTime: { $max: '$leadTime' }
        }
      }
    ]);

    // Monthly occupancy rates
    const occupancyData = await Booking.aggregate([
      {
        $match: {
          checkIn: { $gte: start },
          checkOut: { $lte: end },
          bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$checkIn' },
            month: { $month: '$checkIn' }
          },
          totalNights: {
            $sum: {
              $divide: [
                { $subtract: ['$checkOut', '$checkIn'] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get total available rooms for occupancy calculation
    const totalRooms = await Room.aggregate([
      {
        $group: {
          _id: null,
          totalRooms: { $sum: '$totalRooms' }
        }
      }
    ]);

    // Guest demographics
    const guestDemographics = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          totalAdults: { $sum: '$adults' },
          totalChildren: { $sum: '$children' },
          averageGroupSize: { $avg: { $add: ['$adults', '$children'] } },
          familyBookings: {
            $sum: { $cond: [{ $gt: ['$children', 0] }, 1, 0] }
          },
          coupleBookings: {
            $sum: { $cond: [{ $and: [{ $eq: ['$adults', 2] }, { $eq: ['$children', 0] }] }, 1, 0] }
          },
          soloBookings: {
            $sum: { $cond: [{ $and: [{ $eq: ['$adults', 1] }, { $eq: ['$children', 0] }] }, 1, 0] }
          }
        }
      }
    ]);

    // Cancellation analysis
    const cancellationAnalysis = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$bookingStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate cancellation rate
    const totalBookingsCount = cancellationAnalysis.reduce((sum, item) => sum + item.count, 0);
    const cancelledCount = cancellationAnalysis.find(item => item._id === 'CANCELLED')?.count || 0;
    const cancellationRate = totalBookingsCount > 0 ? Math.round((cancelledCount / totalBookingsCount) * 100) : 0;

    // Average daily rate (ADR)
    const adrData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          paymentStatus: 'PAID'
        }
      },
      {
        $project: {
          dailyRate: {
            $divide: [
              '$totalAmount',
              {
                $divide: [
                  { $subtract: ['$checkOut', '$checkIn'] },
                  1000 * 60 * 60 * 24
                ]
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          averageDailyRate: { $avg: '$dailyRate' }
        }
      }
    ]);

    res.json({
      dateRange: { start, end },
      totalRooms: totalRooms[0]?.totalRooms || 0,
      bookingStatistics: bookingStats[0] || {},
      bookingTrends,
      roomPerformance,
      leadTimeAnalysis: leadTimeAnalysis[0] || {},
      occupancyData,
      guestDemographics: guestDemographics[0] || {},
      cancellationRate,
      averageDailyRate: adrData[0]?.averageDailyRate || 0
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics data' });
  }
});

// Get revenue reports (admin only)
router.get('/revenue-reports', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '12' } = req.query; // Default to 12 months
    
    const end = new Date();
    const start = new Date();
    start.setMonth(end.getMonth() - parseInt(period));

    // Monthly revenue breakdown
    const monthlyRevenue = await Booking.aggregate([
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

    // Revenue by room type
    const revenueByRoom = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          paymentStatus: 'PAID'
        }
      },
      {
        $lookup: {
          from: 'rooms',
          localField: 'roomId',
          foreignField: '_id',
          as: 'room'
        }
      },
      { $unwind: '$room' },
      {
        $group: {
          _id: '$room.name',
          revenue: { $sum: '$totalAmount' },
          bookings: { $sum: 1 },
          percentage: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Calculate percentages
    const totalRevenue = revenueByRoom.reduce((sum, item) => sum + item.revenue, 0);
    revenueByRoom.forEach(room => {
      room.percentage = totalRevenue > 0 ? Math.round((room.revenue / totalRevenue) * 100) : 0;
    });

    // Payment method breakdown
    const paymentMethods = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          paymentStatus: 'PAID'
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          revenue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      monthlyRevenue,
      revenueByRoom,
      paymentMethods,
      totalRevenue,
      period: parseInt(period)
    });
  } catch (error) {
    console.error('Revenue reports error:', error);
    res.status(500).json({ error: 'Failed to get revenue reports' });
  }
});

// Get dashboard overview (admin only)
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Yesterday's dates for comparison
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const endOfYesterday = new Date(startOfYesterday.getTime() + 24 * 60 * 60 * 1000);

    // Last month for comparison
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Today's arrivals
    const todayArrivals = await Booking.countDocuments({
      checkIn: { $gte: startOfDay, $lt: endOfDay },
      bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] }
    });

    // Yesterday's arrivals for comparison
    const yesterdayArrivals = await Booking.countDocuments({
      checkIn: { $gte: startOfYesterday, $lt: endOfYesterday },
      bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] }
    });

    // Available rooms - sum all totalRooms from all room types
    const allRooms = await Room.find({}, 'totalRooms');
    const totalRoomsCount = allRooms.reduce((sum, room) => sum + room.totalRooms, 0);
    
    // Currently occupied rooms
    const occupiedRooms = await Booking.countDocuments({
      checkIn: { $lte: today },
      checkOut: { $gte: today },
      bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] }
    });
    
    const availableRooms = Math.max(0, totalRoomsCount - occupiedRooms);
    const occupancyRate = totalRoomsCount > 0 ? Math.round((occupiedRooms / totalRoomsCount) * 100) : 0;

    // Total guests today
    const todayGuests = await Booking.aggregate([
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
    const yesterdayGuests = await Booking.aggregate([
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
    const yesterdayOccupiedRooms = await Booking.countDocuments({
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

    const arrivalsChange = calculateChange(todayArrivals, yesterdayArrivals);
    const guestsChange = calculateChange(todayGuestsCount, yesterdayGuestsCount);
    const occupancyChange = calculateChange(occupancyRate, yesterdayOccupancyRate);
    
    // For available rooms, we compare with total rooms as a percentage
    const availabilityPercentage = totalRoomsCount > 0 ? Math.round((availableRooms / totalRoomsCount) * 100) : 0;
    const yesterdayAvailableRooms = totalRoomsCount - yesterdayOccupiedRooms;
    const yesterdayAvailabilityPercentage = totalRoomsCount > 0 ? Math.round((yesterdayAvailableRooms / totalRoomsCount) * 100) : 0;
    const availabilityChange = calculateChange(availabilityPercentage, yesterdayAvailabilityPercentage);

    // Recent bookings
    const recentBookings = await Booking.find()
      .populate('room', 'name')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Monthly revenue
    const monthlyRevenue = await Booking.aggregate([
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
    const unreadContacts = await Contact.countDocuments({ status: 'UNREAD' });

    res.json({
      stats: {
        todayArrivals: {
          value: todayArrivals,
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
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      unreadContacts
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

// Get all bookings (admin only) - proxy to bookings route
router.get('/bookings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const Booking = require('../models/Booking');
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
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.bookingStatus = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (checkIn) filter.checkIn = { $gte: new Date(checkIn) };
    if (checkOut) filter.checkOut = { $lte: new Date(checkOut) };
    if (guestEmail) filter['guestInfo.email'] = { $regex: guestEmail, $options: 'i' };

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await Booking.find(filter)
      .populate('room', 'name')
      .populate('user', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(filter);

    res.json({
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

// Get all rooms (admin only)
router.get('/rooms', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const Room = require('../models/Room');
    const {
      available,
      roomType,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    if (available !== undefined) filter.available = available === 'true';
    if (roomType) filter.roomType = roomType;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const rooms = await Room.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Room.countDocuments(filter);

    res.json({
      rooms,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all rooms error:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

// Create new room (admin only)
router.post('/rooms', authenticateToken, requireAdmin, [
  body('name').trim().isLength({ min: 2 }).withMessage('Room name must be at least 2 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  body('totalRooms').isInt({ min: 1 }).withMessage('Total rooms must be at least 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const Room = require('../models/Room');
    const roomData = req.body;

    const room = new Room(roomData);
    await room.save();

    res.status(201).json({
      message: 'Room created successfully',
      room
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Update room (admin only)
router.put('/rooms/:id', authenticateToken, requireAdmin, [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Room name must be at least 2 characters'),
  body('description').optional().trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('price').optional().isNumeric().withMessage('Price must be a number'),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  body('totalRooms').optional().isInt({ min: 1 }).withMessage('Total rooms must be at least 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const Room = require('../models/Room');
    const updates = req.body;

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      message: 'Room updated successfully',
      room
    });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// Delete room (admin only)
router.delete('/rooms/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const Room = require('../models/Room');
    const Booking = require('../models/Booking');
    
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if room has active bookings
    const hasActiveBookings = await Booking.exists({ 
      roomId: room._id,
      bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] },
      checkOut: { $gte: new Date() }
    });
    
    if (hasActiveBookings) {
      return res.status(400).json({ 
        error: 'Cannot delete room with active bookings' 
      });
    }

    await Room.findByIdAndDelete(req.params.id);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get single user (admin only)
router.get('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's bookings
    const bookings = await Booking.find({ userId: user._id })
      .populate('room', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      user,
      bookings
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user (admin only)
router.put('/users/:id', authenticateToken, requireAdmin, [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['ADMIN', 'USER']).withMessage('Valid role is required'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, role, isActive } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (email) updates.email = email;
    if (role) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has bookings
    const hasBookings = await Booking.exists({ userId: user._id });
    if (hasBookings) {
      return res.status(400).json({ 
        error: 'Cannot delete user with existing bookings' 
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Create admin user (admin only)
router.post('/users/admin', authenticateToken, requireAdmin, [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const admin = await User.createAdmin({
      name,
      email,
      password
    });

    res.status(201).json({
      message: 'Admin user created successfully',
      user: admin.getPublicProfile()
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// Get system statistics (admin only)
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // User statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ role: 'ADMIN' });

    // Booking statistics
    const totalBookings = await Booking.countDocuments();
    const monthlyBookings = await Booking.countDocuments({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Revenue statistics
    const totalRevenue = await Booking.aggregate([
      { $match: { paymentStatus: 'PAID' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const monthlyRevenue = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
          paymentStatus: 'PAID'
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // Room statistics
    const totalRooms = await Room.countDocuments();
    const availableRooms = await Room.countDocuments({ available: true });

    // Contact statistics
    const totalContacts = await Contact.countDocuments();
    const unreadContacts = await Contact.countDocuments({ status: 'UNREAD' });

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        admins: adminUsers
      },
      bookings: {
        total: totalBookings,
        monthly: monthlyBookings
      },
      revenue: {
        total: totalRevenue[0]?.total || 0,
        monthly: monthlyRevenue[0]?.total || 0
      },
      rooms: {
        total: totalRooms,
        available: availableRooms
      },
      contacts: {
        total: totalContacts,
        unread: unreadContacts
      }
    });
  } catch (error) {
    console.error('System stats error:', error);
    res.status(500).json({ error: 'Failed to get system statistics' });
  }
});

module.exports = router; 