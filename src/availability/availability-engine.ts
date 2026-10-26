import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Room, RoomDocument } from '../models/room.model';
import { Booking, BookingDocument } from '../models/booking.model';
import { RoomBlockedDate, RoomBlockedDateDocument } from '../models/room-blocked-date.model';
import {
  OccupancyResult,
  PropertyNight,
  addDays,
  buildOccupancy,
  closureFilter,
  dayKey,
  dayStart,
  nightsBetween,
  occupyingBookingFilter,
  summarizeProperty,
  todayAtProperty,
} from './availability-rules';

/**
 * How far ahead the guest date picker may ask in one go. Long enough to cover a
 * whole closed winter plus the season after it, so the picker can tell the guest
 * when the property opens again without walking month by month.
 */
export const MAX_RANGE_DAYS = 400;

/** What a stay-length question answers with. */
export interface RoomSellability {
  roomId: string;
  /** Units free for the whole stay. 0 when the room is closed or off sale. */
  unitsFree: number;
  /** Why it cannot be sold, for the admin and for the error the guest sees. */
  reason: 'open' | 'closed' | 'off-sale' | 'full';
}

/**
 * The single source of availability. Everything — the public date picker, the
 * room listing, the booking-time guard and the admin calendars — asks this
 * service, so a night can no longer read free on the site and closed in the
 * admin. The rules themselves live in availability-rules.ts.
 */
@Injectable()
export class AvailabilityEngine {
  private readonly logger = new Logger(AvailabilityEngine.name);


  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(RoomBlockedDate.name)
    private blockModel: Model<RoomBlockedDateDocument>,
  ) {}

  /** Reads go to Mongo so every live instance sees committed writes. */
  invalidate() {}

  // ─── The primitive: room × night ──────────────────────────────────────────

  /**
   * Every room, night by night, for `days` nights starting `from`. Bookings and
   * closures are matched by overlap, so a stay or a closure that started before
   * the window still colours the nights it covers.
   */
  async getOccupancy(from: string, days: number, roomIds?: string[]): Promise<OccupancyResult> {
    const start = dayStart(from);
    const end = dayStart(addDays(from, days));
    const ids = roomIds?.map((id) => new Types.ObjectId(id));

    const [rooms, bookings, blocks] = await Promise.all([
      this.roomModel
        .find(ids ? { _id: { $in: ids } } : {})
        .sort({ sortOrder: 1, name: 1 })
        .select('name roomType available totalRooms')
        .lean(),
      this.bookingModel
        .find({ roomId: { $ne: null }, ...occupyingBookingFilter(start, end, ids) })
        .select('bookingNumber bookingStatus source checkIn checkOut roomId guestInfo.firstName guestInfo.lastName')
        .sort({ checkIn: 1 })
        .lean(),
      this.blockModel.find(closureFilter(start, end, ids)).lean(),
    ]);

    return buildOccupancy(from, days, rooms as any[], bookings as any[], blocks as any[]);
  }

  // ─── The public date picker ───────────────────────────────────────────────

  /** One month of the property as a whole, for the guest-facing calendar. */
  async getPropertyCalendar(
    month?: number,
    year?: number,
  ): Promise<{ month: number; year: number; availability: Record<string, PropertyNight> }> {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();

    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();

    const occupancy = await this.getOccupancy(from, days);
    const result = { month: m, year: y, availability: summarizeProperty(occupancy) };

    return result;
  }

  /**
   * Many months of the property in one answer, with the first night that can
   * actually be booked. The picker used to ask a month at a time, which meant a
   * request per arrow press and — out of season, when every near night is shut —
   * a grid the guest could not click anywhere in, with no hint of where the
   * open dates start.
   */
  async getPropertyRange(
    from: string,
    days: number,
  ): Promise<{
    from: string;
    days: number;
    firstOpenDate: string | null;
    availability: Record<string, PropertyNight>;
  }> {
    const span = Math.min(MAX_RANGE_DAYS, Math.max(1, Math.trunc(days)));

    const occupancy = await this.getOccupancy(from, span);
    const availability = summarizeProperty(occupancy);
    const firstOpenDate = occupancy.dates.find((date) => availability[date]?.isAvailable) ?? null;
    const result = { from, days: span, firstOpenDate, availability };

    return result;
  }

  /** The property on one night, used by the dashboard overview. */
  async getPropertyNight(date: string): Promise<PropertyNight | null> {
    const occupancy = await this.getOccupancy(date, 1);
    return summarizeProperty(occupancy)[date] ?? null;
  }

  // ─── Whole-stay questions ─────────────────────────────────────────────────

  /**
   * Units free for the whole stay, per room. A closure or the `available` flag
   * anywhere inside the stay takes the room out entirely: it cannot be sold for
   * those dates even if the other nights are free.
   */
  async getSellability(
    checkIn: Date,
    checkOut: Date,
    roomIds?: string[],
    session?: ClientSession,
  ): Promise<Map<string, RoomSellability>> {
    const ids = roomIds?.map((id) => new Types.ObjectId(id));
    const opts = session ? { session } : {};

    const rooms = await this.roomModel
      .find(ids ? { _id: { $in: ids } } : {}, null, opts)
      .select('available totalRooms')
      .lean();
    if (!rooms.length) return new Map();

    const presentIds = rooms.map((r) => (r as any)._id);

    const [closedIds, bookedCounts] = await Promise.all([
      this.blockModel.distinct('roomId', closureFilter(checkIn, checkOut, presentIds), opts),
      this.bookingModel.aggregate(
        [
          { $match: occupyingBookingFilter(checkIn, checkOut, presentIds) },
          { $group: { _id: '$roomId', count: { $sum: 1 } } },
        ],
        opts,
      ),
    ]);

    const closed = new Set(closedIds.map((id) => String(id)));
    const booked = new Map(bookedCounts.map((b: any) => [String(b._id), b.count as number]));

    const out = new Map<string, RoomSellability>();
    for (const room of rooms) {
      const roomId = String((room as any)._id);
      const capacity = Math.max(1, (room as any).totalRooms ?? 1);
      const taken = booked.get(roomId) ?? 0;

      let reason: RoomSellability['reason'] = 'open';
      let unitsFree = Math.max(0, capacity - taken);
      if ((room as any).available === false) {
        reason = 'off-sale';
        unitsFree = 0;
      } else if (closed.has(roomId)) {
        reason = 'closed';
        unitsFree = 0;
      } else if (unitsFree === 0) {
        reason = 'full';
      }

      out.set(roomId, { roomId, unitsFree, reason });
    }
    return out;
  }

  /** The rooms a guest can actually book for these dates, full documents. */
  async getSellableRooms(checkIn: Date, checkOut: Date): Promise<Room[]> {
    const sellability = await this.getSellability(checkIn, checkOut);
    const sellableIds = [...sellability.values()]
      .filter((s) => s.unitsFree > 0)
      .map((s) => new Types.ObjectId(s.roomId));
    if (!sellableIds.length) return [];

    return this.roomModel
      .find({ _id: { $in: sellableIds } })
      .sort({ sortOrder: 1 })
      .lean() as unknown as Promise<Room[]>;
  }

  /** Units free for one room over the whole stay. */
  async countFreeUnits(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    session?: ClientSession,
  ): Promise<number> {
    const sellability = await this.getSellability(checkIn, checkOut, [roomId], session);
    return sellability.get(String(roomId))?.unitsFree ?? 0;
  }

  async isSellable(roomId: string, checkIn: Date, checkOut: Date): Promise<boolean> {
    return (await this.countFreeUnits(roomId, checkIn, checkOut)) > 0;
  }

  /**
   * The booking-time guard. Throws the message the guest sees, and logs why,
   * because "not available" on a night the owner closed looks like a bug from
   * the outside.
   */
  async assertSellable(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    session?: ClientSession,
  ): Promise<void> {
    // Snapshot reads alone allow write skew: two transactions can both see a
    // free room and insert different bookings. Writing the same room first
    // makes Mongo retry one transaction against the committed inventory.
    if (session) {
      await this.roomModel.updateOne(
        { _id: new Types.ObjectId(roomId) },
        { $inc: { inventoryRevision: 1 } },
        { session },
      );
    }
    const sellability = await this.getSellability(checkIn, checkOut, [roomId], session);
    const state = sellability.get(String(roomId));

    if (!state) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }
    if (state.unitsFree <= 0) {
      this.logger.warn(
        `Refused ${dayKey(checkIn)} → ${dayKey(checkOut)} for room ${roomId}: ${state.reason}`,
      );
      throw new HttpException(
        'Room is not available for the selected dates',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ─── One room, night by night ─────────────────────────────────────────────

  /**
   * One room over a date range, in the shape the admin room page and the room
   * calendar read: a row per night with the closure that covers it.
   */
  async getRoomNights(
    roomId: string,
    from: string,
    to: string,
  ): Promise<{
    room: Room | null;
    availability: {
      date: string;
      available: boolean;
      bookedCount: number;
      blocked: boolean;
      blockReason: string | null;
      blockId: string | null;
      totalRooms: number;
    }[];
  }> {
    const days = Math.max(1, nightsBetween(from, to));
    const [occupancy, room] = await Promise.all([
      this.getOccupancy(from, days, [roomId]),
      this.roomModel.findById(roomId).lean() as unknown as Promise<Room | null>,
    ]);

    const nights = occupancy.rooms[0]?.nights ?? [];
    const totalRooms = occupancy.rooms[0]?.totalRooms ?? 1;

    return {
      room,
      availability: nights.map((night) => ({
        date: night.date,
        available: (night.unitsFree ?? 0) > 0,
        bookedCount: night.count ?? 0,
        blocked: night.status === 'closed',
        blockReason: night.status === 'closed' ? night.reason ?? null : null,
        blockId: night.blockId ?? null,
        totalRooms,
      })),
    };
  }

  /** Today at the property, so callers do not each pick a timezone. */
  today(): string {
    return todayAtProperty();
  }
}
