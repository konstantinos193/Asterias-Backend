import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SETTING_KEYS,
  SETTINGS_DEFAULTS,
  SETTINGS_MODEL_NAME,
  Settings,
} from '../models/settings.model';
import { dayStart, todayAtProperty } from '../availability/availability-rules';

export type { Settings } from '../models/settings.model';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private settingsCache: Settings | null = null;
  private lastCacheUpdate: number | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(@InjectModel(SETTINGS_MODEL_NAME) private settingsModel: Model<Settings>) {}

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
    // Read Mongo on each request so edits take effect across blue/green instances.
    return this.loadSettings();
  }

  /**
   * Settings with every field populated, falling back to the declared default.
   *
   * Callers that need to act on a setting want this rather than getSettings():
   * before the document exists getSettings() returns null, and a consumer
   * written as `if (settings?.bookingConfirmations)` then reads a default of
   * `true` as `false` and silently stops sending confirmation emails.
   */
  async getEffectiveSettings(): Promise<Required<Settings>> {
    const stored = await this.getSettings();
    return { ...SETTINGS_DEFAULTS, ...(stored ?? {}) };
  }

  /** One named setting, with its default applied. */
  async get<K extends keyof Settings>(key: K): Promise<Required<Settings>[K]> {
    const settings = await this.getEffectiveSettings();
    return settings[key];
  }

  async refreshSettingsCache(): Promise<Settings | null> {
    return await this.loadSettings();
  }

  /**
   * Whether a given kind of email may be sent.
   *
   * `emailNotifications` is the master switch; the per-kind flags narrow it.
   * The owner could previously turn email off in the admin panel and every
   * message kept going out, because nothing read these flags.
   */
  async isEmailEnabled(
    kind: 'bookingConfirmations' | 'reminderNotifications' | 'newBookingAlerts' | 'lowInventoryAlerts',
  ): Promise<boolean> {
    const settings = await this.getEffectiveSettings();
    return settings.emailNotifications !== false && settings[kind] !== false;
  }

  /**
   * Whether a stay may be booked at all, given the advance-booking window.
   *
   * Compared in whole days at the property, not against `new Date()`: a guest
   * booking at 00:30 local time on the day of arrival is booking for today, and
   * an hours-based comparison would have called that -1 days and refused it.
   */
  async validateBookingRules(
    checkIn: Date | string,
    checkOut: Date | string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const settings = await this.getEffectiveSettings();
    const errors: string[] = [];

    const today = dayStart(todayAtProperty());
    const arrival = new Date(checkIn);
    const departure = new Date(checkOut);
    if (!Number.isFinite(arrival.getTime()) || !Number.isFinite(departure.getTime())) {
      return { valid: false, errors: ['Invalid check-in or check-out date'] };
    }
    const checkInDate = dayStart(arrival.toISOString().slice(0, 10));
    const checkOutDate = dayStart(departure.toISOString().slice(0, 10));

    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
      return { valid: false, errors: ['Invalid check-in or check-out date'] };
    }

    const daysUntilCheckIn = Math.round(
      (checkInDate.getTime() - today.getTime()) / 86_400_000,
    );

    if (checkInDate < today) {
      errors.push('Check-in date cannot be in the past');
    } else if (daysUntilCheckIn < settings.minAdvanceBooking) {
      errors.push(
        settings.minAdvanceBooking === 1
          ? 'Same-day bookings are not accepted'
          : `Bookings must be made at least ${settings.minAdvanceBooking} days in advance`,
      );
    }

    if (daysUntilCheckIn > settings.maxAdvanceBooking) {
      errors.push(`Bookings cannot be made more than ${settings.maxAdvanceBooking} days ahead`);
    }

    if (checkOutDate <= checkInDate) {
      errors.push('Check-out date must be after check-in date');
    }

    return { valid: errors.length === 0, errors };
  }

  /** The last moment a guest may cancel this stay without charge. */
  async getCancellationDeadline(checkInDate: Date): Promise<Date | null> {
    const hours = await this.get('cancellationPolicy');
    if (!hours) return null;
    return new Date(new Date(checkInDate).getTime() - hours * 60 * 60 * 1000);
  }

  /** Whether this stay can still be cancelled under the current policy. */
  async isCancellableNow(checkInDate: Date, now: Date = new Date()): Promise<boolean> {
    const deadline = await this.getCancellationDeadline(checkInDate);
    if (!deadline) return true;
    return now.getTime() <= deadline.getTime();
  }

  async upsertSettings(data: Partial<Settings>): Promise<Settings> {
    try {
      const effective = { ...await this.getEffectiveSettings(), ...data };
      if (effective.minAdvanceBooking > effective.maxAdvanceBooking) {
        throw new BadRequestException('Minimum advance booking cannot exceed maximum advance booking');
      }
      // The allowlist is derived from the field declarations, so it cannot fall
      // out of step with the schema the way the hand-written list did.
      const filtered: Partial<Settings> = {};
      for (const key of SETTING_KEYS) {
        if (key in data) (filtered as any)[key] = (data as any)[key];
      }

      const updated = await this.settingsModel.findOneAndUpdate(
        {},
        { $set: filtered },
        { upsert: true, new: true, lean: true, runValidators: true }
      );
      this.settingsCache = updated as Settings;
      this.lastCacheUpdate = Date.now();
      return this.settingsCache;
    } catch (error) {
      this.logger.error('Error upserting settings:', error);
      throw error;
    }
  }
}
