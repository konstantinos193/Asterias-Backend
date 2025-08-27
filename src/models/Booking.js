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
    default: null
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

// Method to drop problematic indexes (run this once to fix existing database)
bookingSchema.statics.dropProblematicIndexes = async function() {
  try {
    const collection = this.collection;
    const indexes = await collection.indexes();
    
    console.log('🔍 Current database indexes:', indexes.map(idx => ({
      name: idx.name,
      key: idx.key,
      unique: idx.unique,
      sparse: idx.sparse
    })));
    
    // Find and drop the problematic unique index on bookingcom_booking_id
    const problematicIndex = indexes.find(index => 
      index.key && index.key.bookingcom_booking_id === 1 && index.unique === true
    );
    
    if (problematicIndex) {
      console.log('🚨 Found problematic unique index:', problematicIndex.name);
      try {
        await collection.dropIndex(problematicIndex.name);
        console.log('✅ Successfully dropped problematic index:', problematicIndex.name);
      } catch (dropError) {
        console.error('❌ Failed to drop index:', problematicIndex.name, dropError.message);
      }
    } else {
      console.log('✅ No problematic unique indexes found on bookingcom_booking_id');
    }
    
    // Verify the index was dropped
    const updatedIndexes = await collection.indexes();
    const stillProblematic = updatedIndexes.find(index => 
      index.key && index.key.bookingcom_booking_id === 1 && index.unique === true
    );
    
    if (!stillProblematic) {
      console.log('✅ Confirmed: No more problematic indexes on bookingcom_booking_id');
    } else {
      console.log('⚠️ Warning: Problematic index still exists:', stillProblematic.name);
    }
    
  } catch (error) {
    console.error('❌ Error dropping indexes:', error.message);
  }
};

// Emergency method to recreate collection without problematic indexes
bookingSchema.statics.emergencyFixCollection = async function() {
  try {
    const collection = this.collection;
    const collectionName = collection.name;
    
    console.log('🚨 Emergency: Attempting to recreate collection without problematic indexes...');
    
    // Get all documents from current collection
    const allDocuments = await collection.find({}).toArray();
    console.log(`📊 Found ${allDocuments.length} documents to preserve`);
    
    // Drop the current collection (this will remove all indexes)
    await collection.drop();
    console.log('🗑️ Dropped problematic collection');
    
    // Recreate collection by inserting documents back
    if (allDocuments.length > 0) {
      const newCollection = mongoose.connection.db.collection(collectionName);
      await newCollection.insertMany(allDocuments);
      console.log('✅ Recreated collection with documents');
    }
    
    console.log('✅ Emergency fix completed - collection recreated without problematic indexes');
    
  } catch (error) {
    console.error('❌ Emergency fix failed:', error.message);
    throw error;
  }
};

// Note: Booking number generation is now handled manually in the payment routes
// to ensure it's set before validation occurs

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

  // For individual room bookings, we need to check if THIS specific room is available
  // Since each room has totalRooms: 1, we check if there are any conflicting bookings for this specific roomId
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
  
  // Since each room is individual (totalRooms: 1), we can only book if there are 0 conflicts
  const isAvailable = conflictingBookings === 0;
  
  console.log(`Availability check for room ${roomTypeId}:`, {
    roomId: roomTypeId,
    checkIn: new Date(checkIn),
    checkOut: new Date(checkOut),
    conflictingBookings,
    totalRooms: roomType.totalRooms,
    isAvailable
  });
  
  return isAvailable;
};

// Method to get the number of available apartments for a date range
bookingSchema.statics.getAvailableApartmentCount = async function(roomTypeId, checkIn, checkOut) {
    const Room = mongoose.model('Room');
    const roomType = await Room.findById(roomTypeId);
    if (!roomType) {
        return 0;
    }

    // For individual rooms, we need to count how many rooms of this type are available
    // Since all 7 rooms are identical "Standard Apartment" type, we need to check availability across all rooms
    // First, get all rooms of this type
    const allRoomsOfType = await Room.find({ nameKey: roomType.nameKey });
    const totalRoomsOfType = allRoomsOfType.length;
    
    if (totalRoomsOfType === 0) {
        return 0;
    }

    // Check how many rooms are booked for the given dates
    const query = {
        roomId: { $in: allRoomsOfType.map(room => room._id) },
        bookingStatus: { $nin: ['CANCELLED'] },
        $or: [
            { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } },
        ]
    };

    const conflictingBookings = await this.countDocuments(query);
    const availableCount = totalRoomsOfType - conflictingBookings;

    console.log(`Available count for room type ${roomType.nameKey}:`, {
        totalRoomsOfType,
        conflictingBookings,
        availableCount,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut)
    });

    return availableCount > 0 ? availableCount : 0;
};

// Method to check if a specific individual room is available
bookingSchema.statics.isIndividualRoomAvailable = async function(roomId, checkIn, checkOut, excludeBookingId = null) {
  const query = {
    roomId: roomId,
    bookingStatus: { $nin: ['CANCELLED'] },
    $or: [
      { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } }, // Overlaps
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const conflictingBookings = await this.countDocuments(query);
  const isAvailable = conflictingBookings === 0;
  
  console.log(`Individual room availability check for room ${roomId}:`, {
    roomId,
    checkIn: new Date(checkIn),
    checkOut: new Date(checkOut),
    conflictingBookings,
    isAvailable
  });
  
  return isAvailable;
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