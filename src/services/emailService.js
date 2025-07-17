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

// Email templates
const emailTemplates = {
  // Customer booking confirmation
  bookingConfirmation: {
    subject: (data) => `Επιβεβαίωση Κράτησης - Asterias Homes`,
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0A4A4A;">Επιβεβαίωση Κράτησης</h2>
        
        <p>Αγαπητέ/ή ${data.guestName},</p>
        
        <p>Η κράτησή σας επιβεβαιώθηκε! Εδώ είναι τα στοιχεία:</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Στοιχεία Κράτησης</h3>
          <p><strong>Κωδικός Κράτησης:</strong> ${data.bookingId}</p>
          <p><strong>Δωμάτιο:</strong> ${data.roomName}</p>
          <p><strong>Άφιξη:</strong> ${new Date(data.checkIn).toLocaleDateString('el-GR')} στις ${data.checkInTime}</p>
          <p><strong>Αναχώρηση:</strong> ${new Date(data.checkOut).toLocaleDateString('el-GR')} στις ${data.checkOutTime}</p>
          <p><strong>Επισκέπτες:</strong> ${data.guests}</p>
          <p><strong>Συνολικό Κόστος:</strong> ${data.totalPrice}€</p>
        </div>
        
        <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4>Πληροφορίες Άφιξης</h4>
          <p><strong>Διεύθυνση:</strong> Κορωνησία, Άρτα 48100</p>
          <p><strong>Check-in:</strong> ${data.checkInTime}</p>
          <p><strong>Check-out:</strong> ${data.checkOutTime}</p>
        </div>
        
        <p>Για οποιαδήποτε ερώτηση, επικοινωνήστε μαζί μας:</p>
        <p>📧 info@asteriashome.gr</p>
        <p>📞 +30 26810 XXXXX</p>
        
        <p>Ανυπομονούμε να σας φιλοξενήσουμε!</p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Asterias Homes - Παραδοσιακά διαμερίσματα στην Κορωνησία Άρτας
        </p>
      </div>
    `,
    text: (data) => `
      Επιβεβαίωση Κράτησης - Asterias Homes
      
      Αγαπητέ/ή ${data.guestName},
      
      Η κράτησή σας επιβεβαιώθηκε!
      
      Κωδικός Κράτησης: ${data.bookingId}
      Δωμάτιο: ${data.roomName}
      Άφιξη: ${new Date(data.checkIn).toLocaleDateString('el-GR')} στις ${data.checkInTime}
      Αναχώρηση: ${new Date(data.checkOut).toLocaleDateString('el-GR')} στις ${data.checkOutTime}
      Επισκέπτες: ${data.guests}
      Συνολικό Κόστος: ${data.totalPrice}€
      
      Διεύθυνση: Κορωνησία, Άρτα 48100
      
      info@asteriashome.gr | +30 26810 XXXXX
    `
  },

  // Customer arrival reminder
  arrivalReminder: {
    subject: (data) => `Υπενθύμιση Άφιξης - Asterias Homes`,
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0A4A4A;">Υπενθύμιση Άφιξης</h2>
        
        <p>Αγαπητέ/ή ${data.guestName},</p>
        
        <p>Σας υπενθυμίζουμε ότι η άφιξή σας στο Asterias Homes είναι <strong>αύριο</strong>!</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Στοιχεία Άφιξης</h3>
          <p><strong>Ημερομηνία:</strong> ${new Date(data.checkIn).toLocaleDateString('el-GR')}</p>
          <p><strong>Ώρα Check-in:</strong> ${data.checkInTime}</p>
          <p><strong>Δωμάτιο:</strong> ${data.roomName}</p>
          <p><strong>Κωδικός Κράτησης:</strong> ${data.bookingId}</p>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4>Σημαντικές Πληροφορίες</h4>
          <p><strong>Διεύθυνση:</strong> Κορωνησία, Άρτα 48100</p>
          <p><strong>Παραλαβή Κλειδιών:</strong> Παρακαλώ επικοινωνήστε μαζί μας 30 λεπτά πριν την άφιξή σας</p>
          <p><strong>Τηλέφωνο:</strong> +30 26810 XXXXX</p>
        </div>
        
        <p>Καλό ταξίδι και ανυπομονούμε να σας φιλοξενήσουμε!</p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Asterias Homes - Κορωνησία, Άρτα
        </p>
      </div>
    `,
    text: (data) => `
      Υπενθύμιση Άφιξης - Asterias Homes
      
      Αγαπητέ/ή ${data.guestName},
      
      Η άφιξή σας είναι αύριο!
      
      Ημερομηνία: ${new Date(data.checkIn).toLocaleDateString('el-GR')}
      Ώρα Check-in: ${data.checkInTime}
      Δωμάτιο: ${data.roomName}
      Κωδικός: ${data.bookingId}
      
      Διεύθυνση: Κορωνησία, Άρτα 48100
      Τηλέφωνο: +30 26810 XXXXX
      
      Παρακαλώ καλέστε μας 30 λεπτά πριν την άφιξή σας.
    `
  },

  // Admin new booking alert
  newBookingAlert: {
    subject: (data) => `🏠 Νέα Κράτηση - ${data.roomName}`,
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0A4A4A;">Νέα Κράτηση Παραλήφθηκε</h2>
        
        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
          <h3>Στοιχεία Κράτησης</h3>
          <p><strong>Κωδικός:</strong> ${data.bookingId}</p>
          <p><strong>Πελάτης:</strong> ${data.guestName}</p>
          <p><strong>Email:</strong> ${data.guestEmail}</p>
          <p><strong>Τηλέφωνο:</strong> ${data.guestPhone}</p>
          <p><strong>Δωμάτιο:</strong> ${data.roomName}</p>
          <p><strong>Άφιξη:</strong> ${new Date(data.checkIn).toLocaleDateString('el-GR')}</p>
          <p><strong>Αναχώρηση:</strong> ${new Date(data.checkOut).toLocaleDateString('el-GR')}</p>
          <p><strong>Επισκέπτες:</strong> ${data.guests}</p>
          <p><strong>Συνολικό:</strong> ${data.totalPrice}€</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
          <p><strong>Κρατήθηκε:</strong> ${new Date(data.createdAt).toLocaleString('el-GR')}</p>
          <p><strong>Κατάσταση:</strong> ${data.status}</p>
        </div>
        
        <p style="margin-top: 20px;">
          <a href="${process.env.FRONTEND_URL}/admin/bookings/${data.bookingId}" 
             style="background: #0A4A4A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Προβολή Κράτησης
          </a>
        </p>
      </div>
    `,
    text: (data) => `
      Νέα Κράτηση - ${data.roomName}
      
      Κωδικός: ${data.bookingId}
      Πελάτης: ${data.guestName}
      Email: ${data.guestEmail}
      Δωμάτιο: ${data.roomName}
      Άφιξη: ${new Date(data.checkIn).toLocaleDateString('el-GR')}
      Αναχώρηση: ${new Date(data.checkOut).toLocaleDateString('el-GR')}
      Επισκέπτες: ${data.guests}
      Συνολικό: ${data.totalPrice}€
      
      Κρατήθηκε: ${new Date(data.createdAt).toLocaleString('el-GR')}
    `
  },

  // Admin low inventory alert
  lowInventoryAlert: {
    subject: (data) => `⚠️ Χαμηλή Διαθεσιμότητα - ${data.date}`,
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">⚠️ Ειδοποίηση Χαμηλής Διαθεσιμότητας</h2>
        
        <p>Η διαθεσιμότητα για την ημερομηνία <strong>${data.date}</strong> είναι χαμηλή:</p>
        
        <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
          <h3>Κατάσταση Δωματίων</h3>
          ${data.rooms.map(room => `
            <p><strong>${room.name}:</strong> ${room.available}/${room.total} διαθέσιμα</p>
          `).join('')}
        </div>
        
        <p><strong>Συνολική διαθεσιμότητα:</strong> ${data.totalAvailable}/${data.totalRooms} δωμάτια</p>
        
        <p style="margin-top: 20px;">
          <a href="${process.env.FRONTEND_URL}/admin/bookings" 
             style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Προβολή Κρατήσεων
          </a>
        </p>
      </div>
    `,
    text: (data) => `
      Ειδοποίηση Χαμηλής Διαθεσιμότητας
      
      Ημερομηνία: ${data.date}
      Συνολική διαθεσιμότητα: ${data.totalAvailable}/${data.totalRooms}
      
      ${data.rooms.map(room => `${room.name}: ${room.available}/${room.total}`).join('\n')}
    `
  }
};

