import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from '../models/room.model';
import { Booking, BookingDocument } from '../models/booking.model';
import * as crypto from 'crypto';

@Injectable()
export class BookingComWebhookService {
  private readonly logger = new Logger(BookingComWebhookService.name);
  private readonly webhookSecret: string;

  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>
  ) {
    this.webhookSecret = process.env.BOOKINGCOM_WEBHOOK_SECRET;
    if (!this.webhookSecret) {
      this.logger.warn('BOOKINGCOM_WEBHOOK_SECRET environment variable is not set');
    }
  }

  /**
   * Verify the webhook signature from Booking.com
   * @param signature - The signature from the request headers
   * @param body - The request body
   * @returns boolean - True if signature is valid
   */
  verifyWebhookSignature(signature: string, body: any): boolean {
    if (!this.webhookSecret) {
      this.logger.error('Webhook secret not configured');
      return false;
    }

    if (!signature) {
      this.logger.error('No signature found in request headers');
      return false;
    }

    try {
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      const digest = 'sha256=' + hmac.update(JSON.stringify(body)).digest('hex');

      const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
      
      if (!isValid) {
        this.logger.error('Invalid webhook signature');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Process booking creation webhook from Booking.com
   * @param notification - The webhook notification data
   * @returns Promise<any> - Processing result
   */
  async processBookingCreated(notification: any): Promise<any> {
    const externalBooking = notification.data;

    try {
      // Find our internal room using the ID from Booking.com
      const room = await this.roomModel.findOne({ bookingcom_room_id: externalBooking.room_id });

      if (!room) {
        this.logger.warn(`Webhook received for a room not mapped in our system: ${externalBooking.room_id}`);
        // Acknowledge receipt so Booking.com doesn't keep retrying.
        return { status: 'success', message: 'Webhook received for unmapped room.' };
      }

      // Prevent duplicate bookings from repeated webhooks
      const existingBooking = await this.bookingModel.findOne({ bookingcom_booking_id: externalBooking.booking_id });
      if (existingBooking) {
        this.logger.log(`Booking ${externalBooking.booking_id} from Booking.com already exists.`);
        return { status: 'success', message: 'Booking already processed.' };
      }

      // Create a new booking in our system based on the webhook data
      const newBooking = new this.bookingModel({
        roomId: room._id,
        bookingcom_booking_id: externalBooking.booking_id,
        guestInfo: {
          firstName: externalBooking.guest_details.first_name,
          lastName: externalBooking.guest_details.last_name,
          email: externalBooking.guest_details.email,
          phone: externalBooking.guest_details.phone,
          specialRequests: '',
          language: 'en' // Default language, could be enhanced
        },
        checkIn: externalBooking.checkin_date,
        checkOut: externalBooking.checkout_date,
        totalAmount: externalBooking.total_price,
        adults: externalBooking.adults,
        children: externalBooking.children || 0,
        bookingStatus: 'CONFIRMED',
        source: 'bookingcom',
        paymentMethod: 'CARD', // Assuming card payment for Booking.com
        paymentStatus: 'PAID' // Assuming paid for Booking.com
      });

      await newBooking.save();
      this.logger.log(`Successfully created booking ${newBooking._id} from Booking.com webhook.`);

      return { 
        status: 'success', 
        message: 'Booking created successfully',
        bookingId: newBooking._id 
      };

    } catch (error) {
      this.logger.error('Error processing Booking.com webhook:', error);
      throw error;
    }
  }

  /**
   * Process webhook notification based on event type
   * @param notification - The webhook notification
   * @returns Promise<any> - Processing result
   */
  async processNotification(notification: any): Promise<any> {
    this.logger.log(`Processing Booking.com webhook event: ${notification.event}`);

    switch (notification.event) {
      case 'booking.created':
        return await this.processBookingCreated(notification);
      
      case 'booking.modified':
        // Handle booking modifications
        this.logger.log('Booking modification received - not implemented yet');
        return { status: 'success', message: 'Booking modification received' };
      
      case 'booking.cancelled':
        // Handle booking cancellations
        this.logger.log('Booking cancellation received - not implemented yet');
        return { status: 'success', message: 'Booking cancellation received' };
      
      default:
        this.logger.warn(`Unknown webhook event type: ${notification.event}`);
        return { status: 'success', message: 'Unknown event type received' };
    }
  }
}
