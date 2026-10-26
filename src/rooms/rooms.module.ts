import { PersistenceModule } from '../database/persistence.module';
import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { PricingModule } from '../pricing/pricing.module';
import { AuthModule } from '../auth/auth.module';
import { AvailabilityEngineModule } from '../availability/availability-engine.module';

@Module({
  imports: [
    PersistenceModule,
    PricingModule,
    AuthModule,
    AvailabilityEngineModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
