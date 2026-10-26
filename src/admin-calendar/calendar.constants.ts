export const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['CARD', 'CASH'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const BOOKING_SOURCES = ['asterias', 'bookingcom', 'airbnb'] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

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