// Main email sending function
async function sendEmail(to, template, data, customSubject = null) {
  try {
    // Check if email notifications are enabled
    const settings = await getSettings();
    if (!settings || !settings.emailNotifications) {
      console.log('Email notifications disabled in settings');
      return { success: false, reason: 'Email notifications disabled' };
    }

    // Initialize transporter if not already done
    if (!transporter) {
      initializeEmailTransporter();
    }

    // Get template
    const emailTemplate = emailTemplates[template];
    if (!emailTemplate) {
      throw new Error(`Email template '${template}' not found`);
    }

    // Prepare email content
    const subject = customSubject || emailTemplate.subject(data);
    const html = emailTemplate.html(data);
    const text = emailTemplate.text(data);

    // Send email
    const result = await transporter.sendMail({
      from: `"Asterias Homes" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
      text: text
    });

    console.log('✅ Email sent successfully:', {
      to: to,
      template: template,
      messageId: result.messageId
    });

    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

// Specific notification functions
async function sendBookingConfirmation(booking, room) {
  const settings = await getSettings();
  if (!settings.bookingConfirmations) return;

  const emailData = {
    guestName: booking.guestName,
    bookingId: booking._id,
    roomName: room.name,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    checkInTime: settings.checkInTime || "15:00",
    checkOutTime: settings.checkOutTime || "11:00",
    guests: booking.guests,
    totalPrice: booking.totalPrice
  };

  return await sendEmail(booking.guestEmail, 'bookingConfirmation', emailData);
}

async function sendArrivalReminder(booking, room) {
  const settings = await getSettings();
  if (!settings.reminderNotifications) return;

  const emailData = {
    guestName: booking.guestName,
    bookingId: booking._id,
    roomName: room.name,
    checkIn: booking.checkIn,
    checkInTime: settings.checkInTime || "15:00"
  };

  return await sendEmail(booking.guestEmail, 'arrivalReminder', emailData);
}

async function sendNewBookingAlert(booking, room) {
  const settings = await getSettings();
  if (!settings.newBookingAlerts) return;

  const emailData = {
    bookingId: booking._id,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    guestPhone: booking.guestPhone,
    roomName: room.name,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    guests: booking.guests,
    totalPrice: booking.totalPrice,
    status: booking.bookingStatus,
    createdAt: booking.createdAt
  };

  // Send to admin email
  const adminEmail = process.env.ADMIN_EMAIL || 'info@asteriashome.gr';
  return await sendEmail(adminEmail, 'newBookingAlert', emailData);
}

async function sendLowInventoryAlert(date, roomsData) {
  const settings = await getSettings();
  if (!settings.lowInventoryAlerts) return;

  const emailData = {
    date: new Date(date).toLocaleDateString('el-GR'),
    rooms: roomsData,
    totalAvailable: roomsData.reduce((sum, room) => sum + room.available, 0),
    totalRooms: roomsData.reduce((sum, room) => sum + room.total, 0)
  };

  // Send to admin email
  const adminEmail = process.env.ADMIN_EMAIL || 'info@asteriashome.gr';
  return await sendEmail(adminEmail, 'lowInventoryAlert', emailData);
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
      await sendLowInventoryAlert(date, roomsData);
    }
    
  } catch (error) {
    console.error('Error checking low inventory:', error);
  }
}

module.exports = {
  sendEmail,
  sendBookingConfirmation,
  sendArrivalReminder,
  sendNewBookingAlert,
  sendLowInventoryAlert,
  checkLowInventory,
  initializeEmailTransporter
}; 