import { BookingWriter } from '../bookings/domain/booking-writer.service';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from '../models/room.model';
import { Booking, BookingDocument } from '../models/booking.model';
import { BookingNumberService } from '../common/booking-number/booking-number.service';
import {
  BOOKING_SOURCE,
  BOOKING_STATUS,
  GUEST_LANGUAGE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
} from '../common/enums';
import * as crypto from 'crypto';

@Injectable()
export class BookingComWebhookService {
  private readonly logger = new Logger(BookingComWebhookService.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly writer: BookingWriter,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    private readonly bookingNumbers: BookingNumberService,
  ) {
    this.webhookSecret = process.env.BOOKINGCOM_WEBHOOK_SECRET;
    if (!this.webhookSecret) {
      this.logger.warn('BOOKINGCOM_WEBHOOK_SECRET environment variable is not set');
    }
  }

  /**
   * Verify the webhook signature over the exact bytes that were signed.
   *
   * This used to hash `JSON.stringify(parsedBody)` — the body after Express had
   * parsed it and JSON.stringify had re-serialised it. Key order, whitespace
   * and number formatting all differ across that round trip, so the digest
   * could not match a real signature and the endpoint rejected every genuine
   * delivery. A signature is over bytes, so the bytes have to be kept.
   *
   * The Stripe path already does this correctly: main.ts enables `rawBody: true`
   * on the Nest application and PaymentsService verifies against req.rawBody.
   * This is the same treatment.
   */
  verifyWebhookSignature(signature: string | undefined, rawBody: Buffer | undefined): boolean {
    if (!this.webhookSecret) {
      this.logger.error('Webhook secret not configured; refusing the delivery');
      return false;
    }

    if (!signature) {
      this.logger.error('No signature found in request headers');
      return false;
    }

    if (!rawBody?.length) {
      // Without the raw body there is nothing to verify, and verifying the
      // re-serialised body is what was broken. Refuse rather than guess.
      this.logger.error('No raw body available; cannot verify the signature');
      return false;
    }

    try {
      const digest =
        'sha256=' +
        crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');

      const received = Buffer.from(signature);
      const expected = Buffer.from(digest);

      // timingSafeEqual throws on a length mismatch rather than returning
      // false, so the lengths are compared first — and compared on the digest,
      // which is a fixed size, so this leaks nothing about the secret.
      const isValid =
        received.length === expected.length && crypto.timingSafeEqual(received, expected);

      if (!isValid) {
        this.logger.error('Invalid webhook signature');
      }

      return isValid;
    } catch (error) {
      this.logger.error(
        `Error verifying webhook signature: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }

  /**
   * Process booking creation webhook from Booking.com
   */
  async processBookingCreated(notification: any): Promise<any> {
    const externalBooking = notification.data;

    try {
      const room = await this.roomModel.findOne({ bookingcom_room_id: externalBooking.room_id });
      if (!room) {
        this.logger.warn(`Webhook received for a room not mapped in our system: ${externalBooking.room_id}`);
        return { status: 'success', message: 'Webhook received for unmapped room.' };
      }

      // The OTA's own reference, through the shared generator so there is one
      // place that decides what a booking number looks like.
      const bookingNumber = this.bookingNumbers.external('BCM', externalBooking.booking_id);

      const newBooking = await this.writer.create({
        bookingNumber,
        roomId: room._id,
        bookingcom_booking_id: externalBooking.booking_id,
        guestInfo: {
          firstName: externalBooking.guest_details.first_name,
          lastName: externalBooking.guest_details.last_name,
          email: externalBooking.guest_details.email,
          phone: externalBooking.guest_details.phone,
          specialRequests: '',
          language: GUEST_LANGUAGE.EN,
        },
        checkIn: externalBooking.checkin_date,
        checkOut: externalBooking.checkout_date,
        // The OTA is authoritative for an OTA booking: its price is what the
        // guest was charged, by Booking.com, and recomputing it here would
        // record a figure nobody was billed. Likewise no assertSellable — the
        // stay already exists at the channel, so refusing it would not free
        // the room, it would only lose the record of it. This is deliberate,
        // and is the difference between this path and every other
        // booking-creation site.
        totalAmount: externalBooking.total_price,
        adults: externalBooking.adults,
        children: externalBooking.children || 0,
        bookingStatus: BOOKING_STATUS.CONFIRMED,
        source: BOOKING_SOURCE.BOOKINGCOM,
        paymentMethod: PAYMENT_METHOD.CARD,
        paymentStatus: PAYMENT_STATUS.PAID,
      }, { pricing: 'external', inventory: 'override' });
      this.logger.log(`Successfully created booking ${newBooking._id} from Booking.com webhook.`);
      return { status: 'success', message: 'Booking created successfully', bookingId: newBooking._id };

    } catch (error: any) {
      // Duplicate key on bookingcom_booking_id or bookingNumber means webhook was already processed
      if (error.code === 11000) {
        this.logger.log(`Duplicate webhook for Booking.com booking ${externalBooking.booking_id} — ignoring.`);
        return { status: 'success', message: 'Booking already processed.' };
      }
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
