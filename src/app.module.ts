import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './admin/admin.module';
import { AdminCalendarModule } from './admin-calendar/admin-calendar.module';
import { BookingsModule } from './bookings/bookings.module';
import { ImagesModule } from './images/images.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { PaymentsModule } from './payments/payments.module';
import { AvailabilityModule } from './availability/availability.module';
import { PdfModule } from './pdf/pdf.module';
import { EmailModule } from './email/email.module';
import { ScheduledTasksModule } from './scheduled-tasks/scheduled-tasks.module';
import { SettingsModule } from './settings/settings.module';
import { OffersModule } from './offers/offers.module';
import { ContactModule } from './contact/contact.module';
import { KeepAliveModule } from './keep-alive/keep-alive.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UsersModule } from './users/users.module';
import { BookingComWebhookModule } from './bookingcom-webhook/bookingcom-webhook.module';

// Common modules
import { DatabaseModule } from './database/database.module';

// Utils
import { MemoryMonitorService } from './utils/memory-monitor.service';
import { KeepAliveService } from './keep-alive/keep-alive.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    DatabaseModule,

    // Core modules
    MongooseModule.forRoot(process.env.MONGODB_URI, {
      maxPoolSize: 20,
      minPoolSize: 5,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    }),
    // Named tiers so sensitive routes can ask for a tighter budget with
    // @Throttle({ strict: ... }). Note that registering this module enforced
    // nothing on its own — see the APP_GUARD binding below.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: 100,
      },
      {
        name: 'strict',
        ttl: 900000, // 15 minutes
        limit: 200,
      },
    ]),
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    RoomsModule,
    HealthModule,
    AdminModule,
    AdminCalendarModule,
    BookingsModule,
    ImagesModule,
    CloudinaryModule,
    PaymentsModule,
    AvailabilityModule,
    PdfModule,
    EmailModule,
    ScheduledTasksModule,
    SettingsModule,
    OffersModule,
    ContactModule,
    KeepAliveModule,
    ReviewsModule,
    UsersModule,
    BookingComWebhookModule,
  ],
  controllers: [],
  providers: [
    // ThrottlerModule above only *configures* rate limiting. Without this
    // binding no throttler guard ever ran, so every limit — including the
    // @Throttle on login and register — was decoration, and the login
    // endpoint accepted unlimited password guesses.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    MemoryMonitorService,
    KeepAliveService,
  ],
})
export class AppModule {}
