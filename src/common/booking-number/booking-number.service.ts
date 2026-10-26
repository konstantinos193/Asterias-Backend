import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Counter, CounterDocument } from '../../models/counter.model';

/**
 * Booking numbers, in one place.
 *
 * There were three schemes. Two of them — in PaymentsService and in
 * CalendarBookingsRepository — were the same 11 lines duplicated byte for byte,
 * each reaching past Mongoose into a raw `counters` collection. The third was
 * `BCM-${external_id}` in the Booking.com webhook.
 *
 * `bookingNumber` is `unique: true` on the schema, so a collision is not a
 * cosmetic problem — it is a hard insert failure on a guest who has already
 * paid. Having one generator means the sequence is incremented in exactly one
 * way, and $inc with upsert is atomic, so concurrent callers across any number
 * of processes each get a distinct number.
 */
@Injectable()
export class BookingNumberService {
  constructor(@InjectModel(Counter.name) private readonly counterModel: Model<CounterDocument>) {}

  /**
   * The next booking number for the current year, as `AST-2026-001`.
   *
   * Zero-padded to three digits to match every booking number already issued.
   * Past 999 the number simply grows to four digits — `padStart` does not
   * truncate, so there is no collision, only a wider string.
   *
   * Pass the session when generating inside a transaction, so a rolled-back
   * booking does not leave a consumed number behind.
   */
  async next(session?: ClientSession): Promise<string> {
    const year = new Date().getFullYear();
    const counter = await this.counterModel.findOneAndUpdate(
      { _id: `booking:${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after', session },
    );
    return `AST-${year}-${String(counter.seq).padStart(3, '0')}`;
  }

  /**
   * The booking number for an OTA reservation, which carries the channel's own
   * identifier so a booking can be traced back to it.
   */
  external(prefix: string, externalId: string): string {
    return `${prefix}-${externalId}`;
  }
}
