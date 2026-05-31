import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { Room, RoomSchema } from '../models/room.model';
import { Booking, BookingSchema } from '../models/booking.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: Booking.name, schema: BookingSchema }
    ])
  ],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService]
})
export class AvailabilityModule {}
