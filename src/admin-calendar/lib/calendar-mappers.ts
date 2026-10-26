import { dayKey, nightsBetween, OccupancyNight } from '../../availability/availability-rules';
import { BookingSource } from '../calendar.constants';
import { CalendarClosure, CalendarReservation, CalendarRoom } from '../calendar.types';
import { BookingRow } from '../repositories/calendar-bookings.repository';
import { ClosureRow } from '../repositories/calendar-closures.repository';
import { RoomRow } from '../repositories/calendar-rooms.repository';

export function toReservation(row: BookingRow, roomNames: Map<string, string>): CalendarReservation {
  const checkIn = dayKey(row.checkIn);
  const checkOut = dayKey(row.checkOut);
  const roomId = row.roomId ? String(row.roomId) : null;
  const children = row.childBookingIds ?? [];

  return {
    _id: String(row._id),
    bookingNumber: row.bookingNumber ?? '',
    status: row.bookingStatus,
    source: (row.source ?? 'asterias') as BookingSource,
    roomId,
    roomName: roomId ? (roomNames.get(roomId) ?? '') : '',
    checkIn,
    checkOut,
    nights: nightsBetween(checkIn, checkOut),
    guest: {
      firstName: row.guestInfo?.firstName ?? '',
      lastName: row.guestInfo?.lastName ?? '',
      email: row.guestInfo?.email ?? '',
      phone: row.guestInfo?.phone ?? '',
      specialRequests: row.guestInfo?.specialRequests ?? '',
    },
    adults: row.adults ?? 1,
    children: row.children ?? 0,
    totalAmount: row.totalAmount ?? 0,
    paymentStatus: row.paymentStatus,
    paymentMethod: row.paymentMethod,
    notes: row.notes ?? '',
    adminNotes: row.adminNotes ?? '',
    groupId: row.parentBookingId
      ? String(row.parentBookingId)
      : children.length
        ? String(row._id)
        : null,
    isGroupMaster: children.length > 0,
  };
}

export function toClosure(row: ClosureRow, roomNames: Map<string, string>): CalendarClosure {
  const roomId = String(row.roomId);
  return {
    _id: String(row._id),
    roomId,
    roomName: roomNames.get(roomId) ?? '',
    startDate: dayKey(row.startDate),
    endDate: dayKey(row.endDate),
    reason: row.reason ?? '',
    active: row.active !== false,
  };
}

export function toRoom(row: RoomRow, nights: OccupancyNight[]): CalendarRoom {
  const available = row.available !== false;
  return {
    _id: String(row._id),
    name: row.name,
    roomType: row.roomType || '2beds',
    floor: row.floor || 'ground',
    price: row.price ?? 0,
    available,
    // Rooms written before the field existed report the flag's meaning.
    roomStatus: row.roomStatus ?? (available ? 'available' : 'closed'),
    totalRooms: Math.max(1, row.totalRooms ?? 1),
    capacity: Math.max(1, row.capacity ?? 2),
    nights,
  };
}

export function roomNameIndex(rooms: RoomRow[]): Map<string, string> {
  return new Map(rooms.map((room) => [String(room._id), room.name]));
}
