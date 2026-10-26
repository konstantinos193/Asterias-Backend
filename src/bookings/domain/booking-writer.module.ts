import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../database/persistence.module';
import { AvailabilityEngineModule } from '../../availability/availability-engine.module';
import { PricingModule } from '../../pricing/pricing.module';
import { BookingNumberModule } from '../../common/booking-number/booking-number.module';
import { BookingWriter } from './booking-writer.service';
@Module({ imports: [PersistenceModule, AvailabilityEngineModule, PricingModule, BookingNumberModule],
  providers: [BookingWriter], exports: [BookingWriter] })
export class BookingWriterModule {}
