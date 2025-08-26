const mongoose = require('mongoose');
require('dotenv').config();

// Import the email service and User model
const { sendEmailToAllAdmins } = require('./src/services/emailService');
const User = require('./src/models/User');

async function testAdminEmails() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test getting admin emails
    const adminUsers = await User.find({ 
      role: 'ADMIN',
      'preferences.notifications.email': true 
    }).select('email name');
    
    console.log(`📧 Found ${adminUsers.length} admin user(s):`);
    adminUsers.forEach(admin => {
      console.log(`  - ${admin.name} (${admin.email})`);
    });

    if (adminUsers.length === 0) {
      console.log('❌ No admin users found. Creating a test admin...');
      
      const testAdmin = new User({
        name: 'Test Admin',
        email: process.env.ADMIN_EMAIL || 'admin@asteriashomes.com',
        password: 'hashedpassword', // This would normally be hashed
        role: 'ADMIN',
        preferences: {
          notifications: {
            email: true
          }
        }
      });
      
      await testAdmin.save();
      console.log('✅ Created test admin user');
    }

    // Test sending email to all admins
    console.log('\n📧 Testing admin email sending...');
    
    const testEmailData = {
      guestName: 'Test Customer',
      guestEmail: 'test@example.com',
      guestPhone: '+30 123 456 789',
      bookingId: 'TEST123',
      roomName: 'Test Room',
      checkIn: new Date(),
      checkOut: new Date(Date.now() + 24 * 60 * 60 * 1000),
      guests: 2,
      totalPrice: 150,
      status: 'CONFIRMED',
      createdAt: new Date(),
      language: 'en'
    };

    const result = await sendEmailToAllAdmins('newBookingAlert', testEmailData);
    
    console.log('\n📊 Email sending results:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Admin count: ${result.adminCount}`);
    console.log(`  Success count: ${result.successCount}`);
    
    if (result.results) {
      result.results.forEach(res => {
        const status = res.success ? '✅' : '❌';
        console.log(`  ${status} ${res.name} (${res.admin})`);
        if (res.error) {
          console.log(`      Error: ${res.error}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testAdminEmails(); 