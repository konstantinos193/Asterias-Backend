import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Booking, BookingSchema } from '../models/booking.model';
import { Room, RoomSchema } from '../models/room.model';
import { RoomBlockedDate, RoomBlockedDateSchema } from '../models/room-blocked-date.model';
import { SettingsModule } from '../settings/settings.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: RoomBlockedDate.name, schema: RoomBlockedDateSchema },
    ]),
    SettingsModule,
    PricingModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
