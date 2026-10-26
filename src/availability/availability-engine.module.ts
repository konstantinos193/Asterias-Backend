import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AvailabilityEngine } from './availability-engine';
import { Room, RoomSchema } from '../models/room.model';
import { Booking, BookingSchema } from '../models/booking.model';
import { RoomBlockedDate, RoomBlockedDateSchema } from '../models/room-blocked-date.model';

/**
 * Standalone on purpose: it depends on nothing but the models, so every module
 * that needs to know what is for sale can import it without a cycle.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: RoomBlockedDate.name, schema: RoomBlockedDateSchema },
    ]),
  ],
  providers: [AvailabilityEngine],
  exports: [AvailabilityEngine],
})
export class AvailabilityEngineModule {}
