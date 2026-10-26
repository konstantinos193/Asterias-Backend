import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry, Timeout } from '@nestjs/schedule';
import { EmailService } from '../email/email.service';
import { SettingsService } from '../settings/settings.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking } from '../models/booking.model';
import { Room } from '../models/room.model';
import { User, UserDocument } from '../models/user.model';
import { BOOKING_STATUS, GUEST_LANGUAGE } from '../common/enums';
import { addDays, dayStart, todayAtProperty } from '../availability/availability-rules';

/** A boolean field on Booking used to record that a one-off email went out. */
type EmailClaimFlag = 'postCheckoutEmailSent' | 'reminderSent';

@Injectable()
export class ScheduledTasksService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectModel(Booking.name) private bookingModel: Model<Booking>,
    @InjectModel(Room.name) private roomModel: Model<Room>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * There used to be a `tasksRunning` boolean, set by a `startTasks()` call
   * from main.ts, which every @Cron handler then checked as its first line.
   * That reimplemented what @nestjs/schedule already does — and it failed
   * silently: if the call in main.ts was reordered, or a test booted the module
   * directly, all five cron jobs returned immediately with no error and no log,
   * so nothing happened and nothing said so.
   *
   * SchedulerRegistry is the framework's own switch. Jobs run because they are
   * registered; stopping them is app.close(), which Nest calls on shutdown.
   */
  onModuleInit(): void {
    const jobs = Array.from(this.schedulerRegistry.getCronJobs().keys());
    this.logger.log(`Scheduled tasks registered: ${jobs.length ? jobs.join(', ') : 'none'}`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleArrivalReminders(): Promise<void> {
    await this.checkArrivalReminders();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handlePostCheckoutEmails(): Promise<void> {
    if (!(await this.settingsService.isEmailEnabled('reminderNotifications'))) {
      this.logger.log('Post-checkout emails are switched off in settings');
      return;
    }

    // Find bookings checked out 20-28 hours ago, email not sent yet
    const now = new Date();
    const from = new Date(now.getTime() - 28 * 60 * 60 * 1000);
    const to   = new Date(now.getTime() - 20 * 60 * 60 * 1000);

    // Requiring CHECKED_OUT meant this never fired: the status only changes
    // when someone presses check-out in the admin, which nobody does, so a
    // booking sits at CONFIRMED and the guest is never asked for a review.
    // The checkOut date passing is the real signal — only a cancellation
    // should stop it.
    const bookings = await this.bookingModel
      .find({
        bookingStatus: {
          $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.CHECKED_OUT],
        },
        postCheckoutEmailSent: { $ne: true },
        checkOut: { $gte: from, $lte: to },
        // A walk-in written down without an address has nobody to thank.
        'guestInfo.email': { $nin: [null, ''] },
      })
      .populate('roomId', 'name')
      .exec();

    this.logger.log(`Found ${bookings.length} bookings for post-checkout email`);

    for (const booking of bookings) {
      const bookingId = (booking as any)._id as Types.ObjectId;

      // Claim before sending, not after. See claimEmail().
      const claim = await this.claimEmail(bookingId, 'postCheckoutEmailSent');
      if (!claim) continue;

      try {
        const result = await this.emailService.sendCheckoutThankYou({
          guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName}`,
          guestEmail: booking.guestInfo.email,
          roomName: (booking as any).roomId?.name ?? '',
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          language: booking.guestInfo.language ?? GUEST_LANGUAGE.EL,
        });

        // EmailService returns failures as values rather than throwing, so this
        // `await` resolves on failure too. The flag used to be set
        // unconditionally right here, which marked the review request as sent
        // when nothing had been sent and the guest was never asked again.
        if (result?.success && !result.simulated) {
          await this.completeEmailClaim(bookingId, 'postCheckoutEmailSent', claim);
          this.logger.log(`Post-checkout email sent to ${booking.guestInfo.email}`);
        } else {
          await this.releaseEmailClaim(bookingId, 'postCheckoutEmailSent', claim);
          this.logger.warn(
            `Post-checkout email failed for ${bookingId}, will retry: ${result?.error ?? 'unknown error'}`,
          );
        }
      } catch (err) {
        await this.releaseEmailClaim(bookingId, 'postCheckoutEmailSent', claim);
        this.logger.error(
          `Failed post-checkout email for ${bookingId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  /** Expiring, token-owned claims survive crashes without marking unsent mail sent.
   * SMTP is at-least-once: a crash after delivery but before acknowledgement may
   * retry a message. Exactly-once delivery requires provider idempotency.
   */
  private async claimEmail(bookingId: Types.ObjectId, flag: EmailClaimFlag): Promise<string | null> {
    const token = randomUUID();
    const key = 'emailClaims.' + flag;
    const result = await this.bookingModel.updateOne(
      { _id: bookingId, [flag]: { $ne: true }, $or: [
        { [key + '.at']: { $exists: false } },
        { [key + '.at']: { $lt: new Date(Date.now() - 10 * 60_000) } },
      ] },
      { $set: { [key]: { token, at: new Date() } } },
    );
    return result.modifiedCount === 1 ? token : null;
  }

  private async completeEmailClaim(bookingId: Types.ObjectId, flag: EmailClaimFlag, token: string): Promise<void> {
    const key = 'emailClaims.' + flag;
    await this.bookingModel.updateOne(
      { _id: bookingId, [key + '.token']: token },
      { $set: { [flag]: true }, $unset: { [key]: 1 } },
    );
  }

  private async releaseEmailClaim(bookingId: Types.ObjectId, flag: EmailClaimFlag, token: string): Promise<void> {
    const key = 'emailClaims.' + flag;
    await this.bookingModel.updateOne(
      { _id: bookingId, [key + '.token']: token },
      { $unset: { [key]: 1 } },
    );
  }

  @Cron('0 9,18 * * *') // 9 AM and 6 PM daily
  async handleInventoryChecks(): Promise<void> {
    await this.checkUpcomingInventory();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyCleanup(): Promise<void> {
    this.logger.log('Running daily cleanup tasks');

    try {
      await this.cleanupNotificationFlags();
      this.logger.log('Daily cleanup completed');
    } catch (error) {
      this.logger.error(`Daily cleanup failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleSystemHealthCheck(): Promise<void> {
    try {
      // Check system health
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      
      if (heapUsedMB > 500) {
        this.logger.warn(`High memory usage: ${heapUsedMB.toFixed(2)}MB`);
      }

      // Log system status
      this.logger.debug(`System health - memory: ${heapUsedMB.toFixed(2)}MB`);
    } catch (error) {
      this.logger.error('❌ System health check failed:', error);
    }
  }

  @Timeout(30000) // 30 seconds after startup
  async handleInitialChecks(): Promise<void> {
    this.logger.log('🔄 Running initial notification checks...');
    await this.checkArrivalReminders();
    await this.checkUpcomingInventory();
  }

  private async checkArrivalReminders(): Promise<void> {
    try {
      const settings = await this.settingsService.getEffectiveSettings();
      if (!(await this.settingsService.isEmailEnabled('reminderNotifications'))) {
        this.logger.log('Arrival reminders are switched off in settings');
        return;
      }

      // `reminderHours` from settings, instead of a hardcoded 24. The owner
      // could set this in the admin panel and nothing read it.
      const reminderHours = settings.reminderHours;

      // Day window at the property. This used to be
      // `new Date(reminderTime.toDateString())`, which parses a localised
      // string like "Sat Jul 04 2026" in local time, while checkIn is stored at
      // UTC midnight — so the window was offset by the container's zone and
      // silently depended on TZ being unset.
      const targetDay = dayStart(
        addDays(todayAtProperty(), Math.max(1, Math.round(reminderHours / 24))),
      );
      const dayAfter = new Date(targetDay.getTime() + 24 * 60 * 60 * 1000);

      const bookings = await this.bookingModel.find({
        checkIn: { $gte: targetDay, $lt: dayAfter },
        bookingStatus: BOOKING_STATUS.CONFIRMED,
        reminderSent: { $ne: true },
        // Same as the post-checkout mail: no address, no reminder.
        'guestInfo.email': { $nin: [null, ''] },
      }).lean();

      this.logger.log(`Found ${bookings.length} bookings needing reminders`);

      // Load all needed rooms in one query instead of one per booking
      const roomIds = [...new Set(bookings.map(b => b.roomId?.toString()).filter(Boolean))];
      const rooms = await this.roomModel.find({ _id: { $in: roomIds } }).lean();
      const roomMap = new Map(rooms.map(r => [r._id.toString(), r]));

      const BATCH_SIZE = 5;

      for (let i = 0; i < bookings.length; i += BATCH_SIZE) {
        const batch = bookings.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (booking) => {
            const room = roomMap.get(booking.roomId?.toString());
            if (!room) return;

            const bookingId = booking._id as Types.ObjectId;
            // Claimed before sending — the batch read above is shared by every
            // live container, so without this each of them sends.
            const claim = await this.claimEmail(bookingId, 'reminderSent');
            if (!claim) return;

            try {
              const result = await this.emailService.sendBookingConfirmation({
                bookingId: booking.bookingNumber,
                guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName}`,
                guestEmail: booking.guestInfo.email,
                roomName: room.name,
                checkIn: booking.checkIn,
                // From settings, instead of a hardcoded '15:00' in three files.
                checkInTime: settings.checkInTime,
                totalPrice: booking.totalAmount,
                language: booking.guestInfo.language,
              }, { language: booking.guestInfo.language });

              if (result?.success && !result.simulated) {
                await this.completeEmailClaim(bookingId, 'reminderSent', claim);
                this.logger.log(`Reminder sent for booking ${bookingId}`);
              } else {
                await this.releaseEmailClaim(bookingId, 'reminderSent', claim);
                this.logger.warn(
                  `Reminder failed for booking ${bookingId}, will retry: ${result?.error ?? 'unknown error'}`,
                );
              }
            } catch (error) {
              await this.releaseEmailClaim(bookingId, 'reminderSent', claim);
              throw error;
            }
          }),
        );

        for (const r of results) {
          if (r.status === 'rejected') {
            this.logger.error(
              `Error sending reminder: ${r.reason instanceof Error ? r.reason.message : r.reason}`,
            );
          }
        }

        // Delay between batches only, not between every single email
        if (i + BATCH_SIZE < bookings.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      this.logger.error(
        `Error checking arrival reminders: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async checkUpcomingInventory(): Promise<void> {
    try {
      this.logger.log('Checking upcoming inventory levels');
      
      // Check next 7 days
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() + i);
        
        await this.checkLowInventory(checkDate);
        
        // Small delay between checks
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      this.logger.error('Error checking upcoming inventory:', error);
    }
  }

  private async cleanupNotificationFlags(): Promise<void> {
    try {
      this.logger.log('Cleaning up old notification flags');

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const [bookingResult, tokenResult] = await Promise.all([
        // Remove reminderSent flag from past bookings
        this.bookingModel.updateMany(
          { checkOut: { $lt: pastDate }, reminderSent: true },
          { $unset: { reminderSent: 1 } },
        ),
        // Null out expired password reset tokens
        this.userModel.updateMany(
          { resetPasswordExpires: { $lt: new Date() }, resetPasswordToken: { $ne: null } },
          { $set: { resetPasswordToken: null, resetPasswordExpires: null } },
        ),
      ]);

      this.logger.log(`Cleaned up ${bookingResult.modifiedCount} old notification flags`);
      this.logger.log(`Cleared ${tokenResult.modifiedCount} expired password reset tokens`);

    } catch (error) {
      this.logger.error('Error cleaning up notification flags:', error);
    }
  }

  private async checkLowInventory(date: Date): Promise<void> {
    try {
      const checkDate = new Date(date);

      // Two queries instead of 1 + N: count total rooms and get booked roomIds for the date
      const [totalRooms, bookedRoomIds] = await Promise.all([
        this.roomModel.countDocuments(),
        this.bookingModel.distinct('roomId', {
          checkIn: { $lte: checkDate },
          checkOut: { $gt: checkDate },
          bookingStatus: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN] },
        }),
      ]);

      const totalAvailable = totalRooms - bookedRoomIds.length;
      const availabilityPercentage = totalRooms > 0 ? (totalAvailable / totalRooms) * 100 : 100;

      if (availabilityPercentage <= 20) {
        await this.sendLowInventoryAlert([], {
          date: date.toISOString(),
          totalAvailable,
          totalRooms,
        });
      }

    } catch (error) {
      this.logger.error('Error checking low inventory:', error);
    }
  }

  private async sendLowInventoryAlert(_inventoryData: any[], options: any): Promise<void> {
    try {
      // `lowInventoryAlerts` from settings. The owner could switch this off and
      // the alerts kept arriving, because nothing read the flag.
      if (!(await this.settingsService.isEmailEnabled('lowInventoryAlerts'))) return;

      const alertData = {
        bookingId: 'INVENTORY_ALERT',
        guestName: 'Admin',
        roomName: `${options.totalAvailable}/${options.totalRooms} rooms available`,
        totalPrice: 0,
        checkIn: options.date
      };

      await this.emailService.sendNewBookingAlert(alertData);
      this.logger.log(`📧 Low inventory alert sent for ${options.date}`);
    } catch (error) {
      this.logger.error('Error sending low inventory alert:', error);
    }
  }

  // Manual task execution for testing
  async runTaskManually(taskName: string): Promise<void> {
    this.logger.log(`Manually running task: ${taskName}`);
    
    switch (taskName) {
      case 'daily-cleanup':
        await this.handleDailyCleanup();
        break;
      case 'hourly-tasks':
        await this.handleArrivalReminders();
        break;
      case 'inventory-check':
        await this.checkUpcomingInventory();
        break;
      case 'health-check':
        await this.handleSystemHealthCheck();
        break;
      default:
        this.logger.warn(`Unknown task: ${taskName}`);
    }
  }

  // Get all registered jobs
  getRegisteredJobs(): string[] {
    const jobs = this.schedulerRegistry.getCronJobs();
    return Array.from(jobs.keys());
  }

  /**
   * Whether the scheduler has jobs registered. isRunning() used to report a
   * hand-maintained boolean, which could say running while the framework
   * held no jobs, and vice versa.
   */
  isRunning(): boolean {
    return this.schedulerRegistry.getCronJobs().size > 0;
  }

  // Manual trigger functions (useful for testing)
  async triggerReminderCheck(): Promise<void> {
    this.logger.log('Manual trigger: checking reminders');
    await this.checkArrivalReminders();
  }

  async triggerInventoryCheck(): Promise<void> {
    this.logger.log('Manual trigger: checking inventory');
    await this.checkUpcomingInventory();
  }
}