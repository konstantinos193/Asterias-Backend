import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { dayStart, nightsBetween } from '../../availability/availability-rules';
import { PricingService } from '../../pricing/pricing.service';
import {
  CONFLICT_CODES,
  CONFLICT_MESSAGES,
  ConflictCode,
  MAX_STAY_NIGHTS,
} from '../calendar.constants';
import { CalendarConflict, CalendarReservation, DayKey, ReservationGroup } from '../calendar.types';
import { findConflict } from '../lib/conflict-rules';
import { roomNameIndex, toReservation } from '../lib/calendar-mappers';
import { buildGroup } from '../lib/group-folio';
import {
  CreateReservationDto,
  ReassignReservationDto,
  SetStatusDto,
  UpdateBillingDto,
  UpdateGuestDto,
} from '../dto/reservation.dto';
import { BookingRow, CalendarBookingsRepository } from '../repositories/calendar-bookings.repository';
import { CalendarClosuresRepository } from '../repositories/calendar-closures.repository';
import { CalendarRoomsRepository } from '../repositories/calendar-rooms.repository';

@Injectable()
export class CalendarReservationsService {
  constructor(
    private readonly rooms: CalendarRoomsRepository,
    private readonly bookings: CalendarBookingsRepository,
    private readonly closures: CalendarClosuresRepository,
    private readonly pricing: PricingService,
  ) {}

  async create(dto: CreateReservationDto): Promise<CalendarReservation> {
    const nights = this.assertStay(dto.checkIn, dto.checkOut);
    const room = await this.requireRoom(dto.roomId);

    if (!dto.force) {
      await this.assertFree(dto.roomId, dto.checkIn, dto.checkOut);
    }

    const adults = dto.adults;
    const children = dto.children ?? 0;
    const totalAmount =
      dto.totalAmount ?? (await this.quoteTotal(dto.roomId, dto.checkIn, dto.checkOut, adults, children));

    const created = await this.bookings.create({
      bookingNumber: await this.bookings.nextBookingNumber(),
      roomId: new Types.ObjectId(dto.roomId),
      checkIn: dayStart(dto.checkIn),
      checkOut: dayStart(dto.checkOut),
      adults,
      children,
      totalAmount,
      roomSubtotal: totalAmount,
      vatAmount: 0,
      municipalFee: 0,
      environmentalTax: 0,
      paymentMethod: dto.paymentMethod ?? 'CASH',
      paymentStatus: dto.paymentStatus ?? 'PENDING',
      bookingStatus: dto.bookingStatus ?? 'CONFIRMED',
      source: dto.source ?? 'asterias',
      notes: dto.notes ?? '',
      adminNotes: dto.adminNotes ?? `Χειροκίνητη κράτηση · ${nights} νύχτες`,
      guestInfo: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email ?? '',
        phone: dto.phone ?? '',
        specialRequests: '',
        language: 'el',
      },
    }, dto.force === true);

