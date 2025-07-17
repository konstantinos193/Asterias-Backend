const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Contact = require('../models/Contact');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

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