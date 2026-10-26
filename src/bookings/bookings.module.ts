import { SettingsModule } from '../settings/settings.module';
import { PersistenceModule } from '../database/persistence.module';
import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { RoomCombinationService } from './room-combination.service';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { AvailabilityEngineModule } from '../availability/availability-engine.module';
import { PricingModule } from '../pricing/pricing.module';
import { BookingNumberModule } from '../common/booking-number/booking-number.module';

@Module({
  imports: [
    PersistenceModule,
    EmailModule,
    SettingsModule,
    AuthModule,
    AvailabilityEngineModule,
    PricingModule,
    BookingNumberModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, RoomCombinationService],
  exports: [BookingsService, RoomCombinationService],
})
export class BookingsModule {}
