const nodemailer = require('nodemailer');
const { getSettings } = require('../middleware/settings');
const { emailTemplates, formatDate } = require('./emailTemplates');

// Email transporter - configure based on your email provider
let transporter = null;

// Initialize email transporter
function initializeEmailTransporter() {
  try {
    // Priority 1: Use existing SMTP configuration from .env
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates
        }
      });
      console.log('✅ Email transporter initialized with SMTP configuration');
    }
    // Priority 2: Use Gmail service configuration with APP PASSWORD (RECOMMENDED)
    else if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASSWORD
        }
      });
      console.log('✅ Email transporter initialized with Gmail service using APP PASSWORD (SECURE)');
    }
    // Priority 3: Use Gmail service with regular password (LESS SECURE - NOT RECOMMENDED)
    else if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      console.log('⚠️  WARNING: Using regular Gmail password instead of app password!');
      console.log('⚠️  This is less secure and may be blocked by Google.');
      console.log('⚠️  Please enable 2FA and generate an app password for better security.');
      
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
      console.log('✅ Email transporter initialized with Gmail service using regular password (LESS SECURE)');
    }
    // Priority 4: Use Gmail SMTP fallback with APP PASSWORD if available
    else if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      console.log('✅ Email transporter initialized with Gmail SMTP using APP PASSWORD (SECURE)');
    }
    // Priority 5: Use Gmail SMTP fallback with regular password (LAST RESORT)
    else if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      console.log('⚠️  WARNING: Using regular Gmail password in SMTP fallback!');
      console.log('⚠️  This is the least secure option and may be blocked by Google.');
      console.log('⚠️  Please enable 2FA and generate an app password for better security.');
      
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      console.log('✅ Email transporter initialized with Gmail SMTP using regular password (LEAST SECURE)');
    }
    // Fallback: Development mode
    else {
      transporter = {
        sendMail: async (mailOptions) => {
          console.log('📧 [DEV MODE] Email would be sent:');
          console.log('   To:', mailOptions.to);
          console.log('   Subject:', mailOptions.subject);
          console.log('   Content preview:', mailOptions.html ? mailOptions.html.substring(0, 100) + '...' : 'No HTML content');
          console.log('   ---');
          
          return Promise.resolve({
            messageId: 'dev-' + Date.now(),
            response: 'Email logged (development mode)'
          });
        }
      };
      console.log('📧 Email transporter initialized in development mode (emails logged to console)');
    }
  } catch (error) {
    console.error('❌ Failed to initialize email transporter:', error.message);
    // Fallback to development mode
    transporter = {
      sendMail: async (mailOptions) => {
        console.log('📧 [FALLBACK MODE] Email would be sent:', mailOptions.to);
        return Promise.resolve({ messageId: 'fallback-' + Date.now() });
      }
    };
  }
}

// Language detection helper
function detectLanguage(booking, request) {
  // Priority order for language detection:
  // 1. Explicit language from booking/user preference
  // 2. Language from URL path (if available)
  // 3. Accept-Language header
  // 4. Default to Greek

  if (booking && booking.language) {
    return booking.language;
  }

  if (booking && booking.preferredLanguage) {
    return booking.preferredLanguage;
  }

  if (request && request.headers['accept-language']) {
    const acceptLanguage = request.headers['accept-language'];
    if (acceptLanguage.includes('en')) return 'en';
    if (acceptLanguage.includes('de')) return 'de';
    if (acceptLanguage.includes('el')) return 'el';
  }

  // Default to Greek
  return 'el';
}

// Send email function with language support
async function sendEmail(type, data, options = {}) {
  try {
    if (!transporter) {
      console.log('Email transporter not initialized. Email would be sent:', { type, to: data.guestEmail || options.to });
      return { success: true, message: 'Email sent (simulated)' };
    }

    const settings = await getSettings();
    
    // Language detection for customer emails
    const language = options.language || detectLanguage(data, options.request) || 'el';
    
    // Admin emails are always sent to admin email
    const isAdminEmail = ['newBookingAlert', 'lowInventoryAlert'].includes(type);
    const recipient = isAdminEmail ? process.env.ADMIN_EMAIL : (data.guestEmail || options.to);
    
    if (!recipient) {
      throw new Error('No recipient email specified');
    }

    const template = emailTemplates[type];
    if (!template) {
      throw new Error(`Unknown email template: ${type}`);
    }

    // Check if email notifications are enabled
    if (!settings.emailNotifications) {
      console.log(`Email notifications disabled. Would send ${type} to ${recipient}`);
      return { success: true, message: 'Email notifications disabled' };
    }

    // Check specific notification settings (but allow admin emails to always work)
    if (type === 'bookingConfirmation' && !settings.bookingConfirmations) {
      console.log('Booking confirmations disabled in settings');
      return { success: true, message: 'Booking confirmations disabled' };
    }
    if (type === 'arrivalReminder' && !settings.reminderNotifications) {
      console.log('Arrival reminders disabled in settings');
      return { success: true, message: 'Arrival reminders disabled' };
    }
    // Admin notifications should always work regardless of settings
    if (type === 'newBookingAlert' && !settings.newBookingAlerts) {
      console.log('⚠️  New booking alerts disabled in settings, but sending anyway (admin notification)');
    }
    if (type === 'lowInventoryAlert' && !settings.lowInventoryAlerts) {
      console.log('⚠️  Low inventory alerts disabled in settings, but sending anyway (admin notification)');
    }

    // Store the customer's language in the email data for admin reference
    if (!isAdminEmail && language !== 'el') {
      data.language = language;
    }

    const mailOptions = {
      from: `"Asterias Homes" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject: template.subject(data, language),
      html: template.html(data, language),
      text: template.text(data, language)
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully: ${type} to ${recipient} in ${language.toUpperCase()}`);
    
    return { 
      success: true, 
      messageId: result.messageId,
      message: `Email sent to ${recipient}`,
      language: language
    };

  } catch (error) {
    console.error('Email sending failed:', error);
    // Don't throw error to avoid breaking the main application flow
    return { 
      success: false, 
      error: error.message,
      message: 'Email sending failed'
    };
  }
}

// Convenience functions for different email types
async function sendBookingConfirmation(bookingData, options = {}) {
  return await sendEmail('bookingConfirmation', bookingData, options);
}

// Function to send booking confirmation email with proper data formatting
async function sendBookingConfirmationEmail(booking, req) {
  try {
    // Calculate nights
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    
    // Prepare data for email template
    const emailData = {
      bookingId: booking.bookingNumber,
      guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName}`,
      guestEmail: booking.guestInfo.email,
      guestPhone: booking.guestInfo.phone,
      roomName: 'Standard Apartment', // You can enhance this by fetching room details
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      checkInTime: '15:00',
      checkOutTime: '11:00',
      guests: `${booking.adults} adults${booking.children > 0 ? `, ${booking.children} children` : ''}`,
      totalPrice: booking.totalAmount,
      nights: nights,
      paymentMethod: booking.paymentMethod,
      stripePaymentIntentId: booking.stripePaymentIntentId,
      status: booking.bookingStatus,
      createdAt: booking.createdAt
    };
    
    // Detect language from booking or request
    const language = booking.guestInfo.language || detectLanguage(booking, req);
    
    return await sendEmail('bookingConfirmation', emailData, { language });
  } catch (error) {
    console.error('Error preparing booking confirmation email:', error);
    throw error;
  }
}

async function sendArrivalReminder(bookingData, options = {}) {
  return await sendEmail('arrivalReminder', bookingData, options);
}

async function sendNewBookingAlert(bookingData, options = {}) {
  console.log('📧 Sending new booking alert to admin with data:', {
    bookingId: bookingData.bookingId,
    guestName: bookingData.guestName,
    guestEmail: bookingData.guestEmail,
    roomName: bookingData.roomName
  });
  
  const result = await sendEmail('newBookingAlert', bookingData, options);
  
  if (result.success) {
    console.log('✅ New booking alert sent successfully to admin');
  } else {
    console.error('❌ Failed to send new booking alert to admin:', result.error || result.message);
  }
  
  return result;
}

async function sendLowInventoryAlert(inventoryData, options = {}) {
  return await sendEmail('lowInventoryAlert', inventoryData, options);
}

// Test email function
async function sendTestEmail(type = 'bookingConfirmation', language = 'el') {
  const testData = {
    bookingId: 'TEST123',
    guestName: 'Test Customer',
    guestEmail: process.env.ADMIN_EMAIL, // Send to admin for testing
    guestPhone: '+30 123 456 7890',
    roomName: 'Traditional Apartment',
    checkIn: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Day after tomorrow
    checkInTime: '15:00',
    checkOutTime: '11:00',
    guests: 2,
    totalPrice: 150,
    status: 'confirmed',
    createdAt: new Date()
  };

  console.log(`Sending test email (${type}) in ${language.toUpperCase()}...`);
  return await sendEmail(type, testData, { language });
}

// Send email to all admin users
async function sendEmailToAllAdmins(template, data, customSubject = null) {
  try {
    // Get admin email from environment variable
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.log('No admin email configured for notifications');
      return { success: false, reason: 'No admin email configured' };
    }

    console.log(`📧 Sending ${template} to admin: ${adminEmail}`);

    // Send to admin email
    const result = await sendEmail(template, data, { 
      to: adminEmail,
      language: 'el' // Admin emails always in Greek
    });

    if (result.success) {
      console.log(`✅ Email sent to admin: ${adminEmail}`);
    } else {
      console.error(`❌ Failed to send email to admin: ${adminEmail}`);
    }

    return result;

  } catch (error) {
    console.error('❌ Failed to send email to admin:', error);
    return { success: false, error: error.message };
  }
}

// Check for low inventory
async function checkLowInventory(date) {
  try {
    const Room = require('../models/Room');
    const Booking = require('../models/Booking');
    
    // Get all rooms
    const rooms = await Room.find();
    const checkDate = new Date(date);
    
    // Check availability for each room
    const roomsData = await Promise.all(rooms.map(async (room) => {
      const bookings = await Booking.find({
        roomId: room._id,
        checkIn: { $lte: checkDate },
        checkOut: { $gt: checkDate },
        bookingStatus: { $in: ['CONFIRMED', 'CHECKED_IN'] }
      });
      
      return {
        name: room.name,
        total: 1, // Single apartment per room
        available: bookings.length === 0 ? 1 : 0
      };
    }));
    
    // Check if inventory is low (less than 20% available)
    const totalAvailable = roomsData.reduce((sum, room) => sum + room.available, 0);
    const totalRooms = roomsData.length;
    const availabilityPercentage = (totalAvailable / totalRooms) * 100;
    
    if (availabilityPercentage <= 20) { // Less than 20% available
      await sendLowInventoryAlert(roomsData, { 
        date: date,
        totalAvailable: totalAvailable,
        totalRooms: totalRooms
      });
    }
    
  } catch (error) {
    console.error('Error checking low inventory:', error);
  }
}

module.exports = {
  initializeEmailTransporter,
  sendEmail,
  sendBookingConfirmation,
  sendBookingConfirmationEmail,
  sendArrivalReminder,
  sendNewBookingAlert,
  sendLowInventoryAlert,
  sendTestEmail,
  sendEmailToAllAdmins,
  checkLowInventory,
  detectLanguage
};
   