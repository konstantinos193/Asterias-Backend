import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { PricingModule } from '../pricing/pricing.module';
import { RoomsModule } from '../rooms/rooms.module';
import { Booking, BookingSchema } from '../models/booking.model';
import { Room, RoomSchema } from '../models/room.model';
import { RoomBlockedDate, RoomBlockedDateSchema } from '../models/room-blocked-date.model';
import { SeasonalPricing, SeasonalPricingSchema } from '../models/seasonal-pricing.model';
import { AdminCalendarController } from './admin-calendar.controller';
import { CalendarBookingsRepository } from './repositories/calendar-bookings.repository';
import { CalendarClosuresRepository } from './repositories/calendar-closures.repository';
import { CalendarRatesRepository } from './repositories/calendar-rates.repository';
import { CalendarRoomsRepository } from './repositories/calendar-rooms.repository';
import { CalendarGridService } from './services/calendar-grid.service';
import { CalendarReservationsService } from './services/calendar-reservations.service';
import { CalendarClosuresService } from './services/calendar-closures.service';
import { CalendarRatesService } from './services/calendar-rates.service';
import { CalendarRoomsService } from './services/calendar-rooms.service';

/** Everything the admin calendar reads and writes, in one feature. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Room.name, schema: RoomSchema },
      { name: RoomBlockedDate.name, schema: RoomBlockedDateSchema },
      { name: SeasonalPricing.name, schema: SeasonalPricingSchema },
    ]),
    AuthModule,
    PricingModule,
    RoomsModule,
  ],
  controllers: [AdminCalendarController],
  providers: [
    CalendarBookingsRepository,
    CalendarClosuresRepository,
    CalendarRatesRepository,
    CalendarRoomsRepository,
    CalendarGridService,
    CalendarReservationsService,
    CalendarClosuresService,
    CalendarRatesService,
    CalendarRoomsService,
  ],
})
export class AdminCalendarModule {}
