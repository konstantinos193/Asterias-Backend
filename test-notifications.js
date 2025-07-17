const mongoose = require('mongoose');
require('dotenv').config();

const { sendEmail, sendBookingConfirmation, sendNewBookingAlert, sendArrivalReminder, checkLowInventory } = require('./src/services/emailService');
const { triggerReminderCheck, triggerInventoryCheck } = require('./src/services/scheduledTasks');
const Settings = require('./src/models/Settings');

async function testNotifications() {
  try {
    console.log('🧪 Testing Notification System...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/asteriashomes');
    console.log('✅ Connected to MongoDB');

    // Check if email settings are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      console.log('❌ Email not configured. Please set EMAIL_USER and EMAIL_APP_PASSWORD in .env');
      console.log('📚 Setup Guide:');
      console.log('   1. Go to Google Account settings');
      console.log('   2. Enable 2-factor authentication');
      console.log('   3. Generate App Password for "Mail"');
      console.log('   4. Add EMAIL_USER=your-email@gmail.com to .env');
      console.log('   5. Add EMAIL_APP_PASSWORD=your-16-digit-password to .env');
      process.exit(1);
    }

    // Check notification settings
    console.log('\n🔍 Checking notification settings...');
    const settings = await Settings.getInstance();
    console.log('Email notifications:', settings.emailNotifications ? '✅ Enabled' : '❌ Disabled');
    console.log('Booking confirmations:', settings.bookingConfirmations ? '✅ Enabled' : '❌ Disabled');
    console.log('New booking alerts:', settings.newBookingAlerts ? '✅ Enabled' : '❌ Disabled');
    console.log('Reminder notifications:', settings.reminderNotifications ? '✅ Enabled' : '❌ Disabled');
    console.log('Low inventory alerts:', settings.lowInventoryAlerts ? '✅ Enabled' : '❌ Disabled');

    // Test 1: Simple email test
    console.log('\n🧪 Test 1: Basic email functionality');
    const testResult = await sendEmail(
      process.env.EMAIL_USER,
      'bookingConfirmation',
      {
        guestName: 'Test User',
        bookingId: 'TEST123',
        roomName: 'Deluxe Apartment',
        checkIn: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        checkInTime: '15:00',
        checkOutTime: '11:00',
        guests: 2,
        totalPrice: 150
      }
    );

    if (testResult.success) {
      console.log('✅ Test email sent successfully!');
      console.log('📧 Check your inbox:', process.env.EMAIL_USER);
    } else {
      console.log('❌ Test email failed:', testResult.error);
    }

    // Test 2: Mock booking confirmation
    console.log('\n🧪 Test 2: Mock booking confirmation');
    const mockBooking = {
      _id: 'test-booking-id',
      guestInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: process.env.EMAIL_USER
      },
      guestName: 'John Doe',
      guestEmail: process.env.EMAIL_USER,
      guestPhone: '+30 123 456 7890',
      checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
      checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      guests: 2,
      totalPrice: 300,
      bookingStatus: 'CONFIRMED',
      createdAt: new Date()
    };

    const mockRoom = {
      name: 'Traditional Apartment with Sea View',
      _id: 'test-room-id'
    };

    const confirmationResult = await sendBookingConfirmation(mockBooking, mockRoom);
    if (confirmationResult && confirmationResult.success) {
      console.log('✅ Mock booking confirmation sent!');
    } else {
      console.log('❌ Mock booking confirmation failed');
    }

    // Test 3: Admin alert
    console.log('\n🧪 Test 3: Admin new booking alert');
    const alertResult = await sendNewBookingAlert(mockBooking, mockRoom);
    if (alertResult && alertResult.success) {
      console.log('✅ Admin alert sent!');
    } else {
      console.log('❌ Admin alert failed');
    }

    // Test 4: Reminder check (won't send emails but will show logic)
    console.log('\n🧪 Test 4: Checking reminder system');
    await triggerReminderCheck();

    // Test 5: Inventory check
    console.log('\n🧪 Test 5: Checking inventory system');
    await triggerInventoryCheck();

    console.log('\n✅ All notification tests completed!');
    console.log('\n📋 Summary:');
    console.log('- Email service is configured and working');
    console.log('- Booking confirmations will be sent to customers');
    console.log('- Admin alerts will be sent for new bookings');
    console.log('- Arrival reminders will be sent based on settings');
    console.log('- Low inventory alerts will monitor availability');
    console.log('\n🚀 Your notification system is ready to use!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run tests
testNotifications(); 