const { t } = require('../translations/emailTranslations');

// Date formatting helper
function formatDate(date, language) {
  const locales = {
    el: 'el-GR',
    en: 'en-US',
    de: 'de-DE'
  };
  
  return new Date(date).toLocaleDateString(locales[language] || 'el-GR');
}

// Base email template with consistent styling
function getBaseTemplate(content, language = 'el') {
  return `
    <!DOCTYPE html>
    <html lang="${language}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Asterias Homes</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f8f6f1;
          min-height: 100vh;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          margin-top: 20px;
          margin-bottom: 20px;
        }
        .header {
          background: linear-gradient(135deg, #f8f6f1 0%, #e8e2d5 50%, #dbe6e4 100%);
          padding: 30px 40px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .logo-container {
          position: relative;
          z-index: 2;
        }
        .logo {
          width: 180px;
          height: auto;
          margin: 0 auto;
          display: block;
        }
        .content {
          padding: 40px;
          background: white;
        }
        .greeting {
          font-size: 18px;
          color: #2d3748;
          margin-bottom: 25px;
          font-weight: 500;
        }
        .main-text {
          font-size: 16px;
          color: #4a5568;
          line-height: 1.6;
          margin-bottom: 25px;
        }
        .info-card {
          background: linear-gradient(135deg, #f8f6f1 0%, #e8e2d5 100%);
          border-radius: 12px;
          padding: 25px;
          margin: 25px 0;
          border-left: 4px solid #0A4A4A;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        .info-card h3 {
          color: #0A4A4A;
          margin: 0 0 20px 0;
          font-size: 20px;
          font-weight: 600;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: 600;
          color: #2d3748;
        }
        .info-value {
          color: #4a5568;
          text-align: right;
        }
        .highlight-card {
          background: linear-gradient(135deg, #e8e2d5 0%, #dbe6e4 100%);
          border-radius: 12px;
          padding: 20px;
          margin: 25px 0;
          border-left: 4px solid #0A4A4A;
        }
        .highlight-card h4 {
          color: #0A4A4A;
          margin: 0 0 15px 0;
          font-size: 18px;
          font-weight: 600;
        }
        .receipt-card {
          background: linear-gradient(135deg, #f8f6f1 0%, #e8e2d5 100%);
          border-radius: 12px;
          padding: 25px;
          margin: 25px 0;
          border-left: 4px solid #28a745;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        .receipt-card h4 {
          color: #28a745;
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
        }
        .receipt-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .receipt-row:last-child {
          border-bottom: none;
          border-top: 2px solid #dee2e6;
          margin-top: 15px;
          padding-top: 15px;
          font-weight: bold;
          font-size: 18px;
        }
        .payment-status {
          margin-top: 20px;
          padding: 15px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
        }
        .message-card {
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
          border-radius: 12px;
          padding: 25px;
          margin: 25px 0;
          border-left: 4px solid #1976d2;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        .message-card h3 {
          color: #1976d2;
          margin: 0 0 20px 0;
          font-size: 20px;
          font-weight: 600;
        }
        .message-content {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #e3f2fd;
          font-size: 16px;
          line-height: 1.6;
          color: #2d3748;
          white-space: pre-line;
        }
        .payment-status.paid {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        .payment-status.cash {
          background: #fff3cd;
          color: #856404;
          border: 1px solid #ffeaa7;
        }
        .contact-section {
          background: linear-gradient(135deg, #f8f6f1 0%, #e8e2d5 100%);
          border-radius: 12px;
          padding: 25px;
          margin: 25px 0;
          text-align: center;
        }
        .contact-section h4 {
          color: #0A4A4A;
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
        }
        .contact-info {
          display: flex;
          justify-content: center;
          gap: 30px;
          flex-wrap: wrap;
        }
        .contact-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #4a5568;
          text-decoration: none;
          font-weight: 500;
        }
        .contact-item:hover {
          color: #0A4A4A;
        }
        .footer {
          background: #0A4A4A;
          color: white;
          text-align: center;
          padding: 25px;
          font-size: 14px;
          line-height: 1.5;
        }
        .footer-text {
          margin: 0;
          opacity: 0.8;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #0A4A4A 0%, #1a6b6b 100%);
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 20px 0;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(10, 74, 74, 0.3);
        }
        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(10, 74, 74, 0.4);
        }
        .alert-card {
          background: linear-gradient(135deg, #f8f6f1 0%, #e8e2d5 100%);
          border-radius: 12px;
          padding: 25px;
          margin: 25px 0;
          border-left: 4px solid #0A4A4A;
        }
        .alert-card h3 {
          color: #0A4A4A;
          margin: 0 0 20px 0;
          font-size: 20px;
          font-weight: 600;
        }
        .warning-card {
          background: linear-gradient(135deg, #f8f6f1 0%, #e8e2d5 100%);
          border-radius: 12px;
          padding: 25px;
          margin: 25px 0;
          border-left: 4px solid #dc3545;
        }
        .warning-card h3 {
          color: #0A4A4A;
          margin: 0 0 20px 0;
          font-size: 20px;
          font-weight: 600;
        }
        @media only screen and (max-width: 600px) {
          .email-container {
            margin: 10px;
            border-radius: 12px;
          }
          .header, .content {
            padding: 20px;
          }
          .logo {
            width: 140px;
          }
          .header-title {
            font-size: 20px;
          }
          .contact-info {
            flex-direction: column;
            gap: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <div class="logo-container">
            <img src="https://i.imgur.com/leL7gRY.png" alt="Asterias Homes Logo" class="logo">
          </div>
        </div>
        
        <div class="content">
          ${content}
        </div>
        
        <div class="footer">
          <p class="footer-text">
            © ${new Date().getFullYear()} Asterias Homes. All rights reserved.<br>
            Koronisia, Arta 48100, Greece
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Email templates
const emailTemplates = {
  // Customer booking confirmation
  bookingConfirmation: {
    subject: (data, lang = 'el') => t(lang, 'bookingConfirmation', 'subject'),
    html: (data, lang = 'el') => {
      const content = `
        <div class="greeting">${t(lang, 'bookingConfirmation', 'greeting')} ${data.guestName},</div>
        
        <div class="main-text">${t(lang, 'bookingConfirmation', 'confirmationText')}</div>
        
        <div class="info-card">
          <h3>${t(lang, 'bookingConfirmation', 'bookingDetails')}</h3>
          <div class="info-row">
            <span class="info-label">${t(lang, 'bookingConfirmation', 'bookingCode')}:</span>
            <span class="info-value">${data.bookingId}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t(lang, 'bookingConfirmation', 'room')}:</span>
            <span class="info-value">${data.roomName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t(lang, 'bookingConfirmation', 'arrival')}:</span>
            <span class="info-value">${formatDate(data.checkIn, lang)} ${lang === 'en' ? 'at' : lang === 'de' ? 'um' : 'στις'} ${data.checkInTime}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t(lang, 'bookingConfirmation', 'departure')}:</span>
            <span class="info-value">${formatDate(data.checkOut, lang)} ${lang === 'en' ? 'at' : lang === 'de' ? 'um' : 'στις'} ${data.checkOutTime}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t(lang, 'bookingConfirmation', 'guests')}:</span>
            <span class="info-value">${data.guests}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t(lang, 'bookingConfirmation', 'totalCost')}:</span>
            <span class="info-value">${data.totalPrice}€</span>
          </div>
        </div>
        
        <div class="highlight-card">
          <h4>${t(lang, 'bookingConfirmation', 'arrivalInfo')}</h4>
          <div class="info-row">
            <span class="info-label">${t(lang, 'bookingConfirmation', 'address')}:</span>
            <span class="info-value">Koronisia, Arta 48100, Greece</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t(lang, 'bookingConfirmation', 'checkIn')}:</span>
            <span class="info-value">${data.checkInTime}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t(lang, 'bookingConfirmation', 'checkOut')}:</span>
            <span class="info-value">${data.checkOutTime}</span>
          </div>
        </div>
        
        <div class="receipt-card">
          <h4>📋 Receipt</h4>
          <div class="receipt-row">
            <span>Room Price (${data.nights} nights):</span>
            <span>€${(data.totalPrice / data.nights).toFixed(2)} × ${data.nights}</span>
          </div>
          <div class="receipt-row">
            <span>Tax (13%):</span>
            <span>Included</span>
          </div>
          <div class="receipt-row">
            <span>Total Amount:</span>
            <span>€${data.totalPrice}</span>
          </div>
        </div>
        
        ${data.paymentMethod === 'CARD' ? `
        <div class="payment-status paid">
          <strong>Payment Status:</strong> ✅ Paid via Stripe<br>
          <strong>Transaction ID:</strong> ${data.stripePaymentIntentId || 'N/A'}
        </div>
        ` : `
        <div class="payment-status cash">
          <strong>Payment Status:</strong> 💰 Cash on Arrival
        </div>
        `}
        
        <div class="contact-section">
          <h4>${t(lang, 'bookingConfirmation', 'contactInfo')}</h4>
          <div class="contact-info">
            <a href="mailto:asterias.apartmentskoronisia@gmail.com" class="contact-item">
              📧 asterias.apartmentskoronisia@gmail.com
            </a>
            <a href="tel:+306972705881" class="contact-item">
              📞 +30 6972705881
            </a>
          </div>
        </div>
        
        <div class="main-text">${t(lang, 'bookingConfirmation', 'questionsText')}</div>
        
        <div class="main-text">${t(lang, 'bookingConfirmation', 'lookingForward')}</div>
      `;
      
      return getBaseTemplate(content, lang);
    },
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
      
      RECEIPT:
      Room Price (${data.nights} nights): €${(data.totalPrice / data.nights).toFixed(2)} × ${data.nights}
      Tax (13%): Included
      Total Amount: €${data.totalPrice}
      Payment Status: ${data.paymentMethod === 'CARD' ? 'Paid via Stripe' : 'Cash on Arrival'}
      ${data.paymentMethod === 'CARD' ? `Transaction ID: ${data.stripePaymentIntentId || 'N/A'}` : ''}
      
      asterias.apartmentskoronisia@gmail.com | +30 6972705881
    `
  },

  // Customer arrival reminder
  arrivalReminder: {
    subject: (data, lang = 'el') => t(lang, 'arrivalReminder', 'subject'),
    html: (data, lang = 'el') => {
      const content = `
        <div class="greeting">${t(lang, 'arrivalReminder', 'greeting')} ${data.guestName},</div>
        
        <div class="main-text">${t(lang, 'arrivalReminder', 'reminderText')}</div>
        
        <div class="info-card">
          <h3>${t(lang, 'arrivalReminder', 'arrivalDetails')}</h3>
          <div class="info-row">
            <span class="info-label">${t(lang, 'arrivalReminder', 'date')}:</span>
            <span class="info-value">${formatDate(data.checkIn, lang)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t(lang, 'arrivalReminder', 'time')}:</span>
            <span class="info-value">${data.checkInTime}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t(lang, 'arrivalReminder', 'room')}:</span>
            <span class="info-value">${data.roomName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t(lang, 'arrivalReminder', 'bookingCode')}:</span>
            <span class="info-value">${data.bookingId}</span>
          </div>
        </div>
        
        <div class="highlight-card">
          <h4>${t(lang, 'arrivalReminder', 'importantInfo')}</h4>
          <div class="info-row">
            <span class="info-label">${t(lang, 'arrivalReminder', 'address')}:</span>
            <span class="info-value">Koronisia, Arta 48100, Greece</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t(lang, 'arrivalReminder', 'keyPickup')}:</span>
            <span class="info-value">${t(lang, 'arrivalReminder', 'keyPickupText')}</span>
          </div>
        </div>
        
        <div class="contact-section">
          <h4>${t(lang, 'arrivalReminder', 'contactInfo')}</h4>
          <div class="contact-info">
            <a href="mailto:asterias.apartmentskoronisia@gmail.com" class="contact-item">
              📧 asterias.apartmentskoronisia@gmail.com
            </a>
            <a href="tel:+306972705881" class="contact-item">
              📞 +30 6972705881
            </a>
          </div>
        </div>
        
        <div class="main-text">${t(lang, 'arrivalReminder', 'goodTrip')}</div>
      `;
      
      return getBaseTemplate(content, lang);
    },
    text: (data, lang = 'el') => `
      ${t(lang, 'arrivalReminder', 'subject')}
      
      ${t(lang, 'arrivalReminder', 'greeting')} ${data.guestName},
      
      ${t(lang, 'arrivalReminder', 'reminderText')}
      
      ${t(lang, 'arrivalReminder', 'date')}: ${formatDate(data.checkIn, lang)}
      ${t(lang, 'arrivalReminder', 'time')}: ${data.checkInTime}
      ${t(lang, 'arrivalReminder', 'room')}: ${data.roomName}
      ${t(lang, 'arrivalReminder', 'bookingCode')}: ${data.bookingId}
      
      ${t(lang, 'arrivalReminder', 'address')}: Koronisia, Arta 48100, Greece
      
      ${t(lang, 'arrivalReminder', 'contactInfo')}:
      ${t(lang, 'arrivalReminder', 'email')}: asterias.apartmentskoronisia@gmail.com
      ${t(lang, 'arrivalReminder', 'phone')}: +30 6972705881
      
      ${t(lang, 'arrivalReminder', 'keyPickupText')}
    `
  },

  // Admin alerts (always in Greek since you're Greek business)
  newBookingAlert: {
    subject: (data, lang = 'el') => `${t('el', 'newBookingAlert', 'subject')} - ${data.roomName}`,
    html: (data, lang = 'el') => {
      const content = `
        <div class="greeting">${t('el', 'newBookingAlert', 'title')}</div>
        
        <div class="alert-card">
          <h3>${t('el', 'newBookingAlert', 'bookingDetails')}</h3>
          <div class="info-row">
            <span class="info-label">${t('el', 'newBookingAlert', 'code')}:</span>
            <span class="info-value">${data.bookingId}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t('el', 'newBookingAlert', 'customer')}:</span>
            <span class="info-value">${data.guestName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t('el', 'newBookingAlert', 'email')}:</span>
            <span class="info-value">${data.guestEmail}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t('el', 'newBookingAlert', 'phone')}:</span>
            <span class="info-value">${data.guestPhone}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t('el', 'newBookingAlert', 'room')}:</span>
            <span class="info-value">${data.roomName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t('el', 'newBookingAlert', 'arrival')}:</span>
            <span class="info-value">${formatDate(data.checkIn, 'el')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t('el', 'newBookingAlert', 'departure')}:</span>
            <span class="info-value">${formatDate(data.checkOut, 'el')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t('el', 'newBookingAlert', 'guests')}:</span>
            <span class="info-value">${data.guests}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t('el', 'newBookingAlert', 'total')}:</span>
            <span class="info-value">${data.totalPrice}€</span>
          </div>
          ${data.language && data.language !== 'el' ? `
          <div class="info-row">
            <span class="info-label">Customer Language:</span>
            <span class="info-value">${data.language.toUpperCase()}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="info-card">
          <div class="info-row">
            <span class="info-label">${t('el', 'newBookingAlert', 'bookedAt')}:</span>
            <span class="info-value">${new Date(data.createdAt).toLocaleString('el-GR')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t('el', 'newBookingAlert', 'status')}:</span>
            <span class="info-value">${data.status}</span>
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/admin/bookings/${data.bookingId}" class="cta-button">
            ${t('el', 'newBookingAlert', 'viewBooking')}
          </a>
        </div>
        
        <div class="contact-section">
          <h4>Contact Information</h4>
          <div class="contact-info">
            <a href="mailto:asterias.apartmentskoronisia@gmail.com" class="contact-item">
              📧 asterias.apartmentskoronisia@gmail.com
            </a>
            <a href="tel:+306972705881" class="contact-item">
              📞 +30 6972705881
            </a>
          </div>
        </div>
      `;
      
      return getBaseTemplate(content, 'el');
    },
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
    html: (data, lang = 'el') => {
      const content = `
        <div class="greeting">${t('el', 'lowInventoryAlert', 'title')}</div>
        
        <div class="main-text">${t('el', 'lowInventoryAlert', 'text')} <strong>${data.date}</strong>:</div>
        
        <div class="warning-card">
          <h3>${t('el', 'lowInventoryAlert', 'roomStatus')}</h3>
          ${data.rooms.map(room => `
            <div class="info-row">
              <span class="info-label">${room.name}:</span>
              <span class="info-value">${room.available}/${room.total} διαθέσιμα</span>
            </div>
          `).join('')}
        </div>
        
        <div class="info-card">
          <div class="info-row">
            <span class="info-label">${t('el', 'lowInventoryAlert', 'totalAvailability')}:</span>
            <span class="info-value">${data.totalAvailable}/${data.totalRooms} δωμάτια</span>
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/admin/bookings" class="cta-button">
            ${t('el', 'lowInventoryAlert', 'viewBookings')}
          </a>
        </div>
        
        <div class="contact-section">
          <h4>Contact Information</h4>
          <div class="contact-info">
            <a href="mailto:asterias.apartmentskoronisia@gmail.com" class="contact-item">
              📧 asterias.apartmentskoronisia@gmail.com
            </a>
            <a href="tel:+306972705881" class="contact-item">
              📞 +30 6972705881
            </a>
          </div>
        </div>
      `;
      
      return getBaseTemplate(content, 'el');
    },
    text: (data, lang = 'el') => `
      ${t('el', 'lowInventoryAlert', 'title')}
      
      ${t('el', 'lowInventoryAlert', 'text')} ${data.date}
      ${t('el', 'lowInventoryAlert', 'totalAvailability')}: ${data.totalAvailable}/${data.totalRooms}
      
      ${data.rooms.map(room => `${room.name}: ${room.available}/${room.total}`).join('\n')}
    `
  },

    // Custom message from admin to guest
    customMessage: {
      subject: (data, lang = 'el') => `Μήνυμα από το Asterias Homes - Κράτηση ${data.bookingNumber}`,
      html: (data, lang = 'el') => {
        const content = `
          <div class="greeting">Αγαπητέ/ή ${data.guestName},</div>
          
          <div class="main-text">
            Έχετε λάβει ένα προσωπικό μήνυμα από το προσωπικό του Asterias Homes σχετικά με την κράτησή σας.
          </div>
          
          <div class="info-card">
            <h3>📋 Στοιχεία Κράτησης</h3>
            <div class="info-row">
              <span class="info-label">Αριθμός Κράτησης:</span>
              <span class="info-value">${data.bookingNumber}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Δωμάτιο:</span>
              <span class="info-value">${data.roomName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Check-in:</span>
              <span class="info-value">${formatDate(data.checkIn, 'el')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Check-out:</span>
              <span class="info-value">${formatDate(data.checkOut, 'el')}</span>
            </div>
          </div>
          
          <div class="message-card">
            <h3>💬 Προσωπικό Μήνυμα</h3>
            <div class="message-content">
              ${data.customMessage.replace(/\n/g, '<br>')}
            </div>
          </div>
          
          <div class="contact-section">
            <h4>📞 Επικοινωνία</h4>
            <div class="contact-info">
              <a href="mailto:asterias.apartmentskoronisia@gmail.com" class="contact-item">
                📧 asterias.apartmentskoronisia@gmail.com
              </a>
              <a href="tel:+306972705881" class="contact-item">
                📞 +30 6972705881
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p>Με εκτίμηση,<br><strong>Η Ομάδα του Asterias Homes</strong></p>
          </div>
        `;
        
        return getBaseTemplate(content, 'el');
      },
      text: (data, lang = 'el') => `
        Μήνυμα από το Asterias Homes - Κράτηση ${data.bookingNumber}
        
        Αγαπητέ/ή ${data.guestName},
        
        Έχετε λάβει ένα προσωπικό μήνυμα από το προσωπικό του Asterias Homes σχετικά με την κράτησή σας.
        
        Στοιχεία Κράτησης:
        - Αριθμός Κράτησης: ${data.bookingNumber}
        - Δωμάτιο: ${data.roomName}
        - Check-in: ${formatDate(data.checkIn, 'el')}
        - Check-out: ${formatDate(data.checkOut, 'el')}
        
        Προσωπικό Μήνυμα:
        ${data.customMessage}
        
        Επικοινωνία:
        - Email: asterias.apartmentskoronisia@gmail.com
        - Τηλέφωνο: +30 6972705881
        
        Με εκτίμηση,
        Η Ομάδα του Asterias Homes
      `
    }
  };

module.exports = {
  emailTemplates,
  formatDate
};
