import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PricingService } from './pricing.service';
import { Room, RoomSchema } from '../models/room.model';
import { SeasonalPricing, SeasonalPricingSchema } from '../models/seasonal-pricing.model';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: SeasonalPricing.name, schema: SeasonalPricingSchema },
    ]),
    SettingsModule,
  ],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
