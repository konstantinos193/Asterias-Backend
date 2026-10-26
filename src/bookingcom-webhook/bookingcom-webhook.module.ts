import { PersistenceModule } from '../database/persistence.module';
import { Module } from '@nestjs/common';
import { BookingComWebhookController } from './bookingcom-webhook.controller';
import { BookingComWebhookService } from './bookingcom-webhook.service';
import { BookingNumberModule } from '../common/booking-number/booking-number.module';

@Module({
  imports: [
    PersistenceModule,
    BookingNumberModule,
  ],
  controllers: [BookingComWebhookController],
  providers: [BookingComWebhookService],
  exports: [BookingComWebhookService]
})
export class BookingComWebhookModule {}
