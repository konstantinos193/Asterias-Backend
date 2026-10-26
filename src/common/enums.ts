/**
 * Every status string in the system, in one place.
 *
 * These literals were written out by hand in up to 11 files each — 'CANCELLED'
 * in 11, 'CONFIRMED' in 10, 'PAID' in 10. With `noImplicitAny` and
 * `strictNullChecks` off, and most of the call sites inside `any`-typed query
 * objects, a typo like 'CANCELED' was not a compile error: it was a filter that
 * silently matched nothing, which on an availability query means selling a room
 * that is taken.
 *
 * Each group is exposed twice on purpose:
 *   - the `*_STATUS`-style object for referring to one value
 *     (`BOOKING_STATUS.CANCELLED`), so a typo is a compile error;
 *   - the `*_STATUSES` tuple for the places that need the whole set — Mongoose
 *     `enum:`, class-validator `@IsIn()`, and Mongo `$in` / `$nin` filters.
 */

export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  CHECKED_OUT: 'CHECKED_OUT',
  CANCELLED: 'CANCELLED',
} as const;
export const BOOKING_STATUSES = [
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.CHECKED_OUT,
  BOOKING_STATUS.CANCELLED,
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;
export const PAYMENT_STATUSES = [
  PAYMENT_STATUS.PENDING,
  PAYMENT_STATUS.PAID,
  PAYMENT_STATUS.FAILED,
  PAYMENT_STATUS.REFUNDED,
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHOD = {
  CARD: 'CARD',
  CASH: 'CASH',
} as const;
export const PAYMENT_METHODS = [PAYMENT_METHOD.CARD, PAYMENT_METHOD.CASH] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const BOOKING_SOURCE = {
  ASTERIAS: 'asterias',
  BOOKINGCOM: 'bookingcom',
  AIRBNB: 'airbnb',
} as const;
export const BOOKING_SOURCES = [
  BOOKING_SOURCE.ASTERIAS,
  BOOKING_SOURCE.BOOKINGCOM,
  BOOKING_SOURCE.AIRBNB,
] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const USER_ROLE = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;
export const USER_ROLES = [USER_ROLE.USER, USER_ROLE.ADMIN] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CONTACT_STATUS = {
  UNREAD: 'UNREAD',
  READ: 'READ',
  REPLIED: 'REPLIED',
  CLOSED: 'CLOSED',
} as const;
export const CONTACT_STATUSES = [
  CONTACT_STATUS.UNREAD,
  CONTACT_STATUS.READ,
  CONTACT_STATUS.REPLIED,
  CONTACT_STATUS.CLOSED,
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** Languages a guest-facing email or page is produced in. */
export const GUEST_LANGUAGE = {
  EL: 'el',
  EN: 'en',
  DE: 'de',
} as const;
export const GUEST_LANGUAGES = [
  GUEST_LANGUAGE.EL,
  GUEST_LANGUAGE.EN,
  GUEST_LANGUAGE.DE,
] as const;
export type GuestLanguage = (typeof GUEST_LANGUAGES)[number];

/**
 * The single currency the property charges in.
 *
 * Amounts are computed in euro cents by PricingService and the Stripe account
 * settles in euro. This existed as a bare 'eur' string in two services and as
 * an unvalidated, client-supplied field on a public DTO, which meant a caller
 * could ask to be charged the euro figure in a cheaper unit.
 */
export const CURRENCY = 'eur' as const;
export type Currency = typeof CURRENCY;
