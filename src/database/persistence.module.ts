import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingHistory, BookingHistorySchema } from '../models/booking-history.model';
import { Booking, BookingSchema } from '../models/booking.model';
import { Contact, ContactSchema } from '../models/contact.model';
import { Counter, CounterSchema } from '../models/counter.model';
import { Offer, OfferSchema } from '../models/offer.model';
import { Review, ReviewSchema } from '../models/review.model';
import { RoomBlockedDate, RoomBlockedDateSchema } from '../models/room-blocked-date.model';
import { Room, RoomSchema } from '../models/room.model';
import { SeasonalPricing, SeasonalPricingSchema } from '../models/seasonal-pricing.model';
import { SETTINGS_MODEL_NAME, SettingsSchema } from '../models/settings.model';
import { User, UserSchema } from '../models/user.model';

/** Register each schema once; feature modules import this boundary. */
@Module({
  imports: [MongooseModule.forFeature([
    { name: Booking.name, schema: BookingSchema },
    { name: Room.name, schema: RoomSchema },
    { name: RoomBlockedDate.name, schema: RoomBlockedDateSchema },
    { name: Contact.name, schema: ContactSchema },
    { name: User.name, schema: UserSchema },
    { name: SeasonalPricing.name, schema: SeasonalPricingSchema },
    { name: BookingHistory.name, schema: BookingHistorySchema },
    { name: Counter.name, schema: CounterSchema },
    { name: Offer.name, schema: OfferSchema },
    { name: Review.name, schema: ReviewSchema },
    { name: SETTINGS_MODEL_NAME, schema: SettingsSchema },
  ])],
  exports: [MongooseModule],
})
export class PersistenceModule {}
