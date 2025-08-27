const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const { authenticateToken, requireAdmin, requireApiKeyOrAdmin, optionalAuth } = require('../middleware/auth');
const bookingcomService = require('../services/bookingcom.service');
const requireApiKey = require('../middleware/apiKey');
const { sendBookingConfirmation, sendNewBookingAlert, sendEmailToAllAdmins, detectLanguage } = require('../services/emailService');

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

    // Check if this specific individual room is available for the dates
    const isAvailable = await Booking.isIndividualRoomAvailable(roomId, checkIn, checkOut);
    if (!isAvailable) {
      return res.status(400).json({ error: 'Sorry, this specific room is not available for the selected dates.' });
    }

    // Check capacity
    const totalGuests = adults + (children || 0);
    if (totalGuests > room.capacity) {
      return res.status(400).json({ 
        error: `Room capacity is ${room.capacity} guests, but ${totalGuests} guests were selected` 
      });
    }

    // Detect customer's language from request
    const customerLanguage = detectLanguage(null, req);
    
    // Add language to guest info
    const guestInfoWithLanguage = {
      ...guestInfo,
      language: customerLanguage
    };

    // Create booking
    const booking = new Booking({
      roomId,
      userId: req.user?._id, // Optional user association
      guestInfo: guestInfoWithLanguage,
      checkIn,
      checkOut,
      adults,
      children: children || 0,
      paymentMethod,
      totalAmount,
      specialRequests
    });

    await booking.save();

    // After saving our booking, create a corresponding one on Booking.com
    try {
      const externalBooking = await bookingcomService.createBooking(booking.toObject());
      // Save the external ID to our booking for future reference
      booking.bookingcom_booking_id = externalBooking.id;
      await booking.save();
    } catch (error) {
      // This is a critical failure. The booking was made on our site, but not on Booking.com.
      // This requires a robust error handling strategy, such as:
      // 1. Rollback the local booking.
      // 2. Add the booking to a retry queue.
      // 3. Send an alert to an administrator.
      console.error(`CRITICAL: Failed to create booking on Booking.com for local booking ${booking._id}. Manual intervention required.`);
      // For now, we will proceed but this should be addressed.
    }

    // Populate room details for response
    await booking.populate('room');

    // Send email notifications (async, don't block response)
    setImmediate(async () => {
      try {
        console.log(`📧 Sending notifications for booking ${booking._id}...`);
        
        // Send confirmation email to customer  
        const confirmationResult = await sendBookingConfirmation({
          bookingId: booking.bookingNumber,
          guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName}`,
          guestEmail: booking.guestInfo.email,
          guestPhone: booking.guestInfo.phone,
          roomName: room.name,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          checkInTime: '15:00', // Get from settings later
          checkOutTime: '11:00', // Get from settings later
          guests: booking.adults + booking.children,
          totalPrice: booking.totalAmount,
          language: booking.guestInfo.language
        }, { language: booking.guestInfo.language });
        if (confirmationResult && confirmationResult.success) {
          console.log(`✅ Booking confirmation sent to ${booking.guestInfo.email}`);
        } else {
          console.log(`❌ Failed to send booking confirmation to ${booking.guestInfo.email}`);
        }

        // Send new booking alert to admin
        const alertResult = await sendNewBookingAlert({
          bookingId: booking.bookingNumber,
          guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName}`,
          guestEmail: booking.guestInfo.email,
          guestPhone: booking.guestInfo.phone,
          roomName: room.name,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          guests: booking.adults + booking.children,
          totalPrice: booking.totalAmount,
          status: booking.bookingStatus,
          createdAt: booking.createdAt,
          language: booking.guestInfo.language  // Include customer's language for admin reference
        });
        if (alertResult && alertResult.success) {
          console.log(`✅ New booking alert sent to admin`);
        } else {
          console.log(`❌ Failed to send new booking alert to admin`);
        }

      } catch (error) {
        console.error('Error sending booking notifications:', error);
      }
    });

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

