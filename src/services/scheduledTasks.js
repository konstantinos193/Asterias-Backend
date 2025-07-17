const cron = require('node-cron');
const { sendArrivalReminder, checkLowInventory } = require('./emailService');
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

        // Send reminder
        const result = await sendArrivalReminder(booking, room);
        
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

// Initialize scheduled tasks
function startScheduledTasks() {
  console.log('🚀 Starting scheduled notification tasks...');

  // Check for arrival reminders every hour
  cron.schedule('0 * * * *', async () => {
    console.log('⏰ Running hourly reminder check...');
    await checkArrivalReminders();
  });

  // Check inventory levels twice daily (9 AM and 6 PM)
  cron.schedule('0 9,18 * * *', async () => {
    console.log('⏰ Running inventory check...');
    await checkUpcomingInventory();
  });

  // Clean up old flags daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Running daily cleanup...');
    await cleanupNotificationFlags();
  });

  // Initial check on startup (with delay to let server fully start)
  setTimeout(async () => {
    console.log('🔄 Running initial notification checks...');
    await checkArrivalReminders();
    await checkUpcomingInventory();
  }, 30000); // 30 seconds after startup

  console.log('✅ Scheduled tasks initialized:');
  console.log('  - Arrival reminders: Every hour');
  console.log('  - Inventory checks: 9 AM & 6 PM daily');
  console.log('  - Cleanup: Midnight daily');
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
  checkArrivalReminders,
  checkUpcomingInventory,
  cleanupNotificationFlags,
  triggerReminderCheck,
  triggerInventoryCheck
}; 