const cron = require('node-cron');
const jobManager = require('./job-manager');
const { sendArrivalReminder, checkLowInventory, sendEmailToAllAdmins } = require('./emailService');
const { getSettings } = require('../middleware/settings');
const Booking = require('../models/Booking');
const Room = require('../models/Room');

// Check for bookings that need arrival reminders
async function checkArrivalReminders() {
  try {
    console.log('🔔 Checking for arrival reminders...');
    
    const settings = await getSettings();
    if (!settings || !settings.reminderNotifications || !settings.emailNotifications) {
      console.log('Reminder notifications disabled in settings');
      return;
    }

    const now = new Date();
    const reminderTime = new Date(now.getTime() + (settings.reminderHours * 60 * 60 * 1000));
    
    // Find bookings that need reminders
    const bookings = await Booking.find({
      checkIn: {
        $gte: new Date(reminderTime.toDateString()), // Start of reminder day
        $lt: new Date(new Date(reminderTime.toDateString()).getTime() + 24 * 60 * 60 * 1000) // End of reminder day
      },
      bookingStatus: 'CONFIRMED',
      reminderSent: { $ne: true } // Haven't sent reminder yet
    });

    console.log(`Found ${bookings.length} bookings needing reminders`);

    for (const booking of bookings) {
      try {
        // Get room details
        const room = await Room.findById(booking.roomId);
        if (!room) continue;

        // Send reminder with customer's language
        const result = await sendArrivalReminder({
          bookingId: booking.bookingNumber,
          guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName}`,
          guestEmail: booking.guestInfo.email,
          roomName: room.name,
          checkIn: booking.checkIn,
          checkInTime: '15:00', // Get from settings later
          language: booking.guestInfo.language
        }, { language: booking.guestInfo.language });
        
        if (result && result.success) {
          // Mark reminder as sent
          booking.reminderSent = true;
          await booking.save();
          
          console.log(`✅ Reminder sent for booking ${booking._id}`);
        } else {
          console.log(`❌ Failed to send reminder for booking ${booking._id}`);
        }

      } catch (error) {
        console.error(`Error sending reminder for booking ${booking._id}:`, error);
      }

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (error) {
    console.error('Error checking arrival reminders:', error);
  }
}

// Check for low inventory over the next few days
async function checkUpcomingInventory() {
  try {
    console.log('📊 Checking upcoming inventory levels...');
    
    const settings = await getSettings();
    if (!settings || !settings.lowInventoryAlerts || !settings.emailNotifications) {
      console.log('Low inventory alerts disabled in settings');
      return;
    }

    // Check next 7 days
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() + i);
      
      await checkLowInventory(checkDate);
      
      // Small delay between checks
      await new Promise(resolve => setTimeout(resolve, 500));
    }

  } catch (error) {
    console.error('Error checking upcoming inventory:', error);
  }
}

// Clean up old notifications flags
async function cleanupNotificationFlags() {
  try {
    console.log('🧹 Cleaning up old notification flags...');
    
    // Remove reminderSent flag from bookings that are in the past
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    
    const result = await Booking.updateMany(
      { 
        checkOut: { $lt: pastDate },
        reminderSent: true 
      },
      { 
        $unset: { reminderSent: 1 } 
      }
    );
    
    console.log(`Cleaned up ${result.modifiedCount} old notification flags`);

  } catch (error) {
    console.error('Error cleaning up notification flags:', error);
  }
}

// Initialize scheduled tasks using JobManager
function startScheduledTasks() {
  console.log('🚀 Starting scheduled notification tasks...');

  // Check for arrival reminders every hour
  jobManager.scheduleCron('arrival-reminders', '0 * * * *', async () => {
    console.log('⏰ Running hourly reminder check...');
    await checkArrivalReminders();
  });

  // Check inventory levels twice daily (9 AM and 6 PM)
  jobManager.scheduleCron('inventory-checks', '0 9,18 * * *', async () => {
    console.log('⏰ Running inventory check...');
    await checkUpcomingInventory();
  });

  // Clean up old flags daily at midnight
  jobManager.scheduleCron('cleanup-flags', '0 0 * * *', async () => {
    console.log('⏰ Running daily cleanup...');
    await cleanupNotificationFlags();
  });

  // Initial check on startup (with delay to let server fully start)
  jobManager.scheduleTimeout('initial-checks', async () => {
    console.log('🔄 Running initial notification checks...');
    await checkArrivalReminders();
    await checkUpcomingInventory();
  }, 30000); // 30 seconds after startup

  console.log('✅ Scheduled tasks initialized:');
  console.log('  - Arrival reminders: Every hour');
  console.log('  - Inventory checks: 9 AM & 6 PM daily');
  console.log('  - Cleanup: Midnight daily');
  
  // Log job statistics
  jobManager.listJobs();
}

// Stop all scheduled tasks and clean up
function stopScheduledTasks() {
  console.log('🛑 Stopping scheduled tasks...');
  jobManager.stopAll();
  console.log('✅ All scheduled tasks stopped');
}

// Manual trigger functions (useful for testing)
async function triggerReminderCheck() {
  console.log('🔧 Manual trigger: Checking reminders...');
  await checkArrivalReminders();
}

async function triggerInventoryCheck() {
  console.log('🔧 Manual trigger: Checking inventory...');
  await checkUpcomingInventory();
}

module.exports = {
  startScheduledTasks,
  stopScheduledTasks,
  checkArrivalReminders,
  checkUpcomingInventory,
  cleanupNotificationFlags,
  triggerReminderCheck,
  triggerInventoryCheck
}; 