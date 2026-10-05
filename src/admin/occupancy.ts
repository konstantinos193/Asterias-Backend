// Night-by-night room occupancy for the admin bookings grid.
//
// A night belongs to the date the guest sleeps there: a stay 10 → 12 occupies
// the nights of the 10th and 11th, and the room is free again on the night of
// the 12th. Day keys are UTC dates, the same convention bookings and closures
// are stored in (both are created from plain YYYY-MM-DD strings).
//
// The rules mirror what the public site sells (BookingsService.checkAvailability
// and the booking-time check in PaymentsService): any non-cancelled booking
// occupies the room and a closure (RoomBlockedDate) takes it off sale. The
// room's `available` flag is not consulted there, so it is not consulted here.

export type NightStatus = 'booked' | 'closed' | 'free';

export interface OccupancyNight {
  date: string;
  status: NightStatus;
  /** First booking covering this night (booked only). */
  bookingId?: string;
  /** Bookings covering this night; each apartment is one unit, so 2+ is an overbooking. */
  count?: number;
  /** Closure reason (closed only). */
  reason?: string;
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

interface RoomInput {
  _id: unknown;
  name: string;
  roomType?: string;
  available?: boolean;
  totalRooms?: number;
}

interface BookingInput {
  _id: unknown;
  roomId: unknown;
  checkIn: Date | string;
  checkOut: Date | string;
  bookingNumber?: string;
  bookingStatus?: string;
  source?: string;
  guestInfo?: { firstName?: string; lastName?: string };
}

interface BlockInput {
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
  return typeof s === 'string' && DAY_RE.test(s) && dayKey(`${s}T00:00:00.000Z`) === s;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return dayKey(d);
}

export function buildDates(from: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(from, i));
}

/** Today's date at the property, which is what "tonight" means to the owner. */
export function todayAtProperty(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens' }).format(now);
}

function idOf(v: unknown): string {
  if (v && typeof v === 'object' && '_id' in v) return String((v as { _id: unknown })._id);
  return String(v);
}

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
  const closedNights = new Map<string, Map<string, string>>();

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
    const nights = closedNights.get(roomId) ?? new Map<string, string>();
    closedNights.set(roomId, nights);
    const s = dayKey(bl.startDate);
    const e = dayKey(bl.endDate);
    for (const date of dates) {
      if (date >= s && date < e && !nights.has(date)) nights.set(date, bl.reason || '');
    }
  }

  const roomById = new Map<string, RoomInput>();
  const outRooms: OccupancyRoom[] = rooms.map((r) => {
    const id = idOf(r._id);
    roomById.set(id, r);
    const available = r.available !== false;
    const booked = bookedNights.get(id);
    const closed = closedNights.get(id);
    const nights = dates.map((date): OccupancyNight => {
      const ids = booked?.get(date);
      // A booking wins over a closure: the guest is in the room either way.
      if (ids?.length) return { date, status: 'booked', bookingId: ids[0], count: ids.length };
      if (closed?.has(date)) return { date, status: 'closed', reason: closed.get(date) };
      return { date, status: 'free' };
    });
    return {
      _id: id,
      name: r.name,
      roomType: r.roomType || '2beds',
      available,
      totalRooms: r.totalRooms ?? 1,
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
