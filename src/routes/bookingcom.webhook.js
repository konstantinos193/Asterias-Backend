const express = require('express');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const crypto = require('crypto');

const router = express.Router();

// This is a secret provided by Booking.com for webhook verification.
const BOOKINGCOM_WEBHOOK_SECRET = process.env.BOOKINGCOM_WEBHOOK_SECRET;

// Middleware to verify the webhook signature from Booking.com
// Note: The actual verification method will be specified in the Booking.com API documentation.
// This is a common example using HMAC-SHA256.
function verifyBookingcomWebhook(req, res, next) {
  const signature = req.headers['x-bookingcom-signature']; // Example header
  if (!signature) {
    return res.status(401).send('No signature found');
  }

  const hmac = crypto.createHmac('sha256', BOOKINGCOM_WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    return res.status(401).send('Invalid signature');
  }

  next();
}

router.post('/notification', verifyBookingcomWebhook, async (req, res) => {
  const notification = req.body;

  // You'll need to handle various notification types from Booking.com (e.g., new, modified, cancelled)
  if (notification.event === 'booking.created') {
    const externalBooking = notification.data;

    try {
      // Find our internal room using the ID from Booking.com
      const room = await Room.findOne({ bookingcom_room_id: externalBooking.room_id });

      if (!room) {
        console.warn(`Webhook received for a room not mapped in our system: ${externalBooking.room_id}`);
        // Acknowledge receipt so Booking.com doesn't keep retrying.
        return res.status(200).send('Webhook received for unmapped room.');
      }

      // Prevent duplicate bookings from repeated webhooks
      const existingBooking = await Booking.findOne({ bookingcom_booking_id: externalBooking.booking_id });
      if (existingBooking) {
        console.log(`Booking ${externalBooking.booking_id} from Booking.com already exists.`);
        return res.status(200).send('Booking already processed.');
      }

      // Create a new booking in our system based on the webhook data
      const newBooking = new Booking({
        roomId: room._id,
        bookingcom_booking_id: externalBooking.booking_id,
        guestInfo: {
          firstName: externalBooking.guest_details.first_name,
          lastName: externalBooking.guest_details.last_name,
          email: externalBooking.guest_details.email,
          phone: externalBooking.guest_details.phone
        },
        checkIn: externalBooking.checkin_date,
        checkOut: externalBooking.checkout_date,
        totalAmount: externalBooking.total_price,
        adults: externalBooking.adults,
        children: externalBooking.children,
        bookingStatus: 'CONFIRMED', // Or map from Booking.com status
        source: 'bookingcom'
      });

      await newBooking.save();
      console.log(`Successfully created booking ${newBooking._id} from Booking.com webhook.`);

    } catch (error) {
      console.error('Error processing Booking.com webhook:', error);
      return res.status(500).send('Error processing webhook');
    }
  }

  // Always respond with a 200 OK to Booking.com to acknowledge receipt.
  res.status(200).send('Webhook received successfully.');
});

module.exports = router;
