import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Model } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Room, RoomDocument } from './room.model';

export type BookingDocument = Booking & Document & {
  totalGuests: number;
  nights: number;
};

// Interface for static methods
export interface BookingModel extends Model<BookingDocument> {
  isApartmentAvailable(roomTypeId: Types.ObjectId, checkIn: Date, checkOut: Date, excludeBookingId?: Types.ObjectId): Promise<boolean>;
  getAvailableApartmentCount(roomTypeId: Types.ObjectId, checkIn: Date, checkOut: Date): Promise<number>;
  isIndividualRoomAvailable(roomId: Types.ObjectId, checkIn: Date, checkOut: Date, excludeBookingId?: Types.ObjectId): Promise<boolean>;
  getStats(): Promise<any>;
  dropProblematicIndexes(): Promise<void>;
  emergencyFixCollection(): Promise<void>;
}

@Schema({ timestamps: true })
export class Booking {
  @ApiProperty()
  @Prop({ required: true, unique: true })
  bookingNumber: string;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  userId: Types.ObjectId;

  @ApiProperty()
  @Prop({
    type: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
      specialRequests: { type: String, default: '' },
      language: { type: String, enum: ['el', 'en', 'de'], default: 'en' }
    }
  })
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    specialRequests: string;
    language: 'el' | 'en' | 'de';
  };

  @ApiProperty()
  @Prop({ required: true })
  checkIn: Date;

  @ApiProperty()
  @Prop({ required: true })
  checkOut: Date;

  @ApiProperty()
  @Prop({ required: true, min: 1 })
  adults: number;

  @ApiProperty()
  @Prop({ default: 0, min: 0 })
  children: number;

  @ApiProperty()
  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @ApiProperty()
  @Prop({ enum: ['CARD', 'CASH'], required: true })
  paymentMethod: 'CARD' | 'CASH';

  @ApiProperty()
  @Prop({ enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING' })
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

  @ApiProperty()
  @Prop({ enum: ['CONFIRMED', 'PENDING', 'CANCELLED', 'CHECKED_IN', 'CHECKED_OUT'], default: 'CONFIRMED' })
  bookingStatus: 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT';

  @ApiProperty()
  @Prop({ default: null })
  stripePaymentIntentId: string;

  @ApiProperty()
  @Prop({ default: '' })
  notes: string;

  @ApiProperty()
  @Prop({ default: null })
  adminNotes: string;

  @ApiProperty()
  @Prop({ default: null })
  checkedInAt: Date;

  @ApiProperty()
  @Prop({ default: null })
  checkedOutAt: Date;

  @ApiProperty()
  @Prop({ default: null })
  bookingcom_booking_id: string;

  @ApiProperty()
  @Prop({ enum: ['asterias', 'bookingcom'], default: 'asterias' })
  source: 'asterias' | 'bookingcom';

  @ApiProperty()
  @Prop({ default: null })
  cancelledAt: Date;

  @ApiProperty()
  @Prop({ default: null })
  cancellationReason: string;

  @ApiProperty()
  @Prop({ default: null })
  refundAmount: number;

  @ApiProperty()
  @Prop({ default: null })
  refundedAt: Date;

  @ApiProperty()
  @Prop({ default: null })
  stripeRefundId: string;

  @ApiProperty()
  @Prop({ default: [] })
  history: Array<{
    date: Date;
    action: string;
    user: string;
  }>;

  @ApiProperty()
  @Prop({ default: false })
  reminderSent: boolean;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

// Index for better query performance
BookingSchema.index({ roomId: 1, checkIn: 1, checkOut: 1 });
BookingSchema.index({ userId: 1 });
BookingSchema.index({ paymentStatus: 1 });
BookingSchema.index({ bookingStatus: 1 });

// Method to drop problematic indexes
BookingSchema.statics.dropProblematicIndexes = async function() {
  try {
    const collection = this.collection;
    const indexes = await collection.indexes();
    
    console.log('🔍 Current database indexes:', indexes.map((idx: any) => ({
      name: idx.name,
      key: idx.key,
      unique: idx.unique,
      sparse: idx.sparse
    })));
    
    const problematicIndex = indexes.find((index: any) => 
      index.key && index.key.bookingcom_booking_id === 1 && index.unique === true
    );
    
    if (problematicIndex) {
      console.log('🚨 Found problematic unique index:', problematicIndex.name);
      try {
        await collection.dropIndex(problematicIndex.name);
        console.log('✅ Successfully dropped problematic index:', problematicIndex.name);
      } catch (dropError: any) {
        console.error('❌ Failed to drop index:', problematicIndex.name, dropError.message);
      }
    } else {
      console.log('✅ No problematic unique indexes found on bookingcom_booking_id');
    }
    
    const updatedIndexes = await collection.indexes();
    const stillProblematic = updatedIndexes.find((index: any) => 
      index.key && index.key.bookingcom_booking_id === 1 && index.unique === true
    );
    
    if (!stillProblematic) {
      console.log('✅ Confirmed: No more problematic indexes on bookingcom_booking_id');
    } else {
      console.log('⚠️ Warning: Problematic index still exists:', stillProblematic.name);
    }
    
  } catch (error: any) {
    console.error('❌ Error dropping indexes:', error.message);
  }
};

// Emergency method to recreate collection without problematic indexes
BookingSchema.statics.emergencyFixCollection = async function() {
  try {
    const collection = this.collection;
    const collectionName = collection.name;
    
    console.log('🚨 Emergency: Attempting to recreate collection without problematic indexes...');
    
    const allDocuments = await collection.find({}).toArray();
    console.log(`📊 Found ${allDocuments.length} documents to preserve`);
    
    await collection.drop();
    console.log('🗑️ Dropped problematic collection');
    
    if (allDocuments.length > 0) {
      const newCollection = collection.db.collection(collectionName);
      await newCollection.insertMany(allDocuments);
      console.log('✅ Recreated collection with documents');
    }
    
    console.log('✅ Emergency fix completed - collection recreated without problematic indexes');
    
  } catch (error: any) {
    console.error('❌ Emergency fix failed:', error.message);
    throw error;
  }
};

// Virtual for total guests
BookingSchema.virtual('totalGuests').get(function(this: BookingDocument) {
  return this.adults + this.children;
});

// Virtual for nights
BookingSchema.virtual('nights').get(function(this: BookingDocument) {
  const checkIn = new Date(this.checkIn);
  const checkOut = new Date(this.checkOut);
  const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Static methods
BookingSchema.statics.isApartmentAvailable = async function(roomTypeId: Types.ObjectId, checkIn: Date, checkOut: Date, excludeBookingId: Types.ObjectId = null) {
  // Get the Room model from mongoose
  const mongoose = require('mongoose');
  const Room = mongoose.model('Room');
  const roomType = await Room.findById(roomTypeId);
  if (!roomType) {
    throw new Error('Room type not found');
  }

  const query: any = {
    roomId: roomTypeId,
    bookingStatus: { $nin: ['CANCELLED'] },
    $or: [
      { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } },
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const conflictingBookings = await this.countDocuments(query);
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

BookingSchema.statics.getAvailableApartmentCount = async function(roomTypeId: Types.ObjectId, checkIn: Date, checkOut: Date) {
  // Get the Room model from mongoose
  const mongoose = require('mongoose');
  const Room = mongoose.model('Room');
  const roomType = await Room.findById(roomTypeId);
  if (!roomType) {
    return 0;
  }

  const allRoomsOfType = await Room.find({ nameKey: roomType.nameKey });
  const totalRoomsOfType = allRoomsOfType.length;
  
  if (totalRoomsOfType === 0) {
    return 0;
  }

  const query = {
    roomId: { $in: allRoomsOfType.map((room: any) => room._id) },
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

BookingSchema.statics.isIndividualRoomAvailable = async function(roomId: Types.ObjectId, checkIn: Date, checkOut: Date, excludeBookingId: Types.ObjectId = null) {
  const query: any = {
    roomId: roomId,
    bookingStatus: { $nin: ['CANCELLED'] },
    $or: [
      { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } },
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

BookingSchema.statics.getStats = async function() {
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
