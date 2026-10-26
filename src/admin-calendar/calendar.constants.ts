/**
 * Status sets now live in common/enums.ts, which is the one source for the
 * whole codebase. They are re-exported here so the existing admin-calendar
 * imports keep working and there is still only one definition.
 */
export {
  BOOKING_STATUS,
  BOOKING_STATUSES,
  PAYMENT_STATUS,
  PAYMENT_STATUSES,
  PAYMENT_METHOD,
  PAYMENT_METHODS,
  BOOKING_SOURCE,
  BOOKING_SOURCES,
} from '../common/enums';
export type {
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
  BookingSource,
} from '../common/enums';

/** Why a stay cannot sit on these nights. The UI maps each code to its wording. */
export const CONFLICT_CODES = {
  roomNotFound: 'ROOM_NOT_FOUND',
  roomOffSale: 'ROOM_OFF_SALE',
  nightClosed: 'NIGHT_CLOSED',
  noUnitsFree: 'NO_UNITS_FREE',
  /** A closure asked for over nights a guest already holds. */
  nightBooked: 'NIGHT_BOOKED',
} as const;
export type ConflictCode = (typeof CONFLICT_CODES)[keyof typeof CONFLICT_CODES];

/** The refusal in words. The panel reads the code; the text is for anything else. */
export const CONFLICT_MESSAGES: Record<ConflictCode, string> = {
  [CONFLICT_CODES.roomNotFound]: 'Το δωμάτιο δεν βρέθηκε',
  [CONFLICT_CODES.roomOffSale]: 'Το δωμάτιο είναι εκτός πώλησης',
  [CONFLICT_CODES.nightClosed]: 'Η περίοδος περιέχει κλειστή ημερομηνία',
  [CONFLICT_CODES.noUnitsFree]: 'Δεν υπάρχει ελεύθερη μονάδα σε αυτές τις ημερομηνίες',
  [CONFLICT_CODES.nightBooked]: 'Υπάρχει κράτηση σε αυτές τις ημερομηνίες',
};

/** Nights one grid request may cover. Matches the admin occupancy ceiling. */
export const MAX_GRID_NIGHTS = 92;
export const DEFAULT_GRID_NIGHTS = 30;

/** Nights one stay may cover, so a mis-dragged strip cannot book a year. */
export const MAX_STAY_NIGHTS = 120;
