import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { t } from '../translations/translations';

export interface EmailData {
  bookingId?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  roomName?: string;
  checkIn?: Date;
  checkOut?: Date;
  checkInTime?: string;
  checkOutTime?: string;
  guests?: string | number;
  totalPrice?: number;
  nights?: number;
  paymentMethod?: string;
  stripePaymentIntentId?: string;
  status?: string;
  createdAt?: Date;
  language?: string;
  to?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  message?: string;
  error?: string;
  language?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {}

  initializeTransporter(): void {
    try {
      // Priority 1: Use existing SMTP configuration from .env
      if (this.configService.get('SMTP_HOST') && this.configService.get('SMTP_USER') && this.configService.get('SMTP_PASS')) {
        this.transporter = nodemailer.createTransport({
          host: this.configService.get('SMTP_HOST'),
          port: this.configService.get('SMTP_PORT') || 587,
          secure: false,
          auth: {
            user: this.configService.get('SMTP_USER'),
            pass: this.configService.get('SMTP_PASS')
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        this.logger.log('✅ Email transporter initialized with SMTP configuration');
      }
      // Priority 2: Use Gmail service configuration with APP PASSWORD
      else if (this.configService.get('EMAIL_USER') && this.configService.get('EMAIL_APP_PASSWORD')) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: this.configService.get('EMAIL_USER'),
            pass: this.configService.get('EMAIL_APP_PASSWORD')
          }
        });
        this.logger.log('✅ Email transporter initialized with Gmail service using APP PASSWORD (SECURE)');
      }
      // Priority 3: Use Gmail service with regular password
      else if (this.configService.get('EMAIL_USER') && this.configService.get('EMAIL_PASSWORD')) {
        this.logger.warn('⚠️  WARNING: Using regular Gmail password instead of app password!');
        this.logger.warn('⚠️  This is less secure and may be blocked by Google.');
        this.logger.warn('⚠️  Please enable 2FA and generate an app password for better security.');
        
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: this.configService.get('EMAIL_USER'),
            pass: this.configService.get('EMAIL_PASSWORD')
          }
        });
        this.logger.log('✅ Email transporter initialized with Gmail service using regular password (LESS SECURE)');
      }
      // Fallback: Development mode
      else {
        this.transporter = {
          sendMail: async (mailOptions) => {
            this.logger.log('📧 [DEV MODE] Email would be sent:');
            this.logger.log(`   To: ${mailOptions.to}`);
            this.logger.log(`   Subject: ${mailOptions.subject}`);
            this.logger.log(`   Content preview: ${mailOptions.html ? mailOptions.html.substring(0, 100) + '...' : 'No HTML content'}`);
            this.logger.log('   ---');
            
            return Promise.resolve({
              messageId: 'dev-' + Date.now(),
              response: 'Email logged (development mode)'
            } as any);
          }
        } as any;
        this.logger.log('📧 Email transporter initialized in development mode (emails logged to console)');
      }
    } catch (error) {
      this.logger.error('❌ Failed to initialize email transporter:', error.message);
      // Fallback to development mode
      this.transporter = {
        sendMail: async (mailOptions) => {
          this.logger.log(`📧 [FALLBACK MODE] Email would be sent: ${mailOptions.to}`);
          return Promise.resolve({ messageId: 'fallback-' + Date.now() } as any);
        }
      } as any;
    }
  }

  private detectLanguage(data: EmailData, request?: any): string {
    // Priority order for language detection:
    // 1. Explicit language from booking/user preference
    // 2. Language from URL path (if available)
    // 3. Accept-Language header
    // 4. Default to Greek

    if (data && data.language) {
      return data.language;
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

  async sendEmail(type: string, data: EmailData, options: { language?: string; request?: any; to?: string } = {}): Promise<EmailResult> {
    try {
      if (!this.transporter) {
        this.logger.log(`Email transporter not initialized. Email would be sent: ${type} to ${data.guestEmail || options.to}`);
        return { success: true, message: 'Email sent (simulated)' };
      }

      // Language detection for customer emails
      const language = options.language || this.detectLanguage(data, options.request) || 'el';
      
      // Admin emails are always sent to admin email
      const isAdminEmail = ['newBookingAlert', 'lowInventoryAlert'].includes(type);
      
      // For admin emails, try multiple fallback options
      let recipient: string;
      if (isAdminEmail) {
        // Priority 1: Use options.to if provided
        if (options.to) {
          recipient = options.to;
        }
        // Priority 2: Use ADMIN_EMAIL environment variable
        else if (this.configService.get('ADMIN_EMAIL')) {
          recipient = this.configService.get('ADMIN_EMAIL');
        }
        // Priority 3: Use EMAIL_USER as fallback
        else if (this.configService.get('EMAIL_USER')) {
          recipient = this.configService.get('EMAIL_USER');
          this.logger.warn('⚠️  ADMIN_EMAIL not set, using EMAIL_USER as fallback for admin notifications');
        }
        // Priority 4: Use hardcoded fallback
        else {
          recipient = 'asterias.apartments.koronisia@gmail.com';
          this.logger.warn('⚠️  No admin email configured, using hardcoded fallback for admin notifications');
        }
      } else {
        recipient = data.guestEmail || options.to;
      }
      
      if (!recipient) {
        throw new Error('No recipient email specified');
      }

      // Professional email templates with multilingual support
      const templates = {
        bookingConfirmation: {
          subject: (data: EmailData, lang: string) => t(lang, 'bookingConfirmation', 'subject'),
          html: (data: EmailData, lang: string) => `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${t(lang, 'bookingConfirmation', 'subject')}</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
                    .logo { font-size: 24px; font-weight: bold; color: #007bff; }
                    .content { margin-bottom: 30px; }
                    .booking-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 5px 0; border-bottom: 1px solid #dee2e6; }
                    .detail-label { font-weight: bold; color: #495057; }
                    .detail-value { color: #212529; }
                    .arrival-info { background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff; }
                    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
                    .contact { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">🏠 Asterias Homes</div>
                </div>
                
                <div class="content">
                    <h2>${t(lang, 'bookingConfirmation', 'greeting')} ${data.guestName},</h2>
                    <p>${t(lang, 'bookingConfirmation', 'confirmationText')}</p>
                    
                    <div class="booking-details">
                        <h3>${t(lang, 'bookingConfirmation', 'bookingDetails')}</h3>
                        <div class="detail-row">
                            <span class="detail-label">${t(lang, 'bookingConfirmation', 'bookingCode')}:</span>
                            <span class="detail-value">${data.bookingId}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">${t(lang, 'bookingConfirmation', 'room')}:</span>
                            <span class="detail-value">${data.roomName}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">${t(lang, 'bookingConfirmation', 'arrival')}:</span>
                            <span class="detail-value">${new Date(data.checkIn).toLocaleDateString(lang === 'el' ? 'el-GR' : lang === 'de' ? 'de-DE' : 'en-US')}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">${t(lang, 'bookingConfirmation', 'departure')}:</span>
                            <span class="detail-value">${new Date(data.checkOut).toLocaleDateString(lang === 'el' ? 'el-GR' : lang === 'de' ? 'de-DE' : 'en-US')}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">${t(lang, 'bookingConfirmation', 'guests')}:</span>
                            <span class="detail-value">${data.guests || '2'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">${t(lang, 'bookingConfirmation', 'totalCost')}:</span>
                            <span class="detail-value">€${data.totalPrice}</span>
                        </div>
                    </div>
                    
                    <div class="arrival-info">
                        <h3>${t(lang, 'bookingConfirmation', 'arrivalInfo')}</h3>
                        <p><strong>${t(lang, 'bookingConfirmation', 'address')}:</strong> Κορωνησία, Άρτα, Ελλάδα</p>
                        <p><strong>${t(lang, 'bookingConfirmation', 'checkIn')}:</strong> 15:00</p>
                        <p><strong>${t(lang, 'bookingConfirmation', 'checkOut')}:</strong> 11:00</p>
                    </div>
                    
                    <div class="contact">
                        <p>${t(lang, 'bookingConfirmation', 'questionsText')}</p>
                        <p>${t(lang, 'bookingConfirmation', 'contactInfo')}</p>
                    </div>
                    
                    <p><strong>${t(lang, 'bookingConfirmation', 'lookingForward')}</strong></p>
                </div>
                
                <div class="footer">
                    <p>${t(lang, 'bookingConfirmation', 'doNotReply')}</p>
                    <p>${t(lang, 'bookingConfirmation', 'footer')}</p>
                </div>
            </body>
            </html>
          `,
          text: (data: EmailData, lang: string) => `
${t(lang, 'bookingConfirmation', 'subject')}

${t(lang, 'bookingConfirmation', 'greeting')} ${data.guestName},

${t(lang, 'bookingConfirmation', 'confirmationText')}

${t(lang, 'bookingConfirmation', 'bookingDetails')}:
${t(lang, 'bookingConfirmation', 'bookingCode')}: ${data.bookingId}
${t(lang, 'bookingConfirmation', 'room')}: ${data.roomName}
${t(lang, 'bookingConfirmation', 'arrival')}: ${new Date(data.checkIn).toLocaleDateString(lang === 'el' ? 'el-GR' : lang === 'de' ? 'de-DE' : 'en-US')}
${t(lang, 'bookingConfirmation', 'departure')}: ${new Date(data.checkOut).toLocaleDateString(lang === 'el' ? 'el-GR' : lang === 'de' ? 'de-DE' : 'en-US')}
${t(lang, 'bookingConfirmation', 'guests')}: ${data.guests || '2'}
${t(lang, 'bookingConfirmation', 'totalCost')}: €${data.totalPrice}

${t(lang, 'bookingConfirmation', 'arrivalInfo')}:
${t(lang, 'bookingConfirmation', 'address')}: Κορωνησία, Άρτα, Ελλάδα
${t(lang, 'bookingConfirmation', 'checkIn')}: 15:00
${t(lang, 'bookingConfirmation', 'checkOut')}: 11:00

${t(lang, 'bookingConfirmation', 'questionsText')}
${t(lang, 'bookingConfirmation', 'contactInfo')}

${t(lang, 'bookingConfirmation', 'lookingForward')}

---
${t(lang, 'bookingConfirmation', 'footer')}
${t(lang, 'bookingConfirmation', 'doNotReply')}
          `
        },
        arrivalReminder: {
          subject: (data: EmailData, lang: string) => t(lang, 'arrivalReminder', 'subject'),
          html: (data: EmailData, lang: string) => `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${t(lang, 'arrivalReminder', 'subject')}</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; border-bottom: 2px solid #28a745; padding-bottom: 20px; margin-bottom: 30px; }
                    .logo { font-size: 24px; font-weight: bold; color: #28a745; }
                    .content { margin-bottom: 30px; }
                    .reminder-box { background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
                    .arrival-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 5px 0; border-bottom: 1px solid #dee2e6; }
                    .detail-label { font-weight: bold; color: #495057; }
                    .detail-value { color: #212529; }
                    .important-info { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
                    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
                    .contact { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">🏠 Asterias Homes</div>
                </div>
                
                <div class="content">
                    <div class="reminder-box">
                        <h2>📅 ${t(lang, 'arrivalReminder', 'greeting')} ${data.guestName},</h2>
                        <p>${t(lang, 'arrivalReminder', 'reminderText')}</p>
                    </div>
                    
                    <div class="arrival-details">
                        <h3>${t(lang, 'arrivalReminder', 'arrivalDetails')}</h3>
                        <div class="detail-row">
                            <span class="detail-label">${t(lang, 'arrivalReminder', 'date')}:</span>
                            <span class="detail-value">${new Date(data.checkIn).toLocaleDateString(lang === 'el' ? 'el-GR' : lang === 'de' ? 'de-DE' : 'en-US')}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">${t(lang, 'arrivalReminder', 'time')}:</span>
                            <span class="detail-value">15:00</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">${t(lang, 'arrivalReminder', 'room')}:</span>
                            <span class="detail-value">${data.roomName}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">${t(lang, 'arrivalReminder', 'bookingCode')}:</span>
                            <span class="detail-value">${data.bookingId}</span>
                        </div>
                    </div>
                    
                    <div class="important-info">
                        <h3>${t(lang, 'arrivalReminder', 'importantInfo')}</h3>
                        <p><strong>${t(lang, 'arrivalReminder', 'address')}:</strong> Κορωνησία, Άρτα, Ελλάδα</p>
                        <p><strong>${t(lang, 'arrivalReminder', 'keyPickup')}:</strong> ${t(lang, 'arrivalReminder', 'keyPickupText')}</p>
                        <p><strong>${t(lang, 'arrivalReminder', 'phone')}:</strong> +30 6972705881</p>
                    </div>
                    
                    <div class="contact">
                        <p>${t(lang, 'arrivalReminder', 'contactInfo')}</p>
                    </div>
                    
                    <p><strong>${t(lang, 'arrivalReminder', 'goodTrip')}</strong></p>
                </div>
                
                <div class="footer">
                    <p>${t(lang, 'arrivalReminder', 'doNotReply')}</p>
                    <p>${t(lang, 'arrivalReminder', 'footer')}</p>
                </div>
            </body>
            </html>
          `,
          text: (data: EmailData, lang: string) => `
${t(lang, 'arrivalReminder', 'subject')}

${t(lang, 'arrivalReminder', 'greeting')} ${data.guestName},

${t(lang, 'arrivalReminder', 'reminderText')}

${t(lang, 'arrivalReminder', 'arrivalDetails')}:
${t(lang, 'arrivalReminder', 'date')}: ${new Date(data.checkIn).toLocaleDateString(lang === 'el' ? 'el-GR' : lang === 'de' ? 'de-DE' : 'en-US')}
${t(lang, 'arrivalReminder', 'time')}: 15:00
${t(lang, 'arrivalReminder', 'room')}: ${data.roomName}
${t(lang, 'arrivalReminder', 'bookingCode')}: ${data.bookingId}

${t(lang, 'arrivalReminder', 'importantInfo')}:
${t(lang, 'arrivalReminder', 'address')}: Κορωνησία, Άρτα, Ελλάδα
${t(lang, 'arrivalReminder', 'keyPickup')}: ${t(lang, 'arrivalReminder', 'keyPickupText')}
${t(lang, 'arrivalReminder', 'phone')}: +30 6972705881

${t(lang, 'arrivalReminder', 'contactInfo')}

${t(lang, 'arrivalReminder', 'goodTrip')}

---
${t(lang, 'arrivalReminder', 'footer')}
${t(lang, 'arrivalReminder', 'doNotReply')}
          `
        },
        newBookingAlert: {
          subject: (data: EmailData, lang: string) => t(lang, 'newBookingAlert', 'subject'),
          html: (data: EmailData, lang: string) => `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${t(lang, 'newBookingAlert', 'subject')}</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; border-bottom: 2px solid #dc3545; padding-bottom: 20px; margin-bottom: 30px; }
                    .alert-box { background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545; }
                    .booking-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 5px 0; border-bottom: 1px solid #dee2e6; }
                    .detail-label { font-weight: bold; color: #495057; }
                    .detail-value { color: #212529; }
                    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">🏠 Asterias Homes Admin</div>
                </div>
                
                <div class="alert-box">
                    <h2>${t(lang, 'newBookingAlert', 'title')}</h2>
                </div>
                
                <div class="booking-details">
                    <h3>${t(lang, 'newBookingAlert', 'bookingDetails')}</h3>
                    <div class="detail-row">
                        <span class="detail-label">${t(lang, 'newBookingAlert', 'code')}:</span>
                        <span class="detail-value">${data.bookingId}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">${t(lang, 'newBookingAlert', 'customer')}:</span>
                        <span class="detail-value">${data.guestName}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">${t(lang, 'newBookingAlert', 'email')}:</span>
                        <span class="detail-value">${data.guestEmail}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">${t(lang, 'newBookingAlert', 'phone')}:</span>
                        <span class="detail-value">${data.guestPhone}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">${t(lang, 'newBookingAlert', 'room')}:</span>
                        <span class="detail-value">${data.roomName}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">${t(lang, 'newBookingAlert', 'arrival')}:</span>
                        <span class="detail-value">${new Date(data.checkIn).toLocaleDateString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">${t(lang, 'newBookingAlert', 'departure')}:</span>
                        <span class="detail-value">${new Date(data.checkOut).toLocaleDateString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">${t(lang, 'newBookingAlert', 'guests')}:</span>
                        <span class="detail-value">${data.guests}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">${t(lang, 'newBookingAlert', 'total')}:</span>
                        <span class="detail-value">€${data.totalPrice}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">${t(lang, 'newBookingAlert', 'bookedAt')}:</span>
                        <span class="detail-value">${new Date(data.createdAt).toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="footer">
                    <p>This is an automated admin notification from Asterias Homes</p>
                </div>
            </body>
            </html>
          `,
          text: (data: EmailData, lang: string) => `
${t(lang, 'newBookingAlert', 'subject')}

${t(lang, 'newBookingAlert', 'title')}

${t(lang, 'newBookingAlert', 'bookingDetails')}:
${t(lang, 'newBookingAlert', 'code')}: ${data.bookingId}
${t(lang, 'newBookingAlert', 'customer')}: ${data.guestName}
${t(lang, 'newBookingAlert', 'email')}: ${data.guestEmail}
${t(lang, 'newBookingAlert', 'phone')}: ${data.guestPhone}
${t(lang, 'newBookingAlert', 'room')}: ${data.roomName}
${t(lang, 'newBookingAlert', 'arrival')}: ${new Date(data.checkIn).toLocaleDateString()}
${t(lang, 'newBookingAlert', 'departure')}: ${new Date(data.checkOut).toLocaleDateString()}
${t(lang, 'newBookingAlert', 'guests')}: ${data.guests}
${t(lang, 'newBookingAlert', 'total')}: €${data.totalPrice}
${t(lang, 'newBookingAlert', 'bookedAt')}: ${new Date(data.createdAt).toLocaleString()}

---
Automated admin notification from Asterias Homes
          `
        }
      };

      const template = templates[type];
      if (!template) {
        throw new Error(`Unknown email template: ${type}`);
      }

      const mailOptions = {
        from: `"Asterias Homes" <${this.configService.get('EMAIL_USER') || 'asterias.apartments.koronisia@gmail.com'}>`,
        to: recipient,
        subject: template.subject(data, language),
        html: template.html(data, language),
        text: template.text(data, language)
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully: ${type} to ${recipient} in ${language.toUpperCase()}`);
      
      return { 
        success: true, 
        messageId: result.messageId,
        message: `Email sent to ${recipient}`,
        language: language
      };

    } catch (error) {
      this.logger.error('Email sending failed:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'Email sending failed'
      };
    }
  }

  async sendBookingConfirmation(bookingData: EmailData, options: { language?: string; request?: any } = {}): Promise<EmailResult> {
    return await this.sendEmail('bookingConfirmation', bookingData, options);
  }

  async sendNewBookingAlert(bookingData: EmailData, options: { to?: string } = {}): Promise<EmailResult> {
    this.logger.log('📧 Sending new booking alert email to admin', {
      bookingId: bookingData.bookingId,
      guestName: bookingData.guestName,
      guestEmail: bookingData.guestEmail,
      roomName: bookingData.roomName
    });
    
    const result = await this.sendEmail('newBookingAlert', bookingData, options);
    
    if (result.success) {
      this.logger.log('✅ New booking alert sent successfully to admin');
    } else {
      this.logger.error('❌ Failed to send new booking alert to admin:', result.error || result.message);
    }
    
    return result;
  }

  async sendTestEmail(type = 'bookingConfirmation', language = 'el'): Promise<EmailResult> {
    const testData: EmailData = {
      bookingId: 'TEST123',
      guestName: 'Test Customer',
      guestEmail: this.configService.get('ADMIN_EMAIL'),
      guestPhone: '+30 123 456 7890',
      roomName: 'Traditional Apartment',
      checkIn: new Date(Date.now() + 24 * 60 * 60 * 1000),
      checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      checkInTime: '15:00',
      checkOutTime: '11:00',
      guests: 2,
      totalPrice: 150,
      status: 'confirmed',
      createdAt: new Date()
    };

    this.logger.log(`Sending test email (${type}) in ${language.toUpperCase()}...`);
    return await this.sendEmail(type, testData, { language });
  }
}