    return toReservation(created, new Map([[dto.roomId, room.name]]));
  }

  /** The drag: same stay, another room and/or other nights. */
  async reassign(bookingId: string, dto: ReassignReservationDto): Promise<CalendarReservation> {
    const booking = await this.requireBooking(bookingId);
    const roomId = dto.roomId ?? (booking.roomId ? String(booking.roomId) : null);
    if (!roomId) {
      throw new BadRequestException('Η κράτηση δεν έχει δωμάτιο');
    }

    const checkIn = dto.checkIn ?? toKey(booking.checkIn);
    const checkOut = dto.checkOut ?? toKey(booking.checkOut);
    this.assertStay(checkIn, checkOut);
    const room = await this.requireRoom(roomId);

    if (!dto.force) {
      await this.assertFree(roomId, checkIn, checkOut, bookingId);
    }

    const patch: Record<string, unknown> = {
      roomId: new Types.ObjectId(roomId),
      checkIn: dayStart(checkIn),
      checkOut: dayStart(checkOut),
    };

    if (dto.reprice) {
      patch.totalAmount = await this.quoteTotal(
        roomId,
        checkIn,
        checkOut,
        booking.adults ?? 1,
        booking.children ?? 0,
      );
    }

    const updated = await this.bookings.updateById(bookingId, patch);
    return toReservation(updated ?? booking, new Map([[roomId, room.name]]));
  }

  async updateGuest(bookingId: string, dto: UpdateGuestDto): Promise<CalendarReservation> {
    const booking = await this.requireBooking(bookingId);

    const guestFields: Record<string, unknown> = {};
    if (dto.firstName !== undefined) guestFields['guestInfo.firstName'] = dto.firstName;
    if (dto.lastName !== undefined) guestFields['guestInfo.lastName'] = dto.lastName;
    if (dto.email !== undefined) guestFields['guestInfo.email'] = dto.email;
    if (dto.phone !== undefined) guestFields['guestInfo.phone'] = dto.phone;
    if (dto.specialRequests !== undefined) {
      guestFields['guestInfo.specialRequests'] = dto.specialRequests;
    }
    if (dto.adults !== undefined) guestFields.adults = dto.adults;
    if (dto.children !== undefined) guestFields.children = dto.children;
    if (dto.notes !== undefined) guestFields.notes = dto.notes;
    if (dto.adminNotes !== undefined) guestFields.adminNotes = dto.adminNotes;

    const updated = Object.keys(guestFields).length
      ? await this.bookings.updateById(bookingId, guestFields)
      : booking;
    return this.present(updated ?? booking);
  }

  async updateBilling(bookingId: string, dto: UpdateBillingDto): Promise<CalendarReservation> {
    const booking = await this.requireBooking(bookingId);
    const patch: Record<string, unknown> = { ...dto };
    if (dto.depositPaid === true) patch.depositPaidAt = new Date();

    const updated = Object.keys(patch).length
      ? await this.bookings.updateById(bookingId, patch)
      : booking;
    return this.present(updated ?? booking);
  }

  async setStatus(bookingId: string, dto: SetStatusDto): Promise<CalendarReservation> {
    await this.requireBooking(bookingId);

    const patch: Record<string, unknown> = { bookingStatus: dto.status };
    if (dto.status === 'CHECKED_IN') patch.checkedInAt = new Date();
    if (dto.status === 'CHECKED_OUT') patch.checkedOutAt = new Date();
    if (dto.status === 'CANCELLED') {
      patch.cancelledAt = new Date();
      patch.cancellationReason = dto.cancellationReason ?? 'Ακύρωση από το ημερολόγιο';
    }

    const updated = await this.bookings.updateById(bookingId, patch);
    if (!updated) throw new NotFoundException('Η κράτηση δεν βρέθηκε');
    return this.present(updated);
  }

  async remove(bookingId: string): Promise<{ removed: boolean }> {
    const removed = await this.bookings.deleteById(bookingId);
    if (!removed) throw new NotFoundException('Η κράτηση δεν βρέθηκε');
    return { removed };
  }

  /** The other rooms of a multi-room booking, and what the whole group owes. */
  async getGroup(bookingId: string): Promise<ReservationGroup> {
    const booking = await this.requireBooking(bookingId);
    const masterId = booking.parentBookingId ? String(booking.parentBookingId) : String(booking._id);

    const master = masterId === String(booking._id) ? booking : await this.bookings.findById(masterId);
    const childIds = (master?.childBookingIds ?? []).map((id) => new Types.ObjectId(String(id)));
    const children = childIds.length ? await this.bookings.listByIds(childIds) : [];

    const members = [master ?? booking, ...children];
    const roomIds = [...new Set(members.map((m) => (m.roomId ? String(m.roomId) : '')).filter(Boolean))];
    const rooms = await Promise.all(roomIds.map((id) => this.rooms.findById(id)));
    const names = roomNameIndex(rooms.filter((room): room is NonNullable<typeof room> => room !== null));

    return buildGroup(masterId, members, names);
  }

  // ─── Guards ────────────────────────────────────────────────────────────────

  private assertStay(checkIn: DayKey, checkOut: DayKey): number {
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) {
      throw new BadRequestException('Η αναχώρηση πρέπει να είναι μετά την άφιξη');
    }
    if (nights > MAX_STAY_NIGHTS) {
      throw new BadRequestException(`Η διαμονή δεν μπορεί να ξεπερνά τις ${MAX_STAY_NIGHTS} νύχτες`);
    }
    return nights;
  }

  private async requireRoom(roomId: string) {
    const room = await this.rooms.findById(roomId);
    if (!room) throw this.conflict({ code: CONFLICT_CODES.roomNotFound });
    return room;
  }

  private async requireBooking(bookingId: string): Promise<BookingRow> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) throw new NotFoundException('Η κράτηση δεν βρέθηκε');
    return booking;
  }

  /** Reads what sits on those nights, then lets the pure rules decide. */
  private async assertFree(
    roomId: string,
    checkIn: DayKey,
    checkOut: DayKey,
    excludeBookingId?: string,
  ): Promise<void> {
    const room = await this.requireRoom(roomId);
    const start = dayStart(checkIn);
    const end = dayStart(checkOut);

    const [closures, occupants] = await Promise.all([
      this.closures.listActiveInRoom(roomId, start, end),
      this.bookings.listOccupantsOfRoom(roomId, start, end, excludeBookingId),
    ]);

    const conflict = findConflict(
      { available: room.available !== false, totalRooms: room.totalRooms },
      checkIn,
      checkOut,
      closures.map((c) => ({ start: c.startDate, end: c.endDate, reason: c.reason })),
      occupants.map((o) => ({ start: o.checkIn, end: o.checkOut })),
    );

    if (conflict) throw this.conflict(conflict);
  }

  private conflict(conflict: CalendarConflict): ConflictException {
    return new ConflictException({
      message: CONFLICT_MESSAGES[conflict.code as ConflictCode],
      details: conflict,
    });
  }

  private async quoteTotal(
    roomId: string,
    checkIn: DayKey,
    checkOut: DayKey,
    adults: number,
    children: number,
  ): Promise<number> {
    const quote = await this.pricing.quoteStay(roomId, checkIn, checkOut, adults, children);
    const taxes = await this.pricing.applyTaxes(quote.subtotal, quote.nights, adults + children);
    return taxes.total;
  }

  private async present(row: BookingRow): Promise<CalendarReservation> {
    const roomId = row.roomId ? String(row.roomId) : null;
    const room = roomId ? await this.rooms.findById(roomId) : null;
    return toReservation(row, new Map(room ? [[String(room._id), room.name]] : []));
  }
}

function toKey(date: Date): DayKey {
  return date.toISOString().slice(0, 10);
}
