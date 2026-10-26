/**
 * The one definition of "is this night on sale".
 *
 * Every path used to answer this question on its own and they disagreed: the
 * admin grid counted every non-cancelled booking and honoured the owner's
 * closures, the public calendar counted only CONFIRMED/CHECKED_IN and ignored
 * closures altogether, and the room listing additionally required the room's
 * `available` flag. So the owner closed an apartment, the admin calendar went
 * grey, and the site kept selling the same nights green. Everything now reads
 * the rules from here.
 *
 * The rules:
 *  - A night belongs to the date the guest sleeps there: a stay 10 -> 12 covers
 *    the nights of the 10th and 11th, and the room is free again on the 12th.
 *    Every range is half-open, [start, end).
 *  - Any booking that is not CANCELLED occupies a unit, PENDING included: the
 *    booking-time guard counts it, so the calendar has to count it too.
 *  - A closure (RoomBlockedDate) takes the room off sale for the nights it
 *    covers.
 *  - A room flagged `available: false` is off sale for every night. The room
 *    listing has always read it that way, so the calendars now say so too
 *    instead of showing those nights as free.
 *  - A Room document is a room TYPE with `totalRooms` physical units; it is
 *    full when the occupying bookings reach that count.
 *
 * Day keys are UTC dates, the convention bookings and closures are stored in
 * (both are built from plain YYYY-MM-DD strings).
 */

/** Statuses that do NOT occupy a unit. */
export const NON_OCCUPYING_BOOKING_STATUSES = ['CANCELLED'] as const;

/** Shown in the admin grid for a room whose `available` flag is off. */
export const OFF_SALE_REASON = 'Εκτός πώλησης';

export type NightStatus = 'booked' | 'closed' | 'free';

export interface OccupancyNight {
  date: string;
  status: NightStatus;
  /** First booking covering this night (booked only). */
  bookingId?: string;
  /** Bookings covering this night; compare with the room's totalRooms to spot an overbooking. */
  count?: number;
  /** Closure reason, or OFF_SALE_REASON (closed only). */
  reason?: string;
  /**
   * The closure covering this night, so the admin can reopen it. Absent on a
   * night that is closed only because the room itself is off sale — that is
   * undone on the room, not here.
   */
  blockId?: string;
  /** Units still sellable this night: 0 whenever the night is closed. */
  unitsFree?: number;
}

export interface OccupancyRoom {
  _id: string;
  name: string;
  roomType: string;
  available: boolean;
  totalRooms: number;
  nights: OccupancyNight[];
}

export interface OccupancyBooking {
  _id: string;
  bookingNumber: string;
  bookingStatus: string;
  source: string;
  checkIn: string;
  checkOut: string;
  roomId: { _id: string; name: string; roomType: string } | null;
  guestInfo: { firstName: string; lastName: string };
}

export interface OccupancyResult {
  from: string;
  /** Exclusive: the morning after the last night shown. */
  to: string;
  dates: string[];
  rooms: OccupancyRoom[];
  bookings: OccupancyBooking[];
}

export interface PropertyNight {
  status: 'available' | 'limited' | 'booked';
  color: 'green' | 'yellow' | 'red';
  textColor: 'white' | 'black';
  /** Units a guest can still book this night. */
  availableRooms: number;
  /** Units the property has at all, off-sale ones included. */
  totalRooms: number;
  /** Units on sale at all this night (totalRooms minus closed and off-sale ones). */
  sellableRooms: number;
  isAvailable: boolean;
}

export interface RoomInput {
  _id: unknown;
  name: string;
  roomType?: string;
  available?: boolean;
  totalRooms?: number;
}

export interface BookingInput {
  _id: unknown;
  roomId: unknown;
  checkIn: Date | string;
  checkOut: Date | string;
  bookingNumber?: string;
  bookingStatus?: string;
  source?: string;
  guestInfo?: { firstName?: string; lastName?: string };
}

export interface BlockInput {
  _id: unknown;
  roomId: unknown;
  startDate: Date | string;
  endDate: Date | string;
  reason?: string;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dayKey(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isDayKey(s: unknown): s is string {
  if (typeof s !== 'string' || !DAY_RE.test(s)) return false;
  const date = new Date(s + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && dayKey(date) === s;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return dayKey(d);
}

export function buildDates(from: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(from, i));
}

/** UTC midnight of a day key, the form bookings and closures are stored in. */
export function dayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** Nights between two day keys. */
export function nightsBetween(from: string, to: string): number {
  return Math.round((dayStart(to).getTime() - dayStart(from).getTime()) / 86_400_000);
}

/**
 * Nights a stay covers. The one place this is worked out: it used to be
 * recomputed from timestamps in five, some rounding up and some to the nearest,
 * which agreed only as long as every date was exactly UTC midnight.
 */
export function stayNights(checkIn: Date | string, checkOut: Date | string): number {
  return Math.max(0, nightsBetween(dayKey(checkIn), dayKey(checkOut)));
}

/** Today's date at the property, which is what "tonight" means to the owner. */
export function todayAtProperty(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens' }).format(now);
}

/** Bookings that occupy a unit somewhere in [from, to). */
export function occupyingBookingFilter(from: Date, to: Date, roomIds?: unknown[]) {
  const filter: Record<string, unknown> = {
    bookingStatus: { $nin: NON_OCCUPYING_BOOKING_STATUSES },
    // An unaccepted guest request to pay on arrival is not a held room.
    awaitingPropertyConfirmation: { $ne: true },
    checkIn: { $lt: to },
    checkOut: { $gt: from },
  };
  if (roomIds) filter.roomId = { $in: roomIds };
  return filter;
}

/**
 * Closures that cover a night in [from, to). A parked closure (active: false)
 * is left out: it is a saved row, not a night that is shut. Rows written before
 * the field existed have no `active` at all, so the filter has to let those
 * through as closed.
 */
export function closureFilter(from: Date, to: Date, roomIds?: unknown[]) {
  const filter: Record<string, unknown> = {
    startDate: { $lt: to },
    endDate: { $gt: from },
    active: { $ne: false },
  };
  if (roomIds) filter.roomId = { $in: roomIds };
  return filter;
}

function idOf(v: unknown): string {
  if (v && typeof v === 'object' && '_id' in v) return String((v as { _id: unknown })._id);
  return String(v);
}

function capacityOf(r: RoomInput): number {
  return Math.max(1, r.totalRooms ?? 1);
}

/** Room x night, from one window of rooms, bookings and closures. */
export function buildOccupancy(
  from: string,
  days: number,
  rooms: RoomInput[],
  bookings: BookingInput[],
  blocks: BlockInput[],
): OccupancyResult {
  const dates = buildDates(from, days);
  const to = addDays(from, days);

  // night -> booking ids, and night -> closure, per room
  const bookedNights = new Map<string, Map<string, string[]>>();
  const closedNights = new Map<string, Map<string, { reason: string; blockId: string }>>();

  for (const b of bookings) {
    const roomId = idOf(b.roomId);
    const nights = bookedNights.get(roomId) ?? new Map<string, string[]>();
    bookedNights.set(roomId, nights);
    const ci = dayKey(b.checkIn);
    const co = dayKey(b.checkOut);
    for (const date of dates) {
      if (date >= ci && date < co) {
        const ids = nights.get(date) ?? [];
        ids.push(String(b._id));
        nights.set(date, ids);
      }
    }
  }

  for (const bl of blocks) {
    const roomId = idOf(bl.roomId);
    const nights =
      closedNights.get(roomId) ?? new Map<string, { reason: string; blockId: string }>();
    closedNights.set(roomId, nights);
    const s = dayKey(bl.startDate);
    const e = dayKey(bl.endDate);
    for (const date of dates) {
      if (date >= s && date < e && !nights.has(date)) {
        nights.set(date, { reason: bl.reason || '', blockId: String(bl._id) });
      }
    }
  }

  const roomById = new Map<string, RoomInput>();
  const outRooms: OccupancyRoom[] = rooms.map((r) => {
    const id = idOf(r._id);
    roomById.set(id, r);
    const available = r.available !== false;
    const capacity = capacityOf(r);
    const booked = bookedNights.get(id);
    const closed = closedNights.get(id);
    const nights = dates.map((date): OccupancyNight => {
      const ids = booked?.get(date);
      const count = ids?.length ?? 0;
      // A booking wins over a closure: the guest is in the room either way,
      // and the owner needs to see the stay, not a grey block over it.
      if (count) {
        return {
          date,
          status: 'booked',
          bookingId: ids[0],
          count,
          unitsFree: available && !closed?.has(date) ? Math.max(0, capacity - count) : 0,
        };
      }
      const closure = closed?.get(date);
      if (closure) {
        return {
          date,
          status: 'closed',
          reason: closure.reason,
          blockId: closure.blockId,
          unitsFree: 0,
        };
      }
      // The flag is the owner closing the room indefinitely. The room listing
      // has always honoured it, so the calendars no longer pretend otherwise.
      if (!available) {
        return { date, status: 'closed', reason: OFF_SALE_REASON, unitsFree: 0 };
      }
      return { date, status: 'free', unitsFree: capacity };
    });
    return {
      _id: id,
      name: r.name,
      roomType: r.roomType || '2beds',
      available,
      totalRooms: capacity,
      nights,
    };
  });

  const outBookings: OccupancyBooking[] = bookings.map((b) => {
    const room = roomById.get(idOf(b.roomId));
    return {
      _id: String(b._id),
      bookingNumber: b.bookingNumber ?? '',
      bookingStatus: b.bookingStatus ?? '',
      source: b.source ?? 'asterias',
      checkIn: new Date(b.checkIn).toISOString(),
      checkOut: new Date(b.checkOut).toISOString(),
      roomId: room
        ? { _id: idOf(room._id), name: room.name, roomType: room.roomType || '2beds' }
        : null,
      guestInfo: {
        firstName: b.guestInfo?.firstName ?? '',
        lastName: b.guestInfo?.lastName ?? '',
      },
    };
  });

  return { from, to, dates, rooms: outRooms, bookings: outBookings };
}

/**
 * The property as a whole, night by night, derived from the same room x night
 * grid the admin sees — so the public date picker and the admin calendar
 * cannot disagree again.
 */
export function summarizeProperty(occupancy: OccupancyResult): Record<string, PropertyNight> {
  const totalRooms = occupancy.rooms.reduce((sum, r) => sum + r.totalRooms, 0);
  const out: Record<string, PropertyNight> = {};

  occupancy.dates.forEach((date, i) => {
    let availableRooms = 0;
    let sellableRooms = 0;
    for (const room of occupancy.rooms) {
      const night = room.nights[i];
      if (!night) continue;
      availableRooms += night.unitsFree ?? 0;
      if (night.status !== 'closed') sellableRooms += room.totalRooms;
    }

    const status = availableRooms === 0 ? 'booked' : availableRooms <= 2 ? 'limited' : 'available';
    out[date] = {
      status,
      color: status === 'booked' ? 'red' : status === 'limited' ? 'yellow' : 'green',
      textColor: status === 'limited' ? 'black' : 'white',
      availableRooms,
      totalRooms,
      sellableRooms,
      isAvailable: availableRooms > 0,
    };
  });

  return out;
}