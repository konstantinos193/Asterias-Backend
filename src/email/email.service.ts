import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { t } from '../translations/translations';
import { SettingsService } from '../settings/settings.service';

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

/**
 * The outcome of an attempt to send.
 *
 * `success` means a transporter accepted the message, and nothing else — a
 * caller that records "the guest has been emailed" must check it. Several did
 * not, and because sendEmail() returns errors as values rather than throwing,
 * `await` resolved on failure and the flag was set anyway.
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  message?: string;
  error?: string;
  language?: string;
  /** True when a development logging transporter handled it, so nothing was actually sent. */
  simulated?: boolean;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  initializeTransporter(): void {
    try {
      // Priority 1: Use existing SMTP configuration from .env
      if (this.configService.get('SMTP_HOST') && this.configService.get('SMTP_USER') && this.configService.get('SMTP_PASS')) {
        this.transporter = nodemailer.createTransport({
          host: this.configService.get('SMTP_HOST'),
          port: this.configService.get('SMTP_PORT') || 587,
          secure: Number(this.configService.get('SMTP_PORT') || 587) === 465,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 60000,
          auth: {
            user: this.configService.get('SMTP_USER'),
            pass: this.configService.get('SMTP_PASS')
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
      // No credentials at all.
      //
      // In development this installs a transporter that logs instead of
      // sending, which is what makes the app runnable without SMTP. In
      // production it is a hard failure: a black-hole transporter there means
      // every booking confirmation reports success and no guest ever hears
      // back, with nothing to alert on. Config validation already requires
      // SMTP_* in production, so reaching this branch means something stripped
      // them after boot.
      else {
        if (this.isProduction) {
          throw new Error(
            'No SMTP credentials configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.',
          );
        }
        this.transporter = this.createLoggingTransporter('DEV MODE');
        this.logger.warn(
          'Email transporter running in development mode — messages are logged, not sent',
        );
      }
    } catch (error: any) {
      this.logger.error(`Failed to initialize email transporter: ${error.message}`);

      // This was the dangerous one. It was not gated on NODE_ENV, so if SMTP
      // credentials were wrong or createTransport threw in production, the
      // service installed a transporter that discarded every message and
      // reported `{ success: true, messageId: 'fallback-...' }` forever.
      //
      // In production the failure is now raised: it happens during bootstrap,
      // so the container exits and the blue/green cutover does not promote an
      // instance that cannot email anyone.
      if (this.isProduction) {
        throw error;
      }

      this.transporter = this.createLoggingTransporter('FALLBACK MODE');
      this.logger.warn('Email transporter fell back to logging mode — messages are not sent');
    }
  }

  async verifyTransporter(): Promise<void> {
    if (this.isProduction) {
      if (!this.transporter) throw new Error('Email transporter is not initialized');
      await this.transporter.verify();
    }
  }

  private get isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  /**
   * A transporter that logs what would have been sent. Development only — see
   * initializeTransporter for why this must never be installed in production.
   */
  private createLoggingTransporter(label: string): nodemailer.Transporter {
    return {
      sendMail: async (mailOptions: any) => {
        this.logger.log(
          `[${label}] would send "${mailOptions.subject}" to ${mailOptions.to}`,
        );
        return {
          messageId: `${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          response: `Email logged (${label})`,
          simulated: true,
        } as any;
      },
    } as any;
  }

  /**
   * The address we are allowed to put in From: whichever account the
   * transporter actually authenticated as, in the same priority order as
   * initializeTransporter().
   */
  private senderAddress(): string {
    return (
      this.configService.get<string>('SMTP_USER') ||
      this.configService.get<string>('EMAIL_USER') ||
      'asterias.apartments.koronisia@gmail.com'
    );
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

  /**
   * Which admin setting switches each kind of email off.
   *
   * These flags existed in the settings schema and in the admin panel and
   * nothing read any of them: the owner could turn off email notifications and
   * every message kept going out. Checked in one place here rather than at each
   * call site, so a new caller is covered by default.
   *
   * A type absent from this map is not gated — the contact-form notification
   * and the admin's own test email are deliberate, one-off actions.
   */
  private static readonly EMAIL_TYPE_SETTINGS = {
    bookingConfirmation: 'bookingConfirmations',
    arrivalReminder: 'reminderNotifications',
    checkoutThankYou: 'reminderNotifications',
    newBookingAlert: 'newBookingAlerts',
    lowInventoryAlert: 'lowInventoryAlerts',
  } as const;

  async sendEmail(type: string, data: EmailData, options: { language?: string; request?: any; to?: string } = {}): Promise<EmailResult> {
    try {
      const setting = EmailService.EMAIL_TYPE_SETTINGS[type as keyof typeof EmailService.EMAIL_TYPE_SETTINGS];
      if (setting && !(await this.settingsService.isEmailEnabled(setting))) {
        this.logger.log(`Skipped ${type}: disabled by the ${setting} setting`);
        return { success: false, message: `Disabled by the ${setting} setting`, error: 'disabled' };
      }

      // No transporter means nothing was sent, so this must not report success.
      // It used to return `{ success: true, message: 'Email sent (simulated)' }`,
      // which callers that check `result.success` read as delivered — that is
      // how post-checkout review requests got marked sent without being sent.
      if (!this.transporter) {
        this.logger.error(
          `Email transporter not initialized; dropped ${type} to ${data.guestEmail || options.to}`,
        );
        return { success: false, error: 'Email transporter not initialized' };
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
        // Priority 3: fall back to the sending account, so an admin alert at
        // least lands somewhere we can read instead of an address nobody owns.
        else {
          recipient = this.senderAddress();
          this.logger.warn(`⚠️  ADMIN_EMAIL not set, sending admin notifications to ${recipient}`);
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
        checkoutThankYou: {
          subject: (data: EmailData, lang: string) => {
            if (lang === 'en') return 'Thank you for staying at Asterias Homes, Koronisia!';
            if (lang === 'de') return 'Danke für Ihren Aufenthalt in Asterias Homes, Koronisia!';
            return 'Ευχαριστούμε για την επίσκεψή σας στην Κορωνησία!';
          },
          html: (data: EmailData, lang: string) => {
            const greeting = lang === 'en' ? `Dear ${data.guestName},` : lang === 'de' ? `Liebe/r ${data.guestName},` : `Αγαπητέ/ή ${data.guestName},`;
            const body = lang === 'en'
              ? `<p>Thank you so much for staying at Asterias Homes!<br>We hope your time in Koronisia was as wonderful as we imagined.</p>
                 <p>If you enjoyed your stay, we'd greatly appreciate a review on Booking.com or Google.<br>Your feedback helps other travelers discover Koronisia.</p>
                 <p>We look forward to welcoming you again!</p>
                 <p><strong>Warm regards,<br>The Asterias Homes Team</strong></p>`
              : lang === 'de'
              ? `<p>Herzlichen Dank für Ihren Aufenthalt in Asterias Homes!<br>Wir hoffen, dass Ihre Zeit in Koronisia so wunderbar war, wie wir es uns vorgestellt haben.</p>
                 <p>Wenn Ihnen Ihr Aufenthalt gefallen hat, würden wir uns sehr über eine Bewertung auf Booking.com oder Google freuen.</p>
                 <p>Wir freuen uns darauf, Sie wieder bei uns begrüßen zu dürfen!</p>
                 <p><strong>Mit freundlichen Grüßen,<br>Das Asterias Homes Team</strong></p>`
              : `<p>Ευχαριστούμε θερμά για την επίσκεψή σας στα Asterias Homes!<br>Ελπίζουμε η διαμονή σας στην Κορωνησία να ήταν όσο υπέροχη φανταζόμασταν.</p>
                 <p>Αν σας άρεσε η εμπειρία σας, θα εκτιμούσαμε πολύ μια κριτική στο Booking.com ή Google.<br>Η γνώμη σας βοηθά άλλους ταξιδιώτες να ανακαλύψουν την Κορωνησία.</p>
                 <p>Ανυπομονούμε να σας φιλοξενήσουμε ξανά!</p>
                 <p><strong>Με εκτίμηση,<br>Η ομάδα των Asterias Homes<br>Τηλ: +30 26810 XXXXX<br>info@asteriashomes.gr</strong></p>`;
            return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${lang === 'en' ? 'Thank you for staying at Asterias Homes, Koronisia!' : lang === 'de' ? 'Danke für Ihren Aufenthalt in Asterias Homes, Koronisia!' : 'Ευχαριστούμε για την επίσκεψή σας στην Κορωνησία!'}</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
                    .logo { font-size: 24px; font-weight: bold; color: #007bff; }
                    .content { margin-bottom: 30px; }
                    .thank-you-box { background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff; }
                    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">🏠 Asterias Homes</div>
                </div>
                <div class="content">
                    <div class="thank-you-box">
                        <h2>${greeting}</h2>
                        ${body}
                    </div>
                </div>
                <div class="footer">
                    <p>Asterias Homes, Κορωνησία, Άρτα, Ελλάδα</p>
                </div>
            </body>
            </html>
          `;
          },
          text: (data: EmailData, lang: string) => {
            if (lang === 'en') {
              return `Dear ${data.guestName},

Thank you so much for staying at Asterias Homes!
We hope your time in Koronisia was as wonderful as we imagined.

If you enjoyed your stay, we'd greatly appreciate a review on Booking.com or Google.
Your feedback helps other travelers discover Koronisia.

We look forward to welcoming you again!

Warm regards,
The Asterias Homes Team`;
            }
            if (lang === 'de') {
              return `Liebe/r ${data.guestName},

Herzlichen Dank für Ihren Aufenthalt in Asterias Homes!
Wir hoffen, dass Ihre Zeit in Koronisia so wunderbar war, wie wir es uns vorgestellt haben.

Wenn Ihnen Ihr Aufenthalt gefallen hat, würden wir uns sehr über eine Bewertung auf Booking.com oder Google freuen.

Wir freuen uns darauf, Sie wieder bei uns begrüßen zu dürfen!

Mit freundlichen Grüßen,
Das Asterias Homes Team`;
            }
            return `Αγαπητέ/ή ${data.guestName},

Ευχαριστούμε θερμά για την επίσκεψή σας στα Asterias Homes!
Ελπίζουμε η διαμονή σας στην Κορωνησία να ήταν όσο υπέροχη φανταζόμασταν.

Αν σας άρεσε η εμπειρία σας, θα εκτιμούσαμε πολύ μια κριτική στο Booking.com ή Google.
Η γνώμη σας βοηθά άλλους ταξιδιώτες να ανακαλύψουν την Κορωνησία.

Ανυπομονούμε να σας φιλοξενήσουμε ξανά!

Με εκτίμηση,
Η ομάδα των Asterias Homes
Τηλ: +30 26810 XXXXX
info@asteriashomes.gr`;
          }
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
        // Must be the account we authenticated as: Gmail refuses (or silently
        // rewrites) a From it does not own, and production only sets SMTP_USER,
        // so reading EMAIL_USER first fell through to a third address that
        // belongs to nobody.
        from: `"Asterias Homes" <${this.senderAddress()}>`,
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
        language: language,
        simulated: (result as any)?.simulated === true,
      };

    } catch (error: any) {
      this.logger.error(`Email sending failed for ${type}: ${error.message}`);
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
    this.logger.log('Sending new booking alert email to admin', {
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

  /**
   * Contact form submissions were only written to Mongo, so nobody was ever
   * told one had arrived. Built inline rather than as a template because the
   * i18n helper returns the key itself on a miss, and this always goes to us
   * in Greek anyway.
   */
  async sendContactNotification(contact: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
  }): Promise<EmailResult> {
    if (!this.transporter) {
      this.logger.warn(`Email transporter not initialized, contact form from ${contact.email} not forwarded`);
      return { success: false, message: 'Transporter not initialized' };
    }

    const esc = (value: string) =>
      (value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const recipient =
      this.configService.get<string>('ADMIN_EMAIL') || this.senderAddress();

    const row = (label: string, value: string) =>
      `<tr><td style="padding:6px 12px;background:#f8f9fa;font-weight:bold">${esc(label)}</td>` +
      `<td style="padding:6px 12px">${value}</td></tr>`;

    try {
      const result = await this.transporter.sendMail({
        from: `"Asterias Homes" <${this.senderAddress()}>`,
        to: recipient,
        replyTo: contact.email || undefined,
        subject: `[Επικοινωνία] ${contact.subject || 'Νέο μήνυμα'} — ${contact.name}`,
        html: `
          <div style="font-family:Arial,sans-serif;font-size:14px;color:#333">
            <h2 style="font-size:17px">Νέο μήνυμα από τη φόρμα επικοινωνίας</h2>
            <table cellspacing="0" style="border-collapse:collapse;font-size:14px">
              ${row('Όνομα', esc(contact.name))}
              ${row('Email', `<a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>`)}
              ${contact.phone ? row('Τηλέφωνο', `<a href="tel:${esc(contact.phone)}">${esc(contact.phone)}</a>`) : ''}
              ${row('Θέμα', esc(contact.subject))}
            </table>
            <p style="margin-top:16px"><strong>Μήνυμα:</strong></p>
            <p style="white-space:pre-wrap">${esc(contact.message)}</p>
          </div>`,
        text:
          `Νέο μήνυμα από τη φόρμα επικοινωνίας\n\n` +
          `Όνομα: ${contact.name}\nEmail: ${contact.email}\n` +
          (contact.phone ? `Τηλέφωνο: ${contact.phone}\n` : '') +
          `Θέμα: ${contact.subject}\n\n${contact.message}\n`,
      });

      if (result.rejected?.length) {
        this.logger.error(`Contact notification rejected for: ${result.rejected.join(', ')}`);
      }
      this.logger.log(`Contact form from ${contact.email} forwarded to ${recipient}`);
      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      this.logger.error(`Failed to forward contact form from ${contact.email}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendCheckoutThankYou(data: EmailData, options: { language?: string; request?: any } = {}): Promise<EmailResult> {
    this.logger.log('Sending post-checkout thank-you email', {
      bookingId: data.bookingId,
      guestName: data.guestName,
      guestEmail: data.guestEmail
    });

    const result = await this.sendEmail('checkoutThankYou', data, options);

    if (result.success) {
      this.logger.log('Post-checkout thank-you email sent successfully');
    } else {
      this.logger.error(`Failed to send post-checkout thank-you email: ${result.error || result.message}`);
    }

    return result;
  }

  async sendTestEmail(type = 'bookingConfirmation', language = 'el'): Promise<EmailResult> {
    const settings = await this.settingsService.getEffectiveSettings();
    const testData: EmailData = {
      bookingId: 'TEST123',
      guestName: 'Test Customer',
      guestEmail: this.configService.get('ADMIN_EMAIL'),
      guestPhone: '+30 123 456 7890',
      roomName: 'Traditional Apartment',
      checkIn: new Date(Date.now() + 24 * 60 * 60 * 1000),
      checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      checkInTime: settings.checkInTime,
      checkOutTime: settings.checkOutTime,
      guests: 2,
      totalPrice: 150,
      status: 'confirmed',
      createdAt: new Date()
    };

    this.logger.log(`Sending test email (${type}) in ${language.toUpperCase()}...`);
    return await this.sendEmail(type, testData, { language });
  }
}