// Update booking status (admin only) - accept either API key or admin auth
router.patch('/:id/status', requireApiKeyOrAdmin, [
  body('status').isIn(['CONFIRMED', 'PENDING', 'CANCELLED', 'CHECKED_IN', 'CHECKED_OUT'])
    .withMessage('Valid booking status is required'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, notes } = req.body;
    const updates = {};

    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    ).populate('roomId', 'name type price capacity');

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

// Get all bookings - no auth required for now
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Build query
    const query = {};
    if (status && status !== 'all') {
      query.bookingStatus = status;
    }
    
    if (search) {
      query.$or = [
        { 'guestInfo.firstName': { $regex: search, $options: 'i' } },
        { 'guestInfo.lastName': { $regex: search, $options: 'i' } },
        { 'guestInfo.email': { $regex: search, $options: 'i' } },
        { bookingNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const bookings = await Booking.find(query)
      .populate('roomId', 'name type')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Booking.countDocuments(query);
    
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

// Get availability for a room type and date range
router.get('/availability', requireApiKey, async (req, res) => {
  try {
    const { roomId, checkIn, checkOut } = req.query;
    console.log('AVAILABILITY REQUEST', { roomId, checkIn, checkOut });
    if (!roomId || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'roomId, checkIn, and checkOut are required' });
    }
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    const booked = await Booking.countDocuments({
      roomId,
      bookingStatus: { $nin: ['CANCELLED'] },
      $or: [
        { checkIn: { $lt: new Date(checkOut) }, checkOut: { $gt: new Date(checkIn) } },
      ]
    });
    const available = Math.max(room.totalRooms - booked, 0);
    console.log('AVAILABILITY RESPONSE', { available, totalRooms: room.totalRooms, booked });
    res.json({
      available,
      totalRooms: room.totalRooms,
      booked
    });
  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Get calendar availability for a room type and date range
router.get('/calendar-availability', requireApiKey, async (req, res) => {
  try {
    const { roomId, start, end } = req.query;
    if (!roomId || !start || !end) {
      return res.status(400).json({ error: 'roomId, start, and end are required' });
    }
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Get all bookings for this room type that overlap with the range
    const bookings = await Booking.find({
      roomId,
      bookingStatus: { $nin: ['CANCELLED'] },
      $or: [
        { checkIn: { $lt: new Date(end) }, checkOut: { $gt: new Date(start) } }
      ]
    });

    // Build a map of date -> number of bookings
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    const availability = {};
    for (const day of days) {
      const dayStr = day.toISOString().slice(0, 10);
      // Count bookings that overlap this day
      const booked = bookings.filter(b =>
        new Date(b.checkIn) < day && new Date(b.checkOut) > day
      ).length;
      availability[dayStr] = Math.max(room.totalRooms - booked, 0);
    }

    res.json({
      roomId,
      totalRooms: room.totalRooms,
      availability
    });
  } catch (error) {
    console.error('Calendar availability error:', error);
    res.status(500).json({ error: 'Failed to get calendar availability' });
  }
});

// Get single booking by ID (for admin details page) - MUST be at the end to avoid route conflicts
router.get('/:bookingId', requireApiKey, async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    if (!bookingId) {
      return res.status(400).json({ error: 'Booking ID is required' });
    }

    const booking = await Booking.findById(bookingId)
      .populate('roomId', 'name totalRooms price capacity size')
      .populate('userId', 'name email');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Add booking history if it doesn't exist
    if (!booking.history || booking.history.length === 0) {
      booking.history = [
        {
          date: booking.createdAt,
          action: 'Δημιουργία κράτησης',
          user: 'Σύστημα'
        }
      ];
      
      if (booking.bookingStatus === 'CONFIRMED') {
        booking.history.push({
          date: new Date(booking.createdAt.getTime() + 1000 * 60 * 38), // 38 minutes later
          action: 'Επιβεβαίωση κράτησης',
          user: 'Σύστημα'
        });
      }
    }

    res.json({ booking });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to get booking' });
  }
});

// Send email to guest from admin panel
router.post('/:bookingId/send-email', requireApiKey, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { emailType, customMessage } = req.body;
    
    if (!bookingId) {
      return res.status(400).json({ error: 'Booking ID is required' });
    }

    if (!emailType) {
      return res.status(400).json({ error: 'Email type is required' });
    }

    const booking = await Booking.findById(bookingId)
      .populate('roomId', 'name totalRooms price capacity size');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (!booking.guestInfo || !booking.guestInfo.email) {
      return res.status(400).json({ error: 'Guest email not found' });
    }

    let emailResult;
    const emailData = {
      guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName}`,
      guestEmail: booking.guestInfo.email,
      bookingNumber: booking.bookingNumber,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      roomName: booking.roomId?.name || 'Δωμάτιο',
      totalAmount: booking.totalAmount,
      customMessage: customMessage || ''
    };

    switch (emailType) {
      case 'confirmation':
        emailResult = await sendBookingConfirmationEmail(booking, req);
        break;
      case 'reminder':
        emailResult = await sendArrivalReminder(booking, req);
        break;
      case 'custom':
        // Send custom email with custom message
        emailResult = await sendEmail('customMessage', emailData, { 
          language: booking.guestInfo.language || 'el' 
        });
        break;
      default:
        return res.status(400).json({ error: 'Invalid email type' });
    }

    if (emailResult.success) {
      // Add to booking history
      if (!booking.history) booking.history = [];
      booking.history.push({
        date: new Date(),
        action: `Αποστολή email: ${emailType === 'confirmation' ? 'Επιβεβαίωση' : emailType === 'reminder' ? 'Υπενθύμιση' : 'Προσωπικό μήνυμα'}`,
        user: 'Διαχειριστής'
      });
      await booking.save();

      res.json({ 
        success: true, 
        message: `Email sent successfully to ${booking.guestInfo.email}`,
        emailType 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send email',
        details: emailResult.error 
      });
    }

  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

module.exports = router; 