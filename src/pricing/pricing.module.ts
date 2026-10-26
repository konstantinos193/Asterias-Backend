import { PersistenceModule } from '../database/persistence.module';
import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    PersistenceModule,
    SettingsModule,
  ],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
