import { buildDates, dayKey, nightsBetween } from '../../availability/availability-rules';
import { CONFLICT_CODES } from '../calendar.constants';
import { CalendarConflict, DayKey } from '../calendar.types';

export interface RoomCapacity {
  available: boolean;
  totalRooms: number;
}

export interface NightSpan {
  start: Date | string;
  end: Date | string;
}

export interface ClosureSpan extends NightSpan {
  reason?: string;
}

/** Nights a span covers inside the stay, start inclusive and end exclusive. */
function covers(span: NightSpan, night: DayKey): boolean {
  return night >= dayKey(span.start) && night < dayKey(span.end);
}

/**
 * Whether a stay can sit on [checkIn, checkOut) in this room, given the closures
 * and the other stays already on those nights. Pure: the caller does the reading.
 *
 * The first refusing night wins, so the message can name a date instead of
 * saying the move is impossible somewhere.
 */
export function findConflict(
  room: RoomCapacity,
  checkIn: DayKey,
  checkOut: DayKey,
  closures: ClosureSpan[],
  occupants: NightSpan[],
): CalendarConflict | null {
  if (!room.available) {
    return { code: CONFLICT_CODES.roomOffSale };
  }

  const capacity = Math.max(1, room.totalRooms);
  const nights = buildDates(checkIn, nightsBetween(checkIn, checkOut));

  for (const night of nights) {
    const closure = closures.find((c) => covers(c, night));
    if (closure) {
      return { code: CONFLICT_CODES.nightClosed, date: night, reason: closure.reason ?? '' };
    }

    const taken = occupants.filter((o) => covers(o, night)).length;
    if (taken >= capacity) {
      return { code: CONFLICT_CODES.noUnitsFree, date: night };
    }
  }

  return null;
}
