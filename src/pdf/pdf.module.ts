import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { Booking, BookingSchema } from '../models/booking.model';
import { Room, RoomSchema } from '../models/room.model';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Room.name, schema: RoomSchema },
    ]),
    AuthModule,
  ],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
