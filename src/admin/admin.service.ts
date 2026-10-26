import { AdminReportingService } from './admin-reporting.service';
import {
  Inject,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking } from '../models/booking.model';
import { Room } from '../models/room.model';
import { RoomBlockedDate, RoomBlockedDateDocument } from '../models/room-blocked-date.model';
import { Contact } from '../models/contact.model';
import { User, UserDocument } from '../models/user.model';
import { SeasonalPricing, SeasonalPricingDocument } from '../models/seasonal-pricing.model';
import { OffersService } from '../offers/offers.service';
import { SettingsService } from '../settings/settings.service';
import { RoomsService } from '../rooms/rooms.service';
import { AvailabilityEngine } from '../availability/availability-engine';
import {
  OccupancyResult,
  addDays,
  dayKey,
  dayStart,
  summarizeProperty,
  todayAtProperty,
} from '../availability/availability-rules';
import { PricingService, RateCalendar } from '../pricing/pricing.service';
import Stripe from 'stripe';
import { STRIPE_CLIENT, StripeClient } from '../stripe/stripe.module';
import { BOOKING_STATUS, PAYMENT_STATUS, USER_ROLE } from '../common/enums';
import { UpdateBookingDto, UpdateRoomPricingDto, UpdateSettingsDto } from './dto/admin.dto';
import { CreateRoomDto } from '../rooms/dto/create-room.dto';
import { UpdateRoomDto } from '../rooms/dto/update-room.dto';
import { SETTINGS_DEFAULTS } from '../models/settings.model';
import { parseListLimit } from '../common/limits';
import {
  RefundReason,
  describeCardPayment,
  refundCardPayment,
  refundFields,
} from '../payments/stripe-refunds';
import { safeSort } from '../common/sort';

/** Fields a caller may sort the room list by. */
const ROOM_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'nameKey',
  'price',
  'capacity',
  'sortOrder',
  'available',
  'roomType',
] as const;

