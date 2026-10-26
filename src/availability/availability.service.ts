import { Injectable } from '@nestjs/common';
import { AvailabilityEngine } from './availability-engine';
import { addDays, dayKey, nightsBetween, summarizeProperty } from './availability-rules';

/**
 * The guest-facing availability endpoints. All of the arithmetic lives in
 * AvailabilityEngine; this only shapes it for the callers that already exist.
 */
@Injectable()
export class AvailabilityService {
  constructor(private readonly engine: AvailabilityEngine) {}

  async getRoomAvailability(roomId: string, date: string) {
    const day = dayKey(date);
    const { availability } = await this.engine.getRoomNights(roomId, day, addDays(day, 1));
    return availability[0] ?? null;
  }

  async getDateAvailability(date: string) {
    const day = dayKey(date);
    const occupancy = await this.engine.getOccupancy(day, 1);
    return occupancy.rooms.map((room) => {
      const night = room.nights[0];
      const isAvailable = (night?.unitsFree ?? 0) > 0;
      return {
        roomId: room._id,
        roomName: room.name,
        totalRooms: room.totalRooms,
        isAvailable,
        status: night?.status ?? 'free',
        color: isAvailable ? 'green' : 'red',
        textColor: 'white',
      };
    });
  }

  async getMonthlyAvailability(roomId: string, month?: number, year?: number) {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();

    const occupancy = await this.engine.getOccupancy(from, days, [roomId]);
    const room = occupancy.rooms[0];
    if (!room) return {};

    const availability: Record<string, unknown> = {};
    for (const night of room.nights) {
      const isAvailable = (night.unitsFree ?? 0) > 0;
      availability[night.date] = {
        roomId: room._id,
        roomName: room.name,
        totalRooms: room.totalRooms,
        isAvailable,
        status: night.status,
        reason: night.reason,
        color: isAvailable ? 'green' : 'red',
        textColor: 'white',
      };
    }
    return availability;
  }

  invalidateCalendarCache() {
    this.engine.invalidate();
  }

  async getCalendarAvailability(month?: number, year?: number) {
    return this.engine.getPropertyCalendar(month, year);
  }

  async getAvailabilityOverview() {
    const today = this.engine.today();
    const nextWeek = addDays(today, 7);

    const occupancy = await this.engine.getOccupancy(today, nightsBetween(today, nextWeek) + 1);
    const nights = summarizeProperty(occupancy);

    const perRoom = (index: number) =>
      occupancy.rooms.map((room) => {
        const night = room.nights[index];
        const isAvailable = (night?.unitsFree ?? 0) > 0;
        return {
          roomId: room._id,
          roomName: room.name,
          totalRooms: room.totalRooms,
          isAvailable,
          status: night?.status ?? 'free',
          reason: night?.reason,
          color: isAvailable ? 'green' : 'red',
          textColor: 'white',
        };
      });

    const todayRooms = perRoom(0);
    const nextWeekIndex = Math.max(0, occupancy.dates.indexOf(nextWeek));

    return {
      today: todayRooms,
      nextWeek: perRoom(nextWeekIndex),
      totalRooms: nights[today]?.totalRooms ?? 0,
      sellableRooms: nights[today]?.sellableRooms ?? 0,
      availableToday: nights[today]?.availableRooms ?? 0,
      bookedToday: todayRooms.filter((r) => r.status === 'booked').length,
      closedToday: todayRooms.filter((r) => r.status === 'closed').length,
    };
  }
}
