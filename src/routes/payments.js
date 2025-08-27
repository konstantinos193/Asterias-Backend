const express = require('express');
const { body, validationResult } = require('express-validator');
const Stripe = require('stripe');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { detectLanguage, sendBookingConfirmationEmail } = require('../services/emailService');

const router = express.Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// Create payment intent
router.post('/create-payment-intent', [
  body('roomId').isMongoId().withMessage('Valid room ID is required'),
  body('checkIn').isISO8601().withMessage('Valid check-in date is required'),
  body('checkOut').isISO8601().withMessage('Valid check-out date is required'),
  body('adults').isInt({ min: 1 }).withMessage('At least 1 adult is required'),
  body('children').optional().isInt({ min: 0 }).withMessage('Children must be 0 or more'),
  body('currency').optional().isIn(['eur', 'usd', 'gbp']).withMessage('Valid currency is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      roomId,
      checkIn,
      checkOut,
      adults,
      children = 0,
      currency = 'eur'
    } = req.body;

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check availability for individual room
    const isAvailable = await Booking.isIndividualRoomAvailable(roomId, checkIn, checkOut);
    if (!isAvailable) {
      return res.status(400).json({ error: 'Room is not available for the selected dates' });
    }

    // Calculate total amount
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    const basePrice = nights * room.price;
    const taxAmount = basePrice * 0.13; // 13% tax
    const totalAmount = Math.round((basePrice + taxAmount) * 100); // Convert to cents

    if (totalAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        roomId: roomId,
        checkIn: checkIn,
        checkOut: checkOut,
        adults: adults,
        children: children,
        nights: nights
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: totalAmount / 100,
      currency: currency
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Confirm payment and create booking
router.post('/confirm-payment', [
  body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
  body('guestInfo').isObject().withMessage('Guest information is required'),
  body('guestInfo.firstName').trim().notEmpty().withMessage('First name is required'),
  body('guestInfo.lastName').trim().notEmpty().withMessage('Last name is required'),
  body('guestInfo.email').isEmail().withMessage('Valid email is required'),
  body('guestInfo.phone').trim().notEmpty().withMessage('Phone is required'),
  body('specialRequests').optional().trim()
], optionalAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paymentIntentId, guestInfo, specialRequests } = req.body;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Extract metadata
    const {
      roomId,
      checkIn,
      checkOut,
      adults,
      children,
      nights
    } = paymentIntent.metadata;

    // Check if room still exists and is available
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isAvailable = await Booking.isIndividualRoomAvailable(roomId, checkIn, checkOut);
    if (!isAvailable) {
      return res.status(400).json({ error: 'Room is no longer available for the selected dates' });
    }

    // Detect customer's language from request
    const customerLanguage = detectLanguage(null, req);
    
    // Add language to guest info
    const guestInfoWithLanguage = {
      ...guestInfo,
      language: customerLanguage
    };

    // Generate booking number manually
    const year = new Date().getFullYear();
    const lastBooking = await Booking.findOne(
      { 
        bookingNumber: { $regex: `^AST-${year}-` }
      },
      { bookingNumber: 1 }
    ).sort({ bookingNumber: -1 });
    
    let nextNumber = 1;
    if (lastBooking && lastBooking.bookingNumber) {
      const lastNumber = parseInt(lastBooking.bookingNumber.split('-')[2]);
      nextNumber = lastNumber + 1;
    }
    
    const bookingNumber = `AST-${year}-${String(nextNumber).padStart(3, '0')}`;
    console.log('Generated booking number:', bookingNumber);

    // Create booking
    console.log('Creating booking with data:', {
      roomId,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      adults: parseInt(adults),
      children: parseInt(children),
      totalAmount: paymentIntent.amount / 100,
      paymentMethod: 'CARD',
      paymentStatus: 'PAID',
      bookingStatus: 'CONFIRMED',
      stripePaymentIntentId: paymentIntentId,
      bookingNumber: bookingNumber
    });

    const booking = new Booking({
      roomId,
      userId: req.user?._id, // Optional user association
      guestInfo: {
        ...guestInfoWithLanguage,
        specialRequests: specialRequests || ''
      },
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      adults: parseInt(adults),
      children: parseInt(children),
      totalAmount: paymentIntent.amount / 100,
      paymentMethod: 'CARD',
      paymentStatus: 'PAID',
      bookingStatus: 'CONFIRMED',
      stripePaymentIntentId: paymentIntentId,
      bookingNumber: bookingNumber
    });

    console.log('Booking object created, about to save...');
    console.log('Booking object:', booking);
    
    await booking.save();
    console.log('Booking saved successfully, bookingNumber:', booking.bookingNumber);
    
    // Send confirmation email to customer
    try {
      await sendBookingConfirmationEmail(booking, req);
      console.log('Confirmation email sent successfully to:', booking.guestInfo.email);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the booking if email fails
    }

    res.status(201).json({
      message: 'Payment confirmed and booking created successfully',
      booking
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// Create cash booking (no payment intent)
router.post('/create-cash-booking', [
  body('roomId').notEmpty().withMessage('Room ID is required'),
  body('checkIn').notEmpty().withMessage('Check-in date is required'),
  body('checkOut').notEmpty().withMessage('Check-out date is required'),
  body('adults').isInt({ min: 1 }).withMessage('At least one adult is required'),
  body('children').optional().isInt({ min: 0 }).withMessage('Children must be a positive number'),
  body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount is required'),
  body('guestInfo').isObject().withMessage('Guest information is required'),
  body('guestInfo.firstName').trim().notEmpty().withMessage('First name is required'),
  body('guestInfo.lastName').trim().notEmpty().withMessage('Last name is required'),
  body('guestInfo.email').isEmail().withMessage('Valid email is required'),
  body('guestInfo.phone').trim().notEmpty().withMessage('Phone is required'),
  body('specialRequests').optional().trim()
], optionalAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { roomId, checkIn, checkOut, adults, children, totalAmount, guestInfo, specialRequests } = req.body;

    // Check if room still exists and is available
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isAvailable = await Booking.isIndividualRoomAvailable(roomId, checkIn, checkOut);
    if (!isAvailable) {
      return res.status(400).json({ error: 'Room is no longer available for the selected dates' });
    }

    // Detect customer's language from request
    const customerLanguage = detectLanguage(null, req);
    
    // Add language to guest info
    const guestInfoWithLanguage = {
      ...guestInfo,
      language: customerLanguage
    };

    // Generate booking number manually for cash booking
    const year = new Date().getFullYear();
    const lastBooking = await Booking.findOne(
      { 
        bookingNumber: { $regex: `^AST-${year}-` }
      },
      { bookingNumber: 1 }
    ).sort({ bookingNumber: -1 });
    
    let nextNumber = 1;
    if (lastBooking && lastBooking.bookingNumber) {
      const lastNumber = parseInt(lastBooking.bookingNumber.split('-')[2]);
      nextNumber = lastNumber + 1;
    }
    
    const bookingNumber = `AST-${year}-${String(nextNumber).padStart(3, '0')}`;
    console.log('Generated cash booking number:', bookingNumber);

    // Create booking
    console.log('Creating cash booking with data:', {
      roomId,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      adults: parseInt(adults),
      children: parseInt(children),
      totalAmount: parseFloat(totalAmount),
      paymentMethod: 'CASH',
      paymentStatus: 'PENDING',
      bookingStatus: 'CONFIRMED',
      bookingNumber: bookingNumber
    });

    const booking = new Booking({
      roomId,
      userId: req.user?._id, // Optional user association
      guestInfo: {
        ...guestInfoWithLanguage,
        specialRequests: specialRequests || ''
      },
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      adults: parseInt(adults),
      children: parseInt(children),
      totalAmount: parseFloat(totalAmount),
      paymentMethod: 'CASH',
      paymentStatus: 'PENDING',
      bookingStatus: 'CONFIRMED',
      bookingNumber: bookingNumber
    });

    console.log('Cash booking object created, about to save...');
    console.log('Cash booking object:', booking);
    
    await booking.save();
    console.log('Cash booking saved successfully, bookingNumber:', booking.bookingNumber);
    
    // Send confirmation email to customer
    try {
      await sendBookingConfirmationEmail(booking, req);
      console.log('Confirmation email sent successfully to:', booking.guestInfo.email);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the booking if email fails
    }

    res.status(201).json({
      message: 'Cash booking created successfully',
      booking
    });
  } catch (error) {
    console.error('Create cash booking error:', error);
    res.status(500).json({ error: 'Failed to create cash booking' });
  }
});

// Get payment status
router.get('/status/:paymentIntentId', async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    res.json({
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

// Refund payment (admin only)
router.post('/refund/:bookingId', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (!booking.stripePaymentIntentId) {
      return res.status(400).json({ error: 'No Stripe payment found for this booking' });
    }

    if (booking.paymentStatus === 'REFUNDED') {
      return res.status(400).json({ error: 'Payment has already been refunded' });
    }

    // Create refund in Stripe
    const refund = await stripe.refunds.create({
      payment_intent: booking.stripePaymentIntentId,
      reason: 'requested_by_customer'
    });

    // Update booking status
    booking.paymentStatus = 'REFUNDED';
    booking.bookingStatus = 'CANCELLED';
    await booking.save();

    res.json({
      message: 'Payment refunded successfully',
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      },
      booking
    });
  } catch (error) {
    console.error('Refund payment error:', error);
    res.status(500).json({ error: 'Failed to refund payment' });
  }
});

// Webhook for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('Payment succeeded:', paymentIntent.id);
        // You can add additional logic here if needed
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('Payment failed:', failedPayment.id);
        // Handle failed payment
        break;

      case 'charge.refunded':
        const refund = event.data.object;
        console.log('Payment refunded:', refund.payment_intent);
        // Handle refund
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router; 