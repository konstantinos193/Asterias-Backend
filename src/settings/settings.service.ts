import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

export interface Settings {
  maintenanceMode?: boolean;
  emailNotifications?: boolean;
  bookingConfirmations?: boolean;
  reminderNotifications?: boolean;
  newBookingAlerts?: boolean;
  lowInventoryAlerts?: boolean;
  reminderHours?: number;
  checkInTime?: string;
  checkOutTime?: string;
  minAdvanceBooking?: number;
  maxAdvanceBooking?: number;
  cancellationPolicy?: number;
  overbookingAllowed?: boolean;
  currency?: string;
  taxRate?: number;
  automaticPricing?: boolean;
  directBookingDiscount?: number;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private settingsCache: Settings | null = null;
  private lastCacheUpdate: number | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(@InjectModel('Settings') private settingsModel: Model<Settings>) {}

  async loadSettings(): Promise<Settings | null> {
    try {
      const settings = await this.settingsModel.findOne().lean();
      this.settingsCache = settings;
      this.lastCacheUpdate = Date.now();
      return this.settingsCache;
    } catch (error) {
      this.logger.error('Error loading settings:', error);
      return null;
    }
  }

  async getSettings(): Promise<Settings | null> {
    if (!this.settingsCache || !this.lastCacheUpdate || Date.now() - this.lastCacheUpdate > this.CACHE_DURATION) {
      await this.loadSettings();
    }
    return this.settingsCache;
  }

  async refreshSettingsCache(): Promise<Settings | null> {
    return await this.loadSettings();
  }

  async validateBookingRules(checkIn: Date, checkOut: Date): Promise<{ valid: boolean; errors: string[] }> {
    const settings = await this.getSettings();
    if (!settings) return { valid: true, errors: [] };

    const errors: string[] = [];
    const now = new Date();
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Check minimum advance booking
    if (settings.minAdvanceBooking) {
      const daysUntilCheckIn = Math.ceil((checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilCheckIn < settings.minAdvanceBooking) {
        errors.push(`Minimum advance booking is ${settings.minAdvanceBooking} days`);
      }
    }

    // Check maximum advance booking
    if (settings.maxAdvanceBooking) {
      const daysUntilCheckIn = Math.ceil((checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilCheckIn > settings.maxAdvanceBooking) {
        errors.push(`Maximum advance booking is ${settings.maxAdvanceBooking} days`);
      }
    }

    // Check if dates are in the past
    if (checkInDate < now) {
      errors.push('Check-in date cannot be in the past');
    }

    if (checkOutDate <= checkInDate) {
      errors.push('Check-out date must be after check-in date');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async getCancellationDeadline(checkInDate: Date): Promise<Date | null> {
    const settings = await this.getSettings();
    if (!settings || !settings.cancellationPolicy) return null;

    const checkIn = new Date(checkInDate);
    const deadline = new Date(checkIn.getTime() - (settings.cancellationPolicy * 60 * 60 * 1000));
    return deadline;
  }
}
