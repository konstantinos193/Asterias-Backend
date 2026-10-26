/**
 * Regression tests for the availability rules, run against the compiled output
 * so no TypeScript toolchain is involved:
 *
 *   npm run build && node --test scripts/verify-availability.js
 *
 * These are the rules every path now shares — the guest date picker, the room
 * listing, the booking-time guard and the admin grid. Each case below is a
 * disagreement that was live in this codebase: the owner closed an apartment
 * and the admin calendar went grey while the site kept selling the same nights.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const RULES = path.join(__dirname, '..', 'dist', 'availability', 'availability-rules');
const {
  OFF_SALE_REASON,
  buildOccupancy,
  closureFilter,
  occupyingBookingFilter,
  stayNights,
  summarizeProperty,
} = require(RULES);

const room = (over = {}) => ({
  _id: 'r1',
  name: 'A1',
  roomType: '2beds',
  totalRooms: 1,
  available: true,
  ...over,
});

const booking = (over = {}) => ({
  _id: 'b1',
  roomId: 'r1',
  checkIn: '2026-11-10',
  checkOut: '2026-11-12',
  bookingStatus: 'CONFIRMED',
  ...over,
});

const closure = (over = {}) => ({
  _id: 'c1',
  roomId: 'r1',
  startDate: '2026-11-10',
  endDate: '2026-11-12',
  reason: 'Συντήρηση',
  ...over,
});

/** Five nights from the 9th, for one room. */
const nightsOf = (rooms, bookings = [], closures = []) =>
  buildOccupancy('2026-11-09', 5, rooms, bookings, closures).rooms[0].nights;

test('a stay occupies the nights it sleeps, not the checkout day', () => {
  assert.deepStrictEqual(
    nightsOf([room()], [booking()]).map((n) => n.status),
    ['free', 'booked', 'booked', 'free', 'free'],
  );
});

test('a PENDING booking occupies the room', () => {
  // The guest calendar used to count CONFIRMED and CHECKED_IN only, while the
  // booking-time guard refused anything not CANCELLED.
  assert.deepStrictEqual(occupyingBookingFilter(new Date(), new Date()).bookingStatus, {
    $nin: ['CANCELLED'],
  });
  assert.strictEqual(nightsOf([room()], [booking({ bookingStatus: 'PENDING' })])[1].status, 'booked');
});

test('a cancelled booking is not in the window at all', () => {
  // The filter keeps them out of the query; nothing downstream has to re-check.
  const nights = nightsOf([room()], []);
  assert.strictEqual(nights[1].status, 'free');
});

test('a closure takes the same nights off sale, and says which closure', () => {
  const nights = nightsOf([room()], [], [closure()]);
  assert.deepStrictEqual(nights.map((n) => n.status), ['free', 'closed', 'closed', 'free', 'free']);
  assert.strictEqual(nights[1].blockId, 'c1');
  assert.strictEqual(nights[1].reason, 'Συντήρηση');
  assert.strictEqual(nights[1].unitsFree, 0);
});

test('a parked closure is ignored, a legacy row without the flag is not', () => {
  assert.deepStrictEqual(closureFilter(new Date(), new Date()).active, { $ne: false });
});

test('a booking wins over a closure, so the owner sees the guest', () => {
  assert.strictEqual(nightsOf([room()], [booking()], [closure()])[1].status, 'booked');
});

test('a room flagged off sale is closed every night, with nothing to reopen', () => {
  const nights = nightsOf([room({ available: false })]);
  assert.ok(nights.every((n) => n.status === 'closed' && n.unitsFree === 0));
  assert.strictEqual(nights[0].reason, OFF_SALE_REASON);
  assert.strictEqual(nights[0].blockId, undefined);
});

test('a room type with two units still sells one while the other is booked', () => {
  const night = nightsOf([room({ totalRooms: 2 })], [booking()])[1];
  assert.deepStrictEqual([night.status, night.count, night.unitsFree], ['booked', 1, 1]);
});

test('two bookings on one unit is an overbooking, not a sellable night', () => {
  const night = nightsOf([room()], [booking(), booking({ _id: 'b2' })])[1];
  assert.deepStrictEqual([night.count, night.unitsFree], [2, 0]);
});

test('the property summary never counts a closed or off-sale unit as free', () => {
  const occupancy = buildOccupancy(
    '2026-11-09',
    3,
    [
      room(),
      room({ _id: 'r2', name: 'A2', totalRooms: 2 }),
      room({ _id: 'r3', name: 'A3', available: false }),
    ],
    [booking()],
    [closure({ _id: 'c2', roomId: 'r2' })],
  );
  const nights = summarizeProperty(occupancy);

  const quiet = nights['2026-11-09'];
  assert.strictEqual(quiet.totalRooms, 4, 'every unit counts, off-sale included');
  assert.strictEqual(quiet.availableRooms, 3, 'the off-sale apartment is not free');

  const busy = nights['2026-11-10'];
  assert.strictEqual(busy.availableRooms, 0, 'booked + closed + off sale leaves nothing');
  assert.strictEqual(busy.isAvailable, false);
  assert.strictEqual(busy.status, 'booked');
  // "On sale" means not closed: a booked unit is on sale, it is just sold.
  assert.strictEqual(busy.sellableRooms, 1);
});

test('totalRooms is 0 only when there are no apartments at all', () => {
  // The guest picker treats 0 as missing data rather than a sold-out night, so
  // this must not be how an off-sale property reports itself.
  const nights = summarizeProperty(buildOccupancy('2026-11-09', 1, [room({ available: false })], [], []));
  assert.strictEqual(nights['2026-11-09'].totalRooms, 1);
  assert.strictEqual(nights['2026-11-09'].availableRooms, 0);
});

test('nights of a stay, one definition', () => {
  assert.strictEqual(stayNights('2026-11-10', '2026-11-12'), 2);
  assert.strictEqual(stayNights(new Date('2026-11-10T00:00:00.000Z'), new Date('2026-11-13T00:00:00.000Z')), 3);
  assert.strictEqual(stayNights('2026-11-10', '2026-11-10'), 0);
  assert.strictEqual(stayNights('2026-11-12', '2026-11-10'), 0, 'never negative');
});
