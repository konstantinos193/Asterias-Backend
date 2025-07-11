const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Create new booking
router.post('/', [
  body('roomId').isMongoId().withMessage('Valid room ID is required'),
  body('guestInfo.firstName').trim().notEmpty().withMessage('First name is required'),
  body('guestInfo.lastName').trim().notEmpty().withMessage('Last name is required'),
  body('guestInfo.email').isEmail().withMessage('Valid email is required'),
  body('guestInfo.phone').trim().notEmpty().withMessage('Phone is required'),
  body('checkIn').isISO8601().withMessage('Valid check-in date is required'),
  body('checkOut').isISO8601().withMessage('Valid check-out date is required'),
  body('adults').isInt({ min: 1 }).withMessage('At least 1 adult is required'),
  body('children').optional().isInt({ min: 0 }).withMessage('Children must be 0 or more'),
  body('paymentMethod').isIn(['CARD', 'CASH']).withMessage('Valid payment method is required'),
  body('totalAmount').isFloat({ min: 0 }).withMessage('Valid total amount is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      roomId,
      guestInfo,
      checkIn,
      checkOut,
      adults,
      children,
      paymentMethod,
      totalAmount,
      specialRequests
    } = req.body;

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if room is available for the dates
    const isAvailable = await Booking.checkAvailability(roomId, checkIn, checkOut);
    if (!isAvailable) {
      return res.status(400).json({ error: 'Room is not available for the selected dates' });
    }

    // Check capacity
    const totalGuests = adults + (children || 0);
    if (totalGuests > room.capacity) {
      return res.status(400).json({ 
        error: `Room capacity is ${room.capacity} guests, but ${totalGuests} guests were selected` 
      });
    }

    // Create booking
    const booking = new Booking({
      roomId,
      userId: req.user?._id, // Optional user association
      guestInfo,
      checkIn,
      checkOut,
      adults,
      children: children || 0,
      paymentMethod,
      totalAmount,
      specialRequests
    });

    await booking.save();

    // Populate room details for response
    await booking.populate('room');

    res.status(201).json({
      message: 'Booking created successfully',
      booking
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Get user's bookings (authenticated users)
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const filter = { userId: req.user._id };
    if (status) filter.bookingStatus = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await Booking.find(filter)
      .populate('room')
      .sort({ createdAt: -1 })
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
    console.error('Get my bookings error:', error);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

// Get single booking by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('room')
      .populate('user', 'name email');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if user can access this booking
    if (req.user.role !== 'ADMIN' && booking.userId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ booking });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to get booking' });
  }
});

// Update booking status (admin only)
router.patch('/:id/status', authenticateToken, requireAdmin, [
  body('bookingStatus').isIn(['CONFIRMED', 'PENDING', 'CANCELLED', 'CHECKED_IN', 'CHECKED_OUT'])
    .withMessage('Valid booking status is required'),
  body('paymentStatus').optional().isIn(['PENDING', 'PAID', 'FAILED', 'REFUNDED'])
    .withMessage('Valid payment status is required'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { bookingStatus, paymentStatus, notes } = req.body;
    const updates = {};

    if (bookingStatus) updates.bookingStatus = bookingStatus;
    if (paymentStatus) updates.paymentStatus = paymentStatus;
    if (notes !== undefined) updates.notes = notes;

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    ).populate('room');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      message: 'Booking status updated successfully',
      booking
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// Get all bookings (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
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
      .populate('room')
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

// Cancel booking
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if user can cancel this booking
    if (req.user.role !== 'ADMIN' && booking.userId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if booking can be cancelled
    if (booking.bookingStatus === 'CANCELLED') {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    if (booking.bookingStatus === 'CHECKED_IN') {
      return res.status(400).json({ error: 'Cannot cancel checked-in booking' });
    }

    booking.bookingStatus = 'CANCELLED';
    await booking.save();

    res.json({
      message: 'Booking cancelled successfully',
      booking
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// Get booking statistics (admin only)
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await Booking.getStats();
    
    // Additional stats
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const monthlyBookings = await Booking.countDocuments({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

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

    const statusBreakdown = await Booking.aggregate([
      {
        $group: {
          _id: '$bookingStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      ...stats,
      monthlyBookings,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Booking stats error:', error);
    res.status(500).json({ error: 'Failed to get booking statistics' });
  }
});

module.exports = router; 