import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingComWebhookController } from './bookingcom-webhook.controller';
import { BookingComWebhookService } from './bookingcom-webhook.service';
import { Room, RoomSchema } from '../models/room.model';
import { Booking, BookingSchema } from '../models/booking.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: Booking.name, schema: BookingSchema }
    ])
  ],
  controllers: [BookingComWebhookController],
  providers: [BookingComWebhookService],
  exports: [BookingComWebhookService]
})
export class BookingComWebhookModule {}
