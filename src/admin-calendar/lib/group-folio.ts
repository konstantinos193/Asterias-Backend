import { dayKey, nightsBetween } from '../../availability/availability-rules';
import { GroupMember, ReservationGroup } from '../calendar.types';
import { BookingRow } from '../repositories/calendar-bookings.repository';

const PAID_STATUSES = ['PAID'];

/**
 * The rooming list and the one number that matters per group: what the whole
 * booking owes. Pure, so the folio cannot drift from what the rows say.
 */
export function buildGroup(
  masterId: string,
  rows: BookingRow[],
  roomNames: Map<string, string>,
): ReservationGroup {
  const members: GroupMember[] = rows.map((row) => {
    const checkIn = dayKey(row.checkIn);
    const checkOut = dayKey(row.checkOut);
    const roomId = row.roomId ? String(row.roomId) : '';
    return {
      _id: String(row._id),
      bookingNumber: row.bookingNumber ?? '',
      roomName: roomNames.get(roomId) ?? '',
      status: row.bookingStatus,
      checkIn,
      checkOut,
      adults: row.adults ?? 1,
      children: row.children ?? 0,
      totalAmount: row.totalAmount ?? 0,
      paymentStatus: row.paymentStatus,
      isMaster: String(row._id) === masterId,
    };
  });

  const total = round2(members.reduce((sum, m) => sum + m.totalAmount, 0));
  const paid = round2(
    members
      .filter((m) => PAID_STATUSES.includes(m.paymentStatus))
      .reduce((sum, m) => sum + m.totalAmount, 0),
  );

  return {
    members,
    folio: {
      groupId: masterId,
      rooms: members.length,
      guests: members.reduce((sum, m) => sum + m.adults + m.children, 0),
      nights: members.reduce((sum, m) => sum + nightsBetween(m.checkIn, m.checkOut), 0),
      total,
      paid,
      due: round2(total - paid),
    },
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
