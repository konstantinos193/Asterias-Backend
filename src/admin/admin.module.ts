import { AdminReportingService } from './admin-reporting.service';
import { PersistenceModule } from '../database/persistence.module';
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { OffersModule } from '../offers/offers.module';
import { SettingsModule } from '../settings/settings.module';
// Gives AdminService access to RoomsService.clearRoomsCache(), so a room edit
// made through the admin panel invalidates the public /api/rooms list cache.
import { RoomsModule } from '../rooms/rooms.module';
import { PricingModule } from '../pricing/pricing.module';
import { AvailabilityEngineModule } from '../availability/availability-engine.module';

@Module({
  imports: [
    PersistenceModule,
    AuthModule,
    OffersModule,
    SettingsModule,
    RoomsModule,
    PricingModule,
    AvailabilityEngineModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminReportingService],
  exports: [AdminService],
})
export class AdminModule {}
