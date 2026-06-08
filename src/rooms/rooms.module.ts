import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Room, RoomSchema } from '../models/room.model';
import { RoomBlockedDate, RoomBlockedDateSchema } from '../models/room-blocked-date.model';
import { Booking, BookingSchema } from '../models/booking.model';
import { ChannelConfig, ChannelConfigSchema } from '../models/channel-config.model';
import { Offer, OfferSchema } from '../models/offer.model';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: RoomBlockedDate.name, schema: RoomBlockedDateSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: ChannelConfig.name, schema: ChannelConfigSchema },
      { name: Offer.name, schema: OfferSchema },
    ]),
    PricingModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
