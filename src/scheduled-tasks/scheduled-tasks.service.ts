import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry, Timeout } from '@nestjs/schedule';
import { EmailService } from '../email/email.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking } from '../models/booking.model';
import { Room } from '../models/room.model';

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);
  private tasksRunning = false;

  constructor(
    private readonly emailService: EmailService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectModel(Booking.name) private bookingModel: Model<Booking>,
    @InjectModel(Room.name) private roomModel: Model<Room>,
  ) {}

  startTasks(): void {
    if (this.tasksRunning) {
      this.logger.warn('Scheduled tasks are already running');
      return;
    }

    this.tasksRunning = true;
    this.logger.log('🚀 Starting scheduled notification tasks...');
    this.logger.log('✅ Scheduled tasks initialized:');
    this.logger.log('  - Arrival reminders: Every hour');
    this.logger.log('  - Inventory checks: 9 AM & 6 PM daily');
    this.logger.log('  - Cleanup: Midnight daily');
  }

  stopTasks(): void {
    if (!this.tasksRunning) {
      this.logger.warn('Scheduled tasks are not running');
      return;
    }

    this.tasksRunning = false;
    this.logger.log('🛑 Stopping scheduled tasks...');
    this.logger.log('✅ All scheduled tasks stopped');
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleArrivalReminders(): Promise<void> {
    if (!this.tasksRunning) return;
    
    this.logger.log('⏰ Running hourly reminder check...');
    await this.checkArrivalReminders();
  }

  @Cron('0 9,18 * * *') // 9 AM and 6 PM daily
  async handleInventoryChecks(): Promise<void> {
    if (!this.tasksRunning) return;
    
    this.logger.log('⏰ Running inventory check...');
    await this.checkUpcomingInventory();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyCleanup(): Promise<void> {
    if (!this.tasksRunning) return;

    this.logger.log('🧹 Running daily cleanup tasks...');
    
    try {
      await this.cleanupNotificationFlags();
      this.logger.log('✅ Daily cleanup completed');
    } catch (error) {
      this.logger.error('❌ Daily cleanup failed:', error);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleSystemHealthCheck(): Promise<void> {
    if (!this.tasksRunning) return;

    try {
      // Check system health
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      
      if (heapUsedMB > 500) {
        this.logger.warn(`⚠️ High memory usage: ${heapUsedMB.toFixed(2)}MB`);
      }

      // Log system status
      this.logger.debug(`🔍 System health - Memory: ${heapUsedMB.toFixed(2)}MB`);
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
      this.logger.log('🔔 Checking for arrival reminders...');
      
      const now = new Date();
      const reminderTime = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours from now
      
      // Find bookings that need reminders
      const bookings = await this.bookingModel.find({
        checkIn: {
          $gte: new Date(reminderTime.toDateString()),
          $lt: new Date(new Date(reminderTime.toDateString()).getTime() + 24 * 60 * 60 * 1000)
        },
        bookingStatus: 'CONFIRMED',
        reminderSent: { $ne: true }
      });

      this.logger.log(`Found ${bookings.length} bookings needing reminders`);

      for (const booking of bookings) {
        try {
          // Get room details
          const room = await this.roomModel.findById(booking.roomId);
          if (!room) continue;

          // Send reminder with customer's language
          const result = await this.emailService.sendBookingConfirmation({
            bookingId: booking.bookingNumber,
            guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName}`,
            guestEmail: booking.guestInfo.email,
            roomName: room.name,
            checkIn: booking.checkIn,
            checkInTime: '15:00',
            totalPrice: booking.totalAmount,
            language: booking.guestInfo.language
          }, { language: booking.guestInfo.language });
          
          if (result && result.success) {
            // Mark reminder as sent
            booking.reminderSent = true;
            await booking.save();
            
            this.logger.log(`✅ Reminder sent for booking ${booking._id}`);
          } else {
            this.logger.log(`❌ Failed to send reminder for booking ${booking._id}`);
          }

        } catch (error) {
          this.logger.error(`Error sending reminder for booking ${booking._id}:`, error);
        }

        // Small delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      this.logger.error('Error checking arrival reminders:', error);
    }
  }

  private async checkUpcomingInventory(): Promise<void> {
    try {
      this.logger.log('📊 Checking upcoming inventory levels...');
      
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
      this.logger.log('🧹 Cleaning up old notification flags...');
      
      // Remove reminderSent flag from bookings that are in the past
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const result = await this.bookingModel.updateMany(
        { 
          checkOut: { $lt: pastDate },
          reminderSent: true 
        },
        { 
          $unset: { reminderSent: 1 } 
        }
      );
      
      this.logger.log(`Cleaned up ${result.modifiedCount} old notification flags`);

    } catch (error) {
      this.logger.error('Error cleaning up notification flags:', error);
    }
  }

  private async checkLowInventory(date: Date): Promise<void> {
    try {
      const rooms = await this.roomModel.find();
      const checkDate = new Date(date);
      
      // Check availability for each room
      const roomsData = await Promise.all(rooms.map(async (room) => {
        const bookings = await this.bookingModel.find({
          roomId: room._id,
          checkIn: { $lte: checkDate },
          checkOut: { $gt: checkDate },
          bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] }
        });
        
        return {
          name: room.name,
          total: 1,
          available: bookings.length === 0 ? 1 : 0
        };
      }));
      
      // Check if inventory is low (less than 20% available)
      const totalAvailable = roomsData.reduce((sum, room) => sum + room.available, 0);
      const totalRooms = roomsData.length;
      const availabilityPercentage = (totalAvailable / totalRooms) * 100;
      
      if (availabilityPercentage <= 20) {
        await this.sendLowInventoryAlert(roomsData, { 
          date: date.toISOString(),
          totalAvailable: totalAvailable,
          totalRooms: totalRooms
        });
      }
      
    } catch (error) {
      this.logger.error('Error checking low inventory:', error);
    }
  }

  private async sendLowInventoryAlert(inventoryData: any[], options: any): Promise<void> {
    try {
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
    this.logger.log(`🔧 Manually running task: ${taskName}`);
    
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

  // Check if tasks are running
  isRunning(): boolean {
    return this.tasksRunning;
  }

  // Manual trigger functions (useful for testing)
  async triggerReminderCheck(): Promise<void> {
    this.logger.log('🔧 Manual trigger: Checking reminders...');
    await this.checkArrivalReminders();
  }

  async triggerInventoryCheck(): Promise<void> {
    this.logger.log('🔧 Manual trigger: Checking inventory...');
    await this.checkUpcomingInventory();
  }
}
