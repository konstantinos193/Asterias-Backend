import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Room, RoomSchema } from '../models/room.model';
import { Booking, BookingSchema } from '../models/booking.model';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Room.name, schema: RoomSchema },
    { name: Booking.name, schema: BookingSchema },
  ])],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
