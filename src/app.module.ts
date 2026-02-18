import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './admin/admin.module';
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

// Common modules
import { DatabaseModule } from './database/database.module';

// Utils
import { MemoryMonitorService } from './utils/memory-monitor.service';

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
    MongooseModule.forRoot(process.env.MONGODB_URI),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    RoomsModule,
    HealthModule,
    AdminModule,
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
  ],
  controllers: [],
  providers: [MemoryMonitorService],
})
export class AppModule {}
