import { OccupancyNight } from '../availability/availability-rules';
import { RateCalendar } from '../pricing/pricing.service';
import {
  BookingSource,
  BookingStatus,
  ConflictCode,
  PaymentMethod,
  PaymentStatus,
} from './calendar.constants';

/** Dates on the wire are day keys (YYYY-MM-DD), never ISO timestamps: the grid
 *  reasons in nights at the property, and a timestamp drags a timezone with it. */
export type DayKey = string;

export interface CalendarGuest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialRequests: string;
}

export interface CalendarReservation {
  _id: string;
  bookingNumber: string;
  status: BookingStatus;
  source: BookingSource;
  roomId: string | null;
  roomName: string;
  checkIn: DayKey;
  /** Exclusive: the morning the room frees up. */
  checkOut: DayKey;
  nights: number;
  guest: CalendarGuest;
  adults: number;
  children: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes: string;
  adminNotes: string;
  /** The multi-room booking this stay belongs to, master included; null when it stands alone. */
  groupId: string | null;
  isGroupMaster: boolean;
}

export interface CalendarClosure {
  _id: string;
  roomId: string;
  roomName: string;
  startDate: DayKey;
  /** Exclusive: the first morning the room is open again. */
  endDate: DayKey;
  reason: string;
  active: boolean;
}

export interface CalendarRoom {
  _id: string;
  name: string;
  roomType: string;
  floor: string;
  price: number;
  available: boolean;
  /** Why it is off sale, for the owner; availability only reads `available`. */
  roomStatus: 'available' | 'closed' | 'maintenance';
  totalRooms: number;
  capacity: number;
  nights: OccupancyNight[];
}

export interface CalendarStats {
  date: DayKey;
  arrivals: number;
  departures: number;
  inHouse: number;
  unitsTotal: number;
  unitsFree: number;
  unitsClosed: number;
}

export interface CalendarGrid {
  from: DayKey;
  /** Exclusive: the morning after the last night in the window. */
  to: DayKey;
  dates: DayKey[];
  /** Bumped by every write touching availability; the client polls it to refetch. */
  revision: number;
  stats: CalendarStats;
  rooms: CalendarRoom[];
  reservations: CalendarReservation[];
  closures: CalendarClosure[];
  /** Nightly rate per guest tier, resolved exactly as a quote resolves it. */
  rates: RateCalendar;
}

export interface CalendarConflict {
  code: ConflictCode;
  /** The first night that refuses the stay, when one night in particular does. */
  date?: DayKey;
  reason?: string;
}

export interface GroupMember {
  _id: string;
  bookingNumber: string;
  roomName: string;
  status: BookingStatus;
  checkIn: DayKey;
  checkOut: DayKey;
  adults: number;
  children: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  isMaster: boolean;
}

export interface GroupFolio {
  groupId: string;
  rooms: number;
  guests: number;
  nights: number;
  total: number;
  paid: number;
  due: number;
}

export interface ReservationGroup {
  members: GroupMember[];
  folio: GroupFolio;
}
