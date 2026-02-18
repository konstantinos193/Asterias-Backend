import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Booking, BookingDocument } from '../models/booking.model';
import { Room, RoomDocument } from '../models/room.model';
import puppeteer from 'puppeteer';

@Injectable()
export class PdfService {
  constructor(
    @InjectModel('Booking') private bookingModel: Model<BookingDocument>,
    @InjectModel('Room') private roomModel: Model<RoomDocument>,
  ) {}

  async generateBookingConfirmationPdf(bookingId: string): Promise<Buffer> {
    // Get booking with room details
    const booking = await this.bookingModel.findById(bookingId).populate('roomId').exec();
    
    if (!booking) {
      throw new Error('Booking not found');
    }

    const room = booking.roomId as any; // Type assertion since populate returns mixed type
    
    // Generate HTML for the PDF
    const html = this.generateBookingConfirmationHtml(booking, room);
    
    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
      });
      
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  private generateBookingConfirmationHtml(booking: BookingDocument, room: any): string {
    const checkIn = new Date(booking.checkIn).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const checkOut = new Date(booking.checkOut).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const nights = Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24));
    
    const language = booking.guestInfo.language || 'en';
    
    // Translations
    const translations = {
      en: {
        title: 'Booking Confirmation',
        bookingNumber: 'Booking Number',
        guestInfo: 'Guest Information',
        roomDetails: 'Room Details',
        bookingDetails: 'Booking Details',
        paymentDetails: 'Payment Details',
        checkIn: 'Check-in',
        checkOut: 'Check-out',
        nights: 'Nights',
        guests: 'Guests',
        adults: 'Adults',
        children: 'Children',
        roomType: 'Room Type',
        totalPrice: 'Total Price',
        paymentMethod: 'Payment Method',
        paymentStatus: 'Payment Status',
        specialRequests: 'Special Requests',
        thankYou: 'Thank you for choosing Asterias Homes!',
        contactInfo: 'For any questions, please contact us at:',
        confirmation: 'This is your booking confirmation. Please keep it for your records.'
      },
      el: {
        title: 'Επιβεβαίωση Κράτησης',
        bookingNumber: 'Αριθμός Κράτησης',
        guestInfo: 'Πληροφορίες Επισκέπτη',
        roomDetails: 'Λεπτομέρειες Δωματίου',
        bookingDetails: 'Λεπτομέρειες Κράτησης',
        paymentDetails: 'Λεπτομέρειες Πληρωμής',
        checkIn: 'Άφιξη',
        checkOut: 'Αναχώρηση',
        nights: 'Νύχτες',
        guests: 'Επισκέπτες',
        adults: 'Ενήλικες',
        children: 'Παιδιά',
        roomType: 'Τύπος Δωματίου',
        totalPrice: 'Συνολική Τιμή',
        paymentMethod: 'Τρόπος Πληρωμής',
        paymentStatus: 'Κατάσταση Πληρωμής',
        specialRequests: 'Ειδικές Απαιτήσεις',
        thankYou: 'Σας ευχαριστούμε που επιλέξατε τις Asterias Homes!',
        contactInfo: 'Για οποιαδήποτε ερώτηση, παρακαλώ επικοινωνήστε μαζί μας:',
        confirmation: 'Αυτή είναι η επιβεβαίωση της κράτησής σας. Παρακαλώ κρατήστε την για τα αρχεία σας.'
      },
      de: {
        title: 'Buchungsbestätigung',
        bookingNumber: 'Buchungsnummer',
        guestInfo: 'Gastinformationen',
        roomDetails: 'Zimmerdetails',
        bookingDetails: 'Buchungsdetails',
        paymentDetails: 'Zahlungsdetails',
        checkIn: 'Anreise',
        checkOut: 'Abreise',
        nights: 'Nächte',
        guests: 'Gäste',
        adults: 'Erwachsene',
        children: 'Kinder',
        roomType: 'Zimmertyp',
        totalPrice: 'Gesamtpreis',
        paymentMethod: 'Zahlungsmethode',
        paymentStatus: 'Zahlungsstatus',
        specialRequests: 'Besondere Wünsche',
        thankYou: 'Vielen Dank, dass Sie sich für Asterias Homes entschieden haben!',
        contactInfo: 'Bei Fragen kontaktieren Sie uns bitte unter:',
        confirmation: 'Dies ist Ihre Buchungsbestätigung. Bitte bewahren Sie sie für Ihre Unterlagen auf.'
      }
    };

    const t = translations[language] || translations.en;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${t.title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #007bff;
            margin: 0;
            font-size: 28px;
          }
          .section {
            margin-bottom: 25px;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background-color: #f9f9f9;
          }
          .section h2 {
            color: #007bff;
            margin-top: 0;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 5px 0;
          }
          .label {
            font-weight: bold;
            color: #555;
          }
          .value {
            color: #333;
          }
          .total {
            font-weight: bold;
            font-size: 18px;
            color: #007bff;
            border-top: 2px solid #007bff;
            padding-top: 10px;
            margin-top: 15px;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-style: italic;
            color: #666;
          }
          .status-paid {
            color: #28a745;
            font-weight: bold;
          }
          .status-pending {
            color: #ffc107;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${t.title}</h1>
          <p><strong>${t.bookingNumber}:</strong> ${booking.bookingNumber}</p>
        </div>

        <div class="section">
          <h2>${t.guestInfo}</h2>
          <div class="row">
            <span class="label">${t.guestInfo}:</span>
            <span class="value">${booking.guestInfo.firstName} ${booking.guestInfo.lastName}</span>
          </div>
          <div class="row">
            <span class="label">Email:</span>
            <span class="value">${booking.guestInfo.email}</span>
          </div>
          <div class="row">
            <span class="label">Phone:</span>
            <span class="value">${booking.guestInfo.phone}</span>
          </div>
          ${booking.guestInfo.specialRequests ? `
          <div class="row">
            <span class="label">${t.specialRequests}:</span>
            <span class="value">${booking.guestInfo.specialRequests}</span>
          </div>
          ` : ''}
        </div>

        <div class="section">
          <h2>${t.roomDetails}</h2>
          <div class="row">
            <span class="label">${t.roomType}:</span>
            <span class="value">${room.name}</span>
          </div>
          <div class="row">
            <span class="label">Description:</span>
            <span class="value">${room.description}</span>
          </div>
          <div class="row">
            <span class="label">Capacity:</span>
            <span class="value">${room.capacity} guests</span>
          </div>
        </div>

        <div class="section">
          <h2>${t.bookingDetails}</h2>
          <div class="row">
            <span class="label">${t.checkIn}:</span>
            <span class="value">${checkIn}</span>
          </div>
          <div class="row">
            <span class="label">${t.checkOut}:</span>
            <span class="value">${checkOut}</span>
          </div>
          <div class="row">
            <span class="label">${t.nights}:</span>
            <span class="value">${nights}</span>
          </div>
          <div class="row">
            <span class="label">${t.guests}:</span>
            <span class="value">${booking.adults} ${t.adults}${booking.children > 0 ? `, ${booking.children} ${t.children}` : ''}</span>
          </div>
        </div>

        <div class="section">
          <h2>${t.paymentDetails}</h2>
          <div class="row">
            <span class="label">${t.paymentMethod}:</span>
            <span class="value">${booking.paymentMethod === 'CARD' ? 'Credit Card' : 'Cash'}</span>
          </div>
          <div class="row">
            <span class="label">${t.paymentStatus}:</span>
            <span class="value ${booking.paymentStatus === 'PAID' ? 'status-paid' : 'status-pending'}">
              ${booking.paymentStatus}
            </span>
          </div>
          <div class="row total">
            <span class="label">${t.totalPrice}:</span>
            <span class="value">€${booking.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <div class="footer">
          <p><strong>${t.thankYou}</strong></p>
          <p>${t.confirmation}</p>
          <p>${t.contactInfo} asteriashomes.bookings@gmail.com</p>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `;
  }
}
