import { BookingWriterModule } from '../bookings/domain/booking-writer.module';
import { PersistenceModule } from '../database/persistence.module';
import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SettingsModule } from '../settings/settings.module';
import { PricingModule } from '../pricing/pricing.module';
import { AuthModule } from '../auth/auth.module';
import { AvailabilityEngineModule } from '../availability/availability-engine.module';
import { BookingNumberModule } from '../common/booking-number/booking-number.module';

@Module({
  imports: [
    PersistenceModule,
    BookingWriterModule,
    SettingsModule,
    PricingModule,
    AuthModule,
    AvailabilityEngineModule,
    BookingNumberModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