/** Fields a caller may sort the booking list by. */
const BOOKING_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'checkIn',
  'checkOut',
  'totalAmount',
  'bookingStatus',
  'paymentStatus',
  'bookingNumber',
] as const;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private stripe: InstanceType<typeof Stripe>;

  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<Booking>,
    @InjectModel(Room.name) private roomModel: Model<Room>,
    @InjectModel(RoomBlockedDate.name) private roomBlockedDateModel: Model<RoomBlockedDateDocument>,
    private readonly reporting: AdminReportingService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(SeasonalPricing.name) private seasonalModel: Model<SeasonalPricingDocument>,
    private offersService: OffersService,
    private settingsService: SettingsService,
    private roomsService: RoomsService,
    private pricingService: PricingService,
    private readonly availability: AvailabilityEngine,
    @Inject(STRIPE_CLIENT) stripe: StripeClient,
  ) {
    // One shared client — see StripeModule. This was a third independent
    // Stripe instance with its own configuration and no pinned API version.
    this.stripe = stripe;
  }

  getDashboard() { return this.reporting.getDashboard(); }
  getAnalytics(params: { period?: string; startDate?: string; endDate?: string }) {
    return this.reporting.getAnalytics(params);
  }
  getRevenueReports(period?: string) { return this.reporting.getRevenueReports(period); }

  async getBookings(params: any) {
    const {
      status,
      paymentStatus,
      checkIn,
      checkOut,
      guestEmail,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = params;
    // Capped here as well as in the controller: the ceiling belongs with the
    // query, so an internal caller cannot bypass it either.
    const limit = parseListLimit(params.limit);

    // Build filter
    const filter: any = {};
    if (status) filter.bookingStatus = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (checkIn) filter.checkIn = { $gte: new Date(checkIn) };
    if (checkOut) filter.checkOut = { $lte: new Date(checkOut) };
    if (guestEmail) {
      const escaped = guestEmail.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter['guestInfo.email'] = { $regex: `^${escaped}` };
    }

    // Build sort
    const sort = safeSort(sortBy, BOOKING_SORTABLE_FIELDS, 'createdAt', sortOrder);

    // Pagination
    const skip = (parseInt(page) - 1) * limit;

    const bookings = await this.bookingModel.find(filter)
      .populate('roomId', 'name')
      .populate('userId', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await this.bookingModel.countDocuments(filter);

    return {
      bookings,
      pagination: {
        page: parseInt(page),
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getBookingById(bookingId: string) {
    const booking = await this.bookingModel.findById(bookingId)
      .populate('roomId', 'name')
      .populate('userId', 'name email');
    
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    
    return booking;
  }

  /**
   * The payment behind a booking. Card payments are read live from Stripe, so a
   * refund made in the Stripe dashboard shows here too; the booking is brought
   * in line with Stripe when the two disagree.
   */
  async getBookingPayment(bookingId: string) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.paymentMethod === 'CARD' && booking.stripePaymentIntentId) {
      this.requireStripe();
      const { summary, charge } = await describeCardPayment(this.stripe, booking.stripePaymentIntentId);
      const fields = refundFields(charge);
      if (
        Math.abs((booking.refundAmount || 0) - fields.refundAmount) >= 0.005 ||
        (booking.paymentStatus === 'PAID' || booking.paymentStatus === 'REFUNDED') &&
          booking.paymentStatus !== fields.paymentStatus
      ) {
        await this.bookingModel.updateOne({ _id: booking._id }, fields);
      }
      return summary;
    }

    // Cash and manual bookings: nothing to ask Stripe, the booking is the record.
    const paid = booking.paymentStatus === 'PAID' || booking.paymentStatus === 'REFUNDED';
    const refunded = booking.refundAmount || 0;
    return {
      provider: 'manual' as const,
      paid,
      amount: booking.totalAmount || 0,
      amountRefunded: refunded,
      refundable: paid ? Math.max(0, (booking.totalAmount || 0) - refunded) : 0,
      fullyRefunded: booking.paymentStatus === 'REFUNDED',
    };
  }

  /**
   * Refunds part or all of what the guest paid, without cancelling the stay.
   * Card payments go back through Stripe; for cash the refund is only recorded,
   * since the money is handed back in person.
   */
  async refundBooking(
    bookingId: string,
    body: { amount?: number; reason?: RefundReason; note?: string },
  ) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (body.amount != null && !(Number(body.amount) > 0)) {
      throw new BadRequestException('Enter an amount above zero');
    }

    let update: Record<string, any>;
    let refundId: string | null = null;

    if (booking.paymentMethod === 'CARD' && booking.stripePaymentIntentId) {
      this.requireStripe();
      const { refund, charge } = await refundCardPayment(this.stripe, {
        paymentIntentId: booking.stripePaymentIntentId,
        bookingId,
        bookingNumber: booking.bookingNumber,
        amount: body.amount,
        reason: body.reason,
        note: body.note,
      });
      refundId = refund.id;
      update = refundFields(charge, refund.id);
      this.logger.log(`✅ Stripe refund ${refund.id} for booking ${booking.bookingNumber}: €${(refund.amount / 100).toFixed(2)}`);
    } else {
      if (booking.paymentStatus !== 'PAID') {
        throw new BadRequestException('Nothing has been paid on this booking');
      }
      const refundable = Math.max(0, (booking.totalAmount || 0) - (booking.refundAmount || 0));
      const amount = body.amount == null ? refundable : Number(body.amount);
      if (amount <= 0 || amount - refundable > 0.005) {
        throw new BadRequestException(`The refund must be between €0.01 and €${refundable.toFixed(2)}`);
      }
      const total = Math.round(((booking.refundAmount || 0) + amount) * 100) / 100;
      update = {
        refundAmount: total,
        refundedAt: new Date(),
        paymentStatus: total >= (booking.totalAmount || 0) - 0.005 ? 'REFUNDED' : 'PAID',
      };
    }

    if (body.note?.trim()) {
      const line = `[${new Date().toISOString().slice(0, 10)}] Επιστροφή: ${body.note.trim()}`;
      update.adminNotes = booking.adminNotes ? `${booking.adminNotes}\n${line}` : line;
    }

    const updated = await this.bookingModel.findByIdAndUpdate(bookingId, update, { returnDocument: 'after' });

    return {
      message: 'Refund processed',
      refundId,
      booking: {
        id: updated._id,
        paymentStatus: updated.paymentStatus,
        refundAmount: updated.refundAmount,
        stripeRefundId: updated.stripeRefundId,
      },
    };
  }

  async cancelBooking(bookingId: string, body: any) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check if booking can be cancelled
    if (booking.bookingStatus === 'CANCELLED') {
      throw new BadRequestException('Booking is already cancelled');
    }

    if (booking.bookingStatus === 'CHECKED_OUT') {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    // Zero or no amount cancels without a refund (a non-refundable stay). The
    // refund runs first, so a refund Stripe refuses leaves the booking as it was.
    const requested = Number(body.refundAmount) || 0;
    let refundUpdate: Record<string, any> = {};

    if (requested > 0 && booking.paymentMethod === 'CARD' && booking.stripePaymentIntentId) {
      this.requireStripe();
      const { refund, charge } = await refundCardPayment(this.stripe, {
        paymentIntentId: booking.stripePaymentIntentId,
        bookingId,
        bookingNumber: booking.bookingNumber,
        amount: requested,
        note: body.cancellationReason,
      });
      refundUpdate = refundFields(charge, refund.id);
      this.logger.log(`✅ Stripe refund ${refund.id} for cancelled booking ${booking.bookingNumber}: €${requested.toFixed(2)}`);
    } else if (requested > 0) {
      const total = Math.round(((booking.refundAmount || 0) + requested) * 100) / 100;
      refundUpdate = {
        refundAmount: total,
        refundedAt: new Date(),
        ...(booking.paymentStatus === 'PAID' && total >= (booking.totalAmount || 0) - 0.005
          ? { paymentStatus: 'REFUNDED' }
          : {}),
      };
      this.logger.log(`💵 Refund recorded for cancelled booking ${booking.bookingNumber}: €${requested.toFixed(2)}`);
    }

    const updateData: any = {
      bookingStatus: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: body.cancellationReason || 'Cancelled by admin',
      ...(body.adminNotes ? { adminNotes: body.adminNotes } : {}),
      ...refundUpdate,
    };

    // Update booking using findOneAndUpdate to avoid save() issues
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      bookingId,
      updateData,
      { returnDocument: 'after', runValidators: true }
    );

    return {
      message: 'Booking cancelled successfully',
      booking: {
        id: updatedBooking._id,
        status: updatedBooking.bookingStatus,
        cancelledAt: updatedBooking.cancelledAt,
        cancellationReason: updatedBooking.cancellationReason,
        refundAmount: updatedBooking.refundAmount,
        stripeRefundId: updatedBooking.stripeRefundId,
        paymentStatus: updatedBooking.paymentStatus,
        paymentMethod: updatedBooking.paymentMethod
      }
    };
  }

  private requireStripe() {
    if (!this.stripe) {
      throw new HttpException('Stripe is not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async updateBookingStatus(bookingId: string, body: { status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'; adminNotes?: string }) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Validate status transition
    const validStatuses = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];
    if (!validStatuses.includes(body.status)) {
      throw new BadRequestException('Invalid status');
    }

    // Prepare update data
    const updateData: any = {
      bookingStatus: body.status,
      adminNotes: body.adminNotes || booking.adminNotes
    };

    // Accepting a guest's pay-on-arrival request is what makes it hold the
    // room; until then it is deliberately invisible to availability. Because
    // it held nothing, the room may have sold in the meantime — so check
    // before accepting rather than quietly double-booking it.
    if (body.status !== 'PENDING') {
      if ((booking as any).awaitingPropertyConfirmation) {
        await this.availability.assertSellable(
          String((booking as any).roomId),
          new Date(booking.checkIn),
          new Date(booking.checkOut),
        );
      }
      updateData.awaitingPropertyConfirmation = false;
    }

    // Handle specific status changes
    if (body.status === 'CHECKED_IN') {
      updateData.checkedInAt = new Date();
    } else if (body.status === 'CHECKED_OUT') {
      updateData.checkedOutAt = new Date();
    }

    // Update booking using findOneAndUpdate to avoid save() issues
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      bookingId,
      updateData,
      { returnDocument: 'after', runValidators: true }
    );

    return {
      message: 'Booking status updated successfully',
      booking: {
        id: updatedBooking._id,
        status: updatedBooking.bookingStatus
      }
    };
  }

  async updateBooking(bookingId: string, body: UpdateBookingDto) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const updateData: any = {};

    if (body.bookingStatus !== undefined) updateData.bookingStatus = body.bookingStatus;
    if (body.paymentStatus !== undefined) updateData.paymentStatus = body.paymentStatus;
    if (body.adminNotes !== undefined) updateData.adminNotes = body.adminNotes;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.totalAmount !== undefined) updateData.totalAmount = body.totalAmount;
    if (body.depositAmount !== undefined) updateData.depositAmount = body.depositAmount;
    if (body.depositPaid !== undefined) {
      updateData.depositPaid = body.depositPaid;
      if (body.depositPaid && !booking.depositPaidAt) {
        updateData.depositPaidAt = body.depositPaidAt ? new Date(body.depositPaidAt) : new Date();
      }
    }
    if (body.depositPaidAt !== undefined) updateData.depositPaidAt = new Date(body.depositPaidAt);
    if (body.postCheckoutEmailSent !== undefined) updateData.postCheckoutEmailSent = body.postCheckoutEmailSent;

    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      bookingId,
      updateData,
      { returnDocument: 'after', runValidators: true }
    );

    return {
      message: 'Booking updated successfully',
      booking: updatedBooking
    };
  }

  async bulkDeleteBookings(bookingIds: string[]) {
    if (!bookingIds || bookingIds.length === 0) {
      throw new BadRequestException('No booking IDs provided');
    }
    
    const result = await this.bookingModel.deleteMany({ _id: { $in: bookingIds } });
    
    if (result.deletedCount === 0) {
      throw new NotFoundException('No bookings found with the provided IDs');
    }
    
    return {
      message: `Successfully deleted ${result.deletedCount} bookings`,
      deletedCount: result.deletedCount
    };
  }

  async bulkUpdateBookingStatus(body: { bookingIds: string[]; status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'; adminNotes?: string }) {
    if (!body.bookingIds || body.bookingIds.length === 0) {
      throw new BadRequestException('No booking IDs provided');
    }
    
    const result = await this.bookingModel.updateMany(
      { _id: { $in: body.bookingIds } },
      { 
        $set: { 
          bookingStatus: body.status,
          adminNotes: body.adminNotes || ''
        }
      }
    );
    
    if (result.modifiedCount === 0) {
      throw new NotFoundException('No bookings found with the provided IDs');
    }
    
    return {
      message: `Successfully updated ${result.modifiedCount} bookings`,
      modifiedCount: result.modifiedCount
    };
  };

  async getRooms(params: any) {
    const { page = 1, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const limit = parseListLimit(params.limit);

    // Build filter - only filter by fields that actually exist
    const filter: any = {};

    // safeSort, not `sort[sortBy] = ...`.
    //
    // This was the one call site that common/sort.ts was written for and did
    // not use: GET /admin/rooms?sortBy=<anything> sorted by an arbitrary field,
    // which is both a collection scan on demand and a field oracle — a
    // paginated list ordered by a value the caller cannot read still leaks the
    // ordering of that value.
    const sort = safeSort(sortBy, ROOM_SORTABLE_FIELDS, 'createdAt', sortOrder);

    const skip = (parseInt(page) - 1) * limit;

    const [rooms, total] = await Promise.all([
      this.roomModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.roomModel.countDocuments(filter),
    ]);

    return {
      rooms,
      pagination: {
        page: parseInt(page),
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getRoomById(id: string) {
    const room = await this.roomModel.findById(id).lean();

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const blockedDates = await this.roomBlockedDateModel
      .find({ roomId: room._id })
      .sort({ startDate: 1 })
      .lean();

    return { room: { ...room, blockedDates } };
  }

  /*
   * Room writes go through RoomsService.
   *
   * These three used to write to `this.roomModel` directly while RoomsService
   * was *also* injected — purely so that `clearRoomsCache()` could be poked by
   * hand afterwards, because RoomsService caches findAll() for 60s and only
   * invalidates on writes made through itself. That comment was the debt
   * documenting itself: three routes edited a room (PUT /admin/rooms/:id,
   * PUT /rooms/:id, PUT /admin/calendar/rooms/:id), each with its own
   * invalidation discipline, and only two went through RoomsService.
   *
   * RoomsService owns the cache and invalidates it on every write, so these are
   * now thin delegations and there is one discipline instead of three. Deletion
   * in particular gains the cascade and the active-booking check that
   * RoomsService.remove() performs inside a transaction — deleting a room here
   * previously orphaned its blocked dates and left bookings pointing at a room
   * that no longer existed.
   */
  async createRoom(roomData: CreateRoomDto) {
    return this.roomsService.create(roomData);
  }

  async updateRoom(id: string, roomData: UpdateRoomDto) {
    const room = await this.roomsService.update(id, roomData);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  async deleteRoom(id: string) {
    const room = await this.roomsService.remove(id);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return {
      message: 'Room deleted successfully',
      room
    };
  }

  async getOffers(params: { page: number; limit: number; active?: boolean }) {
    return await this.offersService.getAllOffers(params.page, params.limit, params.active);
  }

  async getOfferById(offerId: string) {
    return await this.offersService.getOfferById(offerId);
  }

  async createOffer(offerData: any) {
    try {
      const offer = await this.offersService.createOffer(offerData);
      return {
        message: 'Offer created successfully',
        offer
      };
    } catch (error) {
      this.logger.error(`createOffer failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  async updateOffer(offerId: string, offerData: any) {
    const offer = await this.offersService.updateOffer(offerId, offerData);
    return {
      message: 'Offer updated successfully',
      offer
    };
  }

  async deleteOffer(offerId: string) {
    await this.offersService.deleteOffer(offerId);
    return { message: 'Offer deleted successfully' };
  }

  async toggleOfferStatus(offerId: string) {
    const offer = await this.offersService.toggleOfferStatus(offerId);
    return {
      message: `Offer ${offer.active ? 'activated' : 'deactivated'} successfully`,
      offer
    };
  }

  // ── Seasonal pricing (property-wide, per room type) ──────────────────────────

  private normalizeSeasonalInput(body: any) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) throw new BadRequestException('Name is required');

    const start = new Date(body?.startDate);
    const end = new Date(body?.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Valid start and end dates are required');
    }
    // Store as midnight UTC of the calendar day (matches PricingService).
    const startDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endDate = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('End date must be on or after start date');
    }

    const prices: { '2beds'?: number; '3beds'?: number; '4beds'?: number } = {};
    for (const key of ['2beds', '3beds', '4beds'] as const) {
      const raw = body?.prices?.[key];
      if (raw !== undefined && raw !== null && raw !== '') {
        const num = Number(raw);
        if (isNaN(num) || num < 0) throw new BadRequestException(`Invalid price for ${key}`);
        prices[key] = num;
      }
    }
    if (prices['2beds'] === undefined && prices['3beds'] === undefined && prices['4beds'] === undefined) {
      throw new BadRequestException('Set at least one price (2beds / 3beds / 4beds)');
    }

    const result: any = { name, startDate, endDate, prices };
    if (body?.priority !== undefined && body?.priority !== null && body?.priority !== '') {
      const p = Number(body.priority);
      if (!isNaN(p)) result.priority = p;
    }
    if (body?.active !== undefined) result.active = body.active === true || body.active === 'true';
    return result;
  }

  async getSeasonalPricing() {
    const periods = await this.seasonalModel.find().sort({ startDate: 1 }).lean();
    return { periods };
  }

  getRateCalendar(from: string, days: number): Promise<RateCalendar> {
    return this.pricingService.rateCalendar(from, days);
  }

  async createSeasonalPricing(body: any) {
    const data = this.normalizeSeasonalInput(body);
    const period = await this.seasonalModel.create(data);
    return { message: 'Seasonal period created successfully', period };
  }

  async updateSeasonalPricing(id: string, body: any) {
    const data = this.normalizeSeasonalInput(body);

    // Build the update by explicit path. Handing Mongoose a nested `prices`
    // object turns into $set on dotted paths (prices.2beds …), which MERGES:
    // a room type the admin cleared keeps its old price and the change looks
    // like it never saved. Absent types must be $unset, not merely omitted.
    const $set: Record<string, any> = {
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
    };
    if (data.priority !== undefined) $set.priority = data.priority;
    if (data.active !== undefined) $set.active = data.active;

    const $unset: Record<string, ''> = {};
    for (const key of ['2beds', '3beds', '4beds'] as const) {
      if (data.prices[key] !== undefined) $set[`prices.${key}`] = data.prices[key];
      else $unset[`prices.${key}`] = '';
    }

    const update: Record<string, any> = { $set };
    if (Object.keys($unset).length > 0) update.$unset = $unset;

    const period = await this.seasonalModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!period) throw new NotFoundException('Seasonal period not found');
    return { message: 'Seasonal period updated successfully', period };
  }

  async deleteSeasonalPricing(id: string) {
    const deleted = await this.seasonalModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Seasonal period not found');
    return { message: 'Seasonal period deleted successfully' };
  }

  async getUsers(params: {
    page?: number;
    limit?: number;
    role?: 'ADMIN' | 'USER';
    isActive?: boolean;
    search?: string;
  }) {
    const {
      page = 1,
      role,
      isActive,
      search
    } = params;
    // Capped here as well as in the controller, so the ceiling travels with
    // the query rather than depending on which caller built the params.
    const limit = parseListLimit(params.limit);

    const filter: any = {};

    if (role) {
      filter.role = role;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-password -resetPasswordToken -resetPasswordExpires')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.userModel.countDocuments(filter)
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  // Room Management methods for Milestone 2
  async getRoomTypes() {
    const roomTypes = await this.roomModel.aggregate([
      {
        $group: {
          _id: '$nameKey',
          name: { $first: '$name' },
          description: { $first: '$description' },
          capacity: { $first: '$capacity' },
          bedType: { $first: '$bedType' },
          price: { $first: '$price' },
          totalRooms: { $sum: '$totalRooms' },
          images: { $first: '$images' },
          amenities: { $first: '$amenities' },
          floor: { $first: '$floor' }
        }
      },
      {
        $sort: { capacity: 1 }
      }
    ]).option({ maxTimeMS: 5000 });

    return roomTypes.map(type => ({
      id: type._id,
      name: type.name,
      description: type.description,
      capacity: type.capacity,
      bedType: type.bedType,
      price: type.price,
      totalRooms: type.totalRooms,
      images: type.images,
      amenities: type.amenities,
      floor: type.floor || 'ground'
    }));
  }

  /**
   * Every room, night by night, for `days` nights starting `from`: booked,
   * closed or free. Bookings are matched by overlap, so a stay that started
   * before the window or ends after it still colours the nights it covers.
   */
  async getOccupancy(from: string, days: number): Promise<OccupancyResult> {
    return this.availability.getOccupancy(from, days);
  }

  /** One room, night by night, with the closures that cover it. */
  async getRoomAvailability(roomId: string, startDate: string, endDate: string) {
    const result = await this.availability.getRoomNights(
      roomId,
      dayKey(startDate),
      dayKey(endDate),
    );
    if (!result.room) {
      throw new NotFoundException('Room not found');
    }
    return result;
  }

  /** The room on or off sale indefinitely; off sale closes every one of its nights. */
  async updateRoomAvailability(roomId: string, available: boolean) {
    return this.roomsService.updateRoomAvailability(roomId, available);
  }

  /**
   * Delegated, like the other room writes. Writing the price through the model
   * here left the RoomsService findAll() cache holding the old price for up to
   * a minute, so the public site kept quoting the previous rate after a change.
   */
  async updateRoomPricing(roomId: string, pricingData: UpdateRoomPricingDto) {
    return this.roomsService.updateRoomPricing(roomId, pricingData);
  }

  /** Delegated: RoomsService already computes exactly this. */
  async getRoomStats() {
    return this.roomsService.getRoomStats();
  }

  /**
   * Closing a room is one write path (RoomsService), so the closure lands in
   * the same place every reader looks and the cached guest calendar is dropped
   * either way the owner closes the dates.
   */
  async blockRoomDates(roomId: string, startDate: string, endDate: string, reason?: string) {
    const room = await this.roomsService.blockDates(
      roomId,
      new Date(startDate),
      new Date(endDate),
      reason,
    );
    return { success: true, data: room };
  }

  async unblockRoomDates(roomId: string, blockId: string) {
    await this.roomsService.unblockDates(roomId, blockId);
    return { success: true };
  }

  /**
   * Always a complete settings object, so the panel never has to decide what an
   * absent field means.
   *
   * defaultSettings() used to be a fourth hand-written copy of the field list,
   * and it had drifted: it echoed back `currency: 'EUR'` while the schema
   * default was 'EUR' and PricingService hardcoded 'eur', and it named
   * `overbookingAllowed`, `automaticPricing` and `directBookingDiscount`, none
   * of which anything read. SETTINGS_DEFAULTS is derived from the one field
   * declaration in models/settings.model.ts.
   */
  async getSettings() {
    return { success: true, data: await this.settingsService.getEffectiveSettings() };
  }

  async updateSettings(data: UpdateSettingsDto) {
    const updated = await this.settingsService.upsertSettings(data);
    return { success: true, data: { ...SETTINGS_DEFAULTS, ...updated } };
  }
}
