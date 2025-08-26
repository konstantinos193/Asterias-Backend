const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingNumber: {
    type: String,
    required: true,
    unique: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  guestInfo: {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    specialRequests: {
      type: String,
      default: ''
    },
    language: {
      type: String,
      enum: ['el', 'en', 'de'],
      default: 'en'
    }
  },
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date,
    required: true
  },
  adults: {
    type: Number,
    required: true,
    min: 1
  },
  children: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['CARD', 'CASH'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
    default: 'PENDING'
  },
  bookingStatus: {
    type: String,
    enum: ['CONFIRMED', 'PENDING', 'CANCELLED', 'CHECKED_IN', 'CHECKED_OUT'],
    default: 'CONFIRMED'
  },
  stripePaymentIntentId: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: ''
  },
  bookingcom_booking_id: {
    type: String,
    default: null,
    unique: true,
    sparse: true
  },
  source: {
    type: String,
    enum: ['asterias', 'bookingcom'],
    default: 'asterias'
  }
}, {
  timestamps: true
});

// Index for better query performance
bookingSchema.index({ roomId: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ userId: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ bookingStatus: 1 });

// Generate booking number
bookingSchema.pre('save', async function(next) {
  console.log('Pre-save middleware triggered, isNew:', this.isNew, 'bookingNumber:', this.bookingNumber);
  
  if (this.isNew && !this.bookingNumber) {
    try {
      const year = new Date().getFullYear();
      console.log('Generating booking number for year:', year);
      
      const count = await this.constructor.countDocuments({
        createdAt: {
          $gte: new Date(year, 0, 1),
          $lt: new Date(year + 1, 0, 1)
        }
      });
      
      console.log('Count of existing bookings this year:', count);
      this.bookingNumber = `AST-${year}-${String(count + 1).padStart(3, '0')}`;
      console.log(`Generated booking number: ${this.bookingNumber}`);
    } catch (error) {
      console.error('Error generating booking number:', error);
      // Fallback: use timestamp-based number
      this.bookingNumber = `AST-${Date.now()}`;
      console.log('Using fallback booking number:', this.bookingNumber);
    }
  } else {
    console.log('Skipping booking number generation - isNew:', this.isNew, 'has bookingNumber:', !!this.bookingNumber);
  }
  next();
});

// Virtual for total guests
bookingSchema.virtual('totalGuests').get(function() {
  return this.adults + this.children;
});

// Virtual for nights
bookingSchema.virtual('nights').get(function() {
  const checkIn = new Date(this.checkIn);
  const checkOut = new Date(this.checkOut);
  const diffTime = Math.abs(checkOut - checkIn);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to check if an apartment is available for the given dates
bookingSchema.statics.isApartmentAvailable = async function(roomTypeId, checkIn, checkOut, excludeBookingId = null) {
  const Room = mongoose.model('Room');
  const roomType = await Room.findById(roomTypeId);
  if (!roomType) {
    throw new Error('Room type not found');
  }

  const query = {
    roomId: roomTypeId,
    bookingStatus: { $nin: ['CANCELLED'] },
    $or: [
      { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } }, // Overlaps
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const conflictingBookings = await this.countDocuments(query);

  return conflictingBookings < roomType.totalRooms;
};

// Method to get the number of available apartments for a date range
bookingSchema.statics.getAvailableApartmentCount = async function(roomTypeId, checkIn, checkOut) {
    const Room = mongoose.model('Room');
    const roomType = await Room.findById(roomTypeId);
    if (!roomType) {
        return 0;
    }

    const query = {
        roomId: roomTypeId,
        bookingStatus: { $nin: ['CANCELLED'] },
        $or: [
            { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } },
        ]
    };

    const conflictingBookings = await this.countDocuments(query);
    const availableCount = roomType.totalRooms - conflictingBookings;

    return availableCount > 0 ? availableCount : 0;
};


// Method to get booking statistics
bookingSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageBookingValue: { $avg: '$totalAmount' }
      }
    }
  ]);

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const todayBookings = await this.countDocuments({
    checkIn: { $gte: startOfDay, $lt: endOfDay }
  });

  return {
    ...stats[0],
    todayBookings
  };
};

module.exports = mongoose.model('Booking', bookingSchema); 