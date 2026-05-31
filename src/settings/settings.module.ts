import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema } from 'mongoose';

const SettingsSchema = new Schema({
  maintenanceMode: { type: Boolean, default: false },
  emailNotifications: { type: Boolean, default: true },
  bookingConfirmations: { type: Boolean, default: true },
  reminderNotifications: { type: Boolean, default: true },
  newBookingAlerts: { type: Boolean, default: true },
  lowInventoryAlerts: { type: Boolean, default: true },
  reminderHours: { type: Number, default: 24 },
  checkInTime: { type: String, default: '15:00' },
  checkOutTime: { type: String, default: '11:00' },
  minAdvanceBooking: { type: Number, default: 1 },
  maxAdvanceBooking: { type: Number, default: 365 },
  cancellationPolicy: { type: Number, default: 48 },
  overbookingAllowed: { type: Boolean, default: false },
  currency: { type: String, default: 'EUR' },
  taxRate: { type: Number, default: 13 },
  municipalFee: { type: Number, default: 0.50 },
  environmentalTax: { type: Number, default: 2.00 },
  automaticPricing: { type: Boolean, default: false },
  directBookingDiscount: { type: Number, default: 5 },
}, { timestamps: true });

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Settings', schema: SettingsSchema }])],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
