import { PersistenceModule } from '../../database/persistence.module';
import { Module } from '@nestjs/common';
import { BookingNumberService } from './booking-number.service';

/**
 * Imported by every module that creates a booking — payments, bookings and
 * admin-calendar — so all of them issue numbers from the same sequence.
 */
@Module({
  imports: [PersistenceModule],
  providers: [BookingNumberService],
  exports: [BookingNumberService],
})
export class BookingNumberModule {}
