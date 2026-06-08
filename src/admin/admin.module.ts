import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { OffersModule } from '../offers/offers.module';
import { SettingsModule } from '../settings/settings.module';
import { Booking, BookingSchema } from '../models/booking.model';
import { Room, RoomSchema } from '../models/room.model';
import { RoomBlockedDate, RoomBlockedDateSchema } from '../models/room-blocked-date.model';
import { Contact, ContactSchema } from '../models/contact.model';
import { User, UserSchema } from '../models/user.model';
import { SeasonalPricing, SeasonalPricingSchema } from '../models/seasonal-pricing.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Room.name, schema: RoomSchema },
      { name: RoomBlockedDate.name, schema: RoomBlockedDateSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: User.name, schema: UserSchema },
      { name: SeasonalPricing.name, schema: SeasonalPricingSchema },
    ]),
    AuthModule,
    OffersModule,
    SettingsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
