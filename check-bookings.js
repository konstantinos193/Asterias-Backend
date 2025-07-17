const mongoose = require('mongoose');
require('dotenv').config();

// Simple booking schema
const bookingSchema = new mongoose.Schema({
  bookingNumber: String,
  guestInfo: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String
  },
  checkIn: Date,
  checkOut: Date,
  totalAmount: Number,
  bookingStatus: String,
  createdAt: { type: Date, default: Date.now }
}, { collection: 'bookings' });

const Booking = mongoose.model('Booking', bookingSchema);

async function checkBookings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const count = await Booking.countDocuments();
    console.log('Total bookings in database:', count);
    
    const recent = await Booking.find({})
      .sort({ createdAt: -1 })
      .limit(5);
    
    console.log('Recent bookings:', recent.length);
    recent.forEach(booking => {
      console.log('- Booking:', booking.bookingNumber || booking._id, 
        booking.guestInfo?.firstName || 'No guest info',
        booking.guestInfo?.lastName || '',
        booking.bookingStatus || 'No status',
        '€' + booking.totalAmount || '0');
    });
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
  }
}

checkBookings(); 