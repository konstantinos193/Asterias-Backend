const nodemailer = require('nodemailer');
const { getSettings } = require('../middleware/settings');
const { t } = require('../translations/emailTranslations');

// Email transporter - configure based on your email provider
let transporter = null;

// Initialize email transporter
function initializeEmailTransporter() {
  // Configure for Gmail/Google Workspace (most common for small businesses)
  transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // your-email@gmail.com
      pass: process.env.EMAIL_APP_PASSWORD // App-specific password
    }
  });

  // Alternative: SMTP configuration for other providers
  /*
  transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  */
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

// Date formatting helper
function formatDate(date, language) {
  const locales = {
    el: 'el-GR',
    en: 'en-US',
    de: 'de-DE'
  };
  
  return new Date(date).toLocaleDateString(locales[language] || 'el-GR');
}

// Multilingual email templates
const emailTemplates = {
  // Customer booking confirmation
  bookingConfirmation: {
    subject: (data, lang = 'el') => t(lang, 'bookingConfirmation', 'subject'),
    html: (data, lang = 'el') => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0A4A4A;">${t(lang, 'bookingConfirmation', 'subject').replace(' - Asterias Homes', '')}</h2>
        
        <p>${t(lang, 'bookingConfirmation', 'greeting')} ${data.guestName},</p>
        
        <p>${t(lang, 'bookingConfirmation', 'confirmationText')}</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>${t(lang, 'bookingConfirmation', 'bookingDetails')}</h3>
          <p><strong>${t(lang, 'bookingConfirmation', 'bookingCode')}:</strong> ${data.bookingId}</p>
          <p><strong>${t(lang, 'bookingConfirmation', 'room')}:</strong> ${data.roomName}</p>
          <p><strong>${t(lang, 'bookingConfirmation', 'arrival')}:</strong> ${formatDate(data.checkIn, lang)} ${lang === 'en' ? 'at' : lang === 'de' ? 'um' : 'στις'} ${data.checkInTime}</p>
          <p><strong>${t(lang, 'bookingConfirmation', 'departure')}:</strong> ${formatDate(data.checkOut, lang)} ${lang === 'en' ? 'at' : lang === 'de' ? 'um' : 'στις'} ${data.checkOutTime}</p>
          <p><strong>${t(lang, 'bookingConfirmation', 'guests')}:</strong> ${data.guests}</p>
          <p><strong>${t(lang, 'bookingConfirmation', 'totalCost')}:</strong> ${data.totalPrice}€</p>
        </div>
        
        <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4>${t(lang, 'bookingConfirmation', 'arrivalInfo')}</h4>
          <p><strong>${t(lang, 'bookingConfirmation', 'address')}:</strong> Koronisia, Arta 48100, Greece</p>
          <p><strong>${t(lang, 'bookingConfirmation', 'checkIn')}:</strong> ${data.checkInTime}</p>
          <p><strong>${t(lang, 'bookingConfirmation', 'checkOut')}:</strong> ${data.checkOutTime}</p>
        </div>
        
        <p>${t(lang, 'bookingConfirmation', 'questionsText')}</p>
        <p>📧 info@asteriashome.gr</p>
        <p>📞 +30 26810 XXXXX</p>
        
        <p>${t(lang, 'bookingConfirmation', 'lookingForward')}</p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          ${t(lang, 'bookingConfirmation', 'footer')}
        </p>
      </div>
    `,
    text: (data, lang = 'el') => `
      ${t(lang, 'bookingConfirmation', 'subject')}
      
      ${t(lang, 'bookingConfirmation', 'greeting')} ${data.guestName},
      
      ${t(lang, 'bookingConfirmation', 'confirmationText')}
      
      ${t(lang, 'bookingConfirmation', 'bookingCode')}: ${data.bookingId}
      ${t(lang, 'bookingConfirmation', 'room')}: ${data.roomName}
      ${t(lang, 'bookingConfirmation', 'arrival')}: ${formatDate(data.checkIn, lang)} ${lang === 'en' ? 'at' : lang === 'de' ? 'um' : 'στις'} ${data.checkInTime}
      ${t(lang, 'bookingConfirmation', 'departure')}: ${formatDate(data.checkOut, lang)} ${lang === 'en' ? 'at' : lang === 'de' ? 'um' : 'στις'} ${data.checkOutTime}
      ${t(lang, 'bookingConfirmation', 'guests')}: ${data.guests}
      ${t(lang, 'bookingConfirmation', 'totalCost')}: ${data.totalPrice}€
      
      ${t(lang, 'bookingConfirmation', 'address')}: Koronisia, Arta 48100, Greece
      
      info@asteriashome.gr | +30 26810 XXXXX
    `
  },

  // Customer arrival reminder
  arrivalReminder: {
    subject: (data, lang = 'el') => t(lang, 'arrivalReminder', 'subject'),
    html: (data, lang = 'el') => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0A4A4A;">${t(lang, 'arrivalReminder', 'subject').replace(' - Asterias Homes', '')}</h2>
        
        <p>${t(lang, 'arrivalReminder', 'greeting')} ${data.guestName},</p>
        
        <p>${t(lang, 'arrivalReminder', 'reminderText')}</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>${t(lang, 'arrivalReminder', 'arrivalDetails')}</h3>
          <p><strong>${t(lang, 'arrivalReminder', 'date')}:</strong> ${formatDate(data.checkIn, lang)}</p>
          <p><strong>${t(lang, 'arrivalReminder', 'time')}:</strong> ${data.checkInTime}</p>
          <p><strong>${t(lang, 'arrivalReminder', 'room')}:</strong> ${data.roomName}</p>
          <p><strong>${t(lang, 'arrivalReminder', 'bookingCode')}:</strong> ${data.bookingId}</p>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4>${t(lang, 'arrivalReminder', 'importantInfo')}</h4>
          <p><strong>${t(lang, 'arrivalReminder', 'address')}:</strong> Koronisia, Arta 48100, Greece</p>
          <p><strong>${t(lang, 'arrivalReminder', 'keyPickup')}:</strong> ${t(lang, 'arrivalReminder', 'keyPickupText')}</p>
          <p><strong>${t(lang, 'arrivalReminder', 'phone')}:</strong> +30 26810 XXXXX</p>
        </div>
        
        <p>${t(lang, 'arrivalReminder', 'goodTrip')}</p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          ${t(lang, 'arrivalReminder', 'footer')}
        </p>
      </div>
    `,
    text: (data, lang = 'el') => `
      ${t(lang, 'arrivalReminder', 'subject')}
      
      ${t(lang, 'arrivalReminder', 'greeting')} ${data.guestName},
      
      ${t(lang, 'arrivalReminder', 'reminderText')}
      
      ${t(lang, 'arrivalReminder', 'date')}: ${formatDate(data.checkIn, lang)}
      ${t(lang, 'arrivalReminder', 'time')}: ${data.checkInTime}
      ${t(lang, 'arrivalReminder', 'room')}: ${data.roomName}
      ${t(lang, 'arrivalReminder', 'bookingCode')}: ${data.bookingId}
      
      ${t(lang, 'arrivalReminder', 'address')}: Koronisia, Arta 48100, Greece
      ${t(lang, 'arrivalReminder', 'phone')}: +30 26810 XXXXX
      
      ${t(lang, 'arrivalReminder', 'keyPickupText')}
    `
  },

  // Admin alerts (always in Greek since you're Greek business)
  newBookingAlert: {
    subject: (data, lang = 'el') => `${t('el', 'newBookingAlert', 'subject')} - ${data.roomName}`,
    html: (data, lang = 'el') => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0A4A4A;">${t('el', 'newBookingAlert', 'title')}</h2>
        
        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
          <h3>${t('el', 'newBookingAlert', 'bookingDetails')}</h3>
          <p><strong>${t('el', 'newBookingAlert', 'code')}:</strong> ${data.bookingId}</p>
          <p><strong>${t('el', 'newBookingAlert', 'customer')}:</strong> ${data.guestName}</p>
          <p><strong>${t('el', 'newBookingAlert', 'email')}:</strong> ${data.guestEmail}</p>
          <p><strong>${t('el', 'newBookingAlert', 'phone')}:</strong> ${data.guestPhone}</p>
          <p><strong>${t('el', 'newBookingAlert', 'room')}:</strong> ${data.roomName}</p>
          <p><strong>${t('el', 'newBookingAlert', 'arrival')}:</strong> ${formatDate(data.checkIn, 'el')}</p>
          <p><strong>${t('el', 'newBookingAlert', 'departure')}:</strong> ${formatDate(data.checkOut, 'el')}</p>
          <p><strong>${t('el', 'newBookingAlert', 'guests')}:</strong> ${data.guests}</p>
          <p><strong>${t('el', 'newBookingAlert', 'total')}:</strong> ${data.totalPrice}€</p>
          ${data.language && data.language !== 'el' ? `<p><strong>Customer Language:</strong> ${data.language.toUpperCase()}</p>` : ''}
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
          <p><strong>${t('el', 'newBookingAlert', 'bookedAt')}:</strong> ${new Date(data.createdAt).toLocaleString('el-GR')}</p>
          <p><strong>${t('el', 'newBookingAlert', 'status')}:</strong> ${data.status}</p>
        </div>
        
        <p style="margin-top: 20px;">
          <a href="${process.env.FRONTEND_URL}/admin/bookings/${data.bookingId}" 
             style="background: #0A4A4A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            ${t('el', 'newBookingAlert', 'viewBooking')}
          </a>
        </p>
      </div>
    `,
    text: (data, lang = 'el') => `
      ${t('el', 'newBookingAlert', 'subject')} - ${data.roomName}
      
      ${t('el', 'newBookingAlert', 'code')}: ${data.bookingId}
      ${t('el', 'newBookingAlert', 'customer')}: ${data.guestName}
      ${t('el', 'newBookingAlert', 'email')}: ${data.guestEmail}
      ${t('el', 'newBookingAlert', 'room')}: ${data.roomName}
      ${t('el', 'newBookingAlert', 'arrival')}: ${formatDate(data.checkIn, 'el')}
      ${t('el', 'newBookingAlert', 'departure')}: ${formatDate(data.checkOut, 'el')}
      ${t('el', 'newBookingAlert', 'guests')}: ${data.guests}
      ${t('el', 'newBookingAlert', 'total')}: ${data.totalPrice}€
      ${data.language && data.language !== 'el' ? `Customer Language: ${data.language.toUpperCase()}` : ''}
      
      ${t('el', 'newBookingAlert', 'bookedAt')}: ${new Date(data.createdAt).toLocaleString('el-GR')}
    `
  },

  // Admin low inventory alert (always in Greek)
  lowInventoryAlert: {
    subject: (data, lang = 'el') => `${t('el', 'lowInventoryAlert', 'subject')} - ${data.date}`,
    html: (data, lang = 'el') => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">${t('el', 'lowInventoryAlert', 'title')}</h2>
        
        <p>${t('el', 'lowInventoryAlert', 'text')} <strong>${data.date}</strong>:</p>
        
        <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
          <h3>${t('el', 'lowInventoryAlert', 'roomStatus')}</h3>
          ${data.rooms.map(room => `
            <p><strong>${room.name}:</strong> ${room.available}/${room.total} διαθέσιμα</p>
          `).join('')}
        </div>
        
        <p><strong>${t('el', 'lowInventoryAlert', 'totalAvailability')}:</strong> ${data.totalAvailable}/${data.totalRooms} δωμάτια</p>
        
        <p style="margin-top: 20px;">
          <a href="${process.env.FRONTEND_URL}/admin/bookings" 
             style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            ${t('el', 'lowInventoryAlert', 'viewBookings')}
          </a>
        </p>
      </div>
    `,
    text: (data, lang = 'el') => `
      ${t('el', 'lowInventoryAlert', 'title')}
      
      ${t('el', 'lowInventoryAlert', 'text')} ${data.date}
      ${t('el', 'lowInventoryAlert', 'totalAvailability')}: ${data.totalAvailable}/${data.totalRooms}
      
      ${data.rooms.map(room => `${room.name}: ${room.available}/${room.total}`).join('\n')}
    `
  }
};

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

    // Check specific notification settings
    if (type === 'bookingConfirmation' && !settings.bookingConfirmations) {
      return { success: true, message: 'Booking confirmations disabled' };
    }
    if (type === 'arrivalReminder' && !settings.reminderNotifications) {
      return { success: true, message: 'Arrival reminders disabled' };
    }
    if (type === 'newBookingAlert' && !settings.newBookingAlerts) {
      return { success: true, message: 'New booking alerts disabled' };
    }
    if (type === 'lowInventoryAlert' && !settings.lowInventoryAlerts) {
      return { success: true, message: 'Low inventory alerts disabled' };
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

async function sendArrivalReminder(bookingData, options = {}) {
  return await sendEmail('arrivalReminder', bookingData, options);
}

async function sendNewBookingAlert(bookingData, options = {}) {
  return await sendEmail('newBookingAlert', bookingData, options);
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

module.exports = {
  initializeEmailTransporter,
  sendEmail,
  sendBookingConfirmation,
  sendArrivalReminder,
  sendNewBookingAlert,
  sendLowInventoryAlert,
  sendTestEmail,
  detectLanguage
}; 