import { Injectable } from '@nestjs/common';
import {
  addDays,
  buildDates,
  buildOccupancy,
  dayStart,
} from '../../availability/availability-rules';
import { availabilityRevision } from '../../availability/availability-revision';
import { PricingService } from '../../pricing/pricing.service';
import { CalendarBookingsRepository } from '../repositories/calendar-bookings.repository';
import { CalendarClosuresRepository } from '../repositories/calendar-closures.repository';
import { CalendarRoomsRepository } from '../repositories/calendar-rooms.repository';
import { roomNameIndex, toClosure, toReservation, toRoom } from '../lib/calendar-mappers';
import { CalendarGrid, CalendarReservation, CalendarRoom, CalendarStats, DayKey } from '../calendar.types';

@Injectable()
export class CalendarGridService {
  constructor(
    private readonly rooms: CalendarRoomsRepository,
    private readonly bookings: CalendarBookingsRepository,
    private readonly closures: CalendarClosuresRepository,
    private readonly pricing: PricingService,
  ) {}

  /**
   * Everything one screen of the calendar needs, in one request: the room x
   * night grid, the stays on it, every closure (parked ones too) and the nightly
   * rates. The old panel asked for closures room by room and never saw the
   * nights at all.
   */
  async getGrid(from: DayKey, days: number): Promise<CalendarGrid> {
    const to = addDays(from, days);
    const start = dayStart(from);
    const end = dayStart(to);

    const [roomRows, bookingRows, closureRows, rates] = await Promise.all([
      this.rooms.listForGrid(),
      this.bookings.listOccupying(start, end),
      this.closures.listOverlapping(start, end),
      this.pricing.rateCalendar(from, days),
    ]);

    const names = roomNameIndex(roomRows);
    const activeClosures = closureRows.filter((row) => row.active !== false);

    const occupancy = buildOccupancy(
      from,
      days,
      roomRows.map((row) => ({
        _id: row._id,
        name: row.name,
        roomType: row.roomType,
        available: row.available,
        totalRooms: row.totalRooms,
      })),
      bookingRows.map((row) => ({
        _id: row._id,
        roomId: row.roomId,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
      })),
      activeClosures.map((row) => ({
        _id: row._id,
        roomId: row.roomId,
        startDate: row.startDate,
        endDate: row.endDate,
        reason: row.reason,
      })),
    );

    const nightsByRoom = new Map(occupancy.rooms.map((room) => [room._id, room.nights]));
    const rooms = roomRows.map((row) => toRoom(row, nightsByRoom.get(String(row._id)) ?? []));
    const reservations = bookingRows.map((row) => toReservation(row, names));

    return {
      from,
      to,
      dates: buildDates(from, days),
      revision: availabilityRevision(),
      stats: buildStats(from, rooms, reservations),
      rooms,
      reservations,
      closures: closureRows.map((row) => toClosure(row, names)),
      rates,
    };
  }

  /** The counter the client polls to know the grid it holds is stale. */
  revision(): { revision: number } {
    return { revision: availabilityRevision() };
  }
}

function buildStats(
  date: DayKey,
  rooms: CalendarRoom[],
  reservations: CalendarReservation[],
): CalendarStats {
  const live = reservations.filter((r) => r.status !== 'CANCELLED');

  let unitsTotal = 0;
  let unitsFree = 0;
  let unitsClosed = 0;
  for (const room of rooms) {
    const night = room.nights.find((n) => n.date === date);
    unitsTotal += room.totalRooms;
    unitsFree += night?.unitsFree ?? 0;
    if (night?.status === 'closed') unitsClosed += room.totalRooms;
  }

  return {
    date,
    arrivals: live.filter((r) => r.checkIn === date).length,
    departures: live.filter((r) => r.checkOut === date).length,
    inHouse: live.filter((r) => r.checkIn <= date && r.checkOut > date).length,
    unitsTotal,
    unitsFree,
    unitsClosed,
  };
}
