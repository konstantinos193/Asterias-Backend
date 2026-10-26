/**
 * Regression tests for the authorization fixes, run against the compiled
 * output so no TypeScript toolchain is involved:
 *
 *   npm run build && node --test scripts/verify-auth-guards.js
 *
 * Each case below is a vulnerability that was live in this codebase, not a
 * hypothetical.
 */
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const { AdminGuard } = require(path.join(DIST, 'auth/guards/admin.guard'));
const { RequireAdmin, AllowNonAdmin } = require(path.join(DIST, 'auth/decorators/require-admin.decorator'));
const { Reflector } = require('@nestjs/core');
const { ForbiddenException } = require('@nestjs/common');
const { validate } = require('class-validator');
const { plainToInstance } = require('class-transformer');
const { CreateUserDto } = require(path.join(DIST, 'auth/dto/create-user.dto'));

/** Minimal ExecutionContext stand-in. */
const ctx = (user, handler = () => {}, cls = class {}) => ({
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
  getHandler: () => handler,
  getClass: () => cls,
});

const guard = new AdminGuard(new Reflector());

test('AdminGuard rejects an unauthenticated request', () => {
  assert.throws(() => guard.canActivate(ctx(undefined)), ForbiddenException);
});

test('AdminGuard rejects a signed-in non-admin', () => {
  assert.throws(() => guard.canActivate(ctx({ _id: 'u1', role: 'USER' })), ForbiddenException);
});

test('AdminGuard admits an admin', () => {
  assert.strictEqual(guard.canActivate(ctx({ _id: 'u1', role: 'ADMIN' })), true);
});

test('AdminGuard rejects a role that merely looks like admin', () => {
  for (const role of ['admin', 'Admin', 'ADMIN ', 'SUPERADMIN', null, '', 0]) {
    assert.throws(
      () => guard.canActivate(ctx({ _id: 'u1', role })),
      ForbiddenException,
      `role ${JSON.stringify(role)} should not pass`,
    );
  }
});

test('the original bug: a class-level marker with a bare handler still denies non-admins', () => {
  // AdminController declares its requirement on the class. The old guard read
  // metadata from getHandler() only, found nothing, and returned true — which
  // opened the entire admin surface to any account.
  class AdminLike {}
  RequireAdmin()(AdminLike);
  const handler = function dashboard() {};

  assert.throws(
    () => guard.canActivate(ctx({ _id: 'u1', role: 'USER' }, handler, AdminLike)),
    ForbiddenException,
  );
  assert.strictEqual(guard.canActivate(ctx({ _id: 'u1', role: 'ADMIN' }, handler, AdminLike)), true);
});

test('the other half of the bug: no marker anywhere still denies non-admins', () => {
  // Rooms, offers, contact and booking writes applied the guard without any
  // marker at all, so they were open to every signed-in user.
  class RoomsLike {}
  assert.throws(
    () => guard.canActivate(ctx({ _id: 'u1', role: 'USER' }, function create() {}, RoomsLike)),
    ForbiddenException,
  );
});

test('AllowNonAdmin is the only way through, and it must be explicit', () => {
  const handler = function openRoute() {};
  AllowNonAdmin()(handler);
  assert.strictEqual(guard.canActivate(ctx({ _id: 'u1', role: 'USER' }, handler)), true);
});

test('registration rejects a caller-supplied role', async () => {
  // POST /api/auth/register used to accept role: "ADMIN" and honour it.
  const dto = plainToInstance(CreateUserDto, {
    name: 'Mallory',
    username: 'mallory',
    email: 'mallory@example.com',
    password: 'correct-horse-battery',
    role: 'ADMIN',
  });

  assert.strictEqual('role' in dto, true, 'plainToInstance keeps unknown keys; the pipe is what strips them');

  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  const offending = errors.map((e) => e.property);
  assert.deepStrictEqual(offending, ['role'], `expected role to be rejected, got ${JSON.stringify(offending)}`);
});

test('registration still accepts a legitimate payload', async () => {
  const dto = plainToInstance(CreateUserDto, {
    name: 'Alex Guest',
    username: 'alex.guest',
    email: 'alex@example.com',
    password: 'correct-horse-battery',
    phone: '+30 210 1234567',
    address: { city: 'Preveza', country: 'GR' },
  });

  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  assert.deepStrictEqual(errors.map((e) => e.property), []);
});

test('registration rejects a short password', async () => {
  const dto = plainToInstance(CreateUserDto, {
    name: 'Alex',
    username: 'alex',
    email: 'alex@example.com',
    password: 'short',
  });

  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  assert.deepStrictEqual(errors.map((e) => e.property), ['password']);
});

test('AuthService pins the role to USER regardless of input', () => {
  // Second layer, in case a future DTO change lets `role` back through.
  const { AuthService } = require(path.join(DIST, 'auth/auth.service'));
  const source = AuthService.prototype.register.toString();
  assert.match(source, /role:\s*'USER'/, 'register() must force role USER');
});

test('ThrottlerGuard is bound as a global guard', () => {
  // The limits existed before this; nothing enforced them.
  const { AppModule } = require(path.join(DIST, 'app.module'));
  const providers = Reflect.getMetadata('providers', AppModule) || [];
  const bound = providers.some(
    (p) => p && p.provide === 'APP_GUARD' && p.useClass && p.useClass.name === 'ThrottlerGuard',
  );
  assert.ok(bound, 'AppModule must bind ThrottlerGuard to APP_GUARD');
});

// ── Guest "pay on arrival" requests ────────────────────────────────────────
// The public wizard offers cash, so this path is reachable by anyone. The
// guarantee is: the guest names no price, and an unaccepted request holds no
// room.

const CASH_DTOS = path.join(DIST, 'payments/dto/create-cash-booking.dto');
const { CreateCashBookingDto, RequestCashBookingDto } = require(CASH_DTOS);

const guestPayload = {
  roomId: '507f1f77bcf86cd799439011',
  checkIn: '2026-07-01',
  checkOut: '2026-07-05',
  adults: 2,
  children: 0,
  guestInfo: { firstName: 'Lee', lastName: 'Ng', email: 'lee@example.com', phone: '+302101234567' },
};

test('a guest cannot name their own price', async () => {
  for (const field of ['totalAmount', 'depositAmount', 'depositPaid']) {
    const dto = plainToInstance(RequestCashBookingDto, { ...guestPayload, [field]: field === 'depositPaid' ? true : 1 });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    assert.deepStrictEqual(
      errors.map((e) => e.property),
      [field],
      `${field} must be rejected on a guest request`,
    );
  }
});

test('a legitimate guest request validates', async () => {
  const dto = plainToInstance(RequestCashBookingDto, guestPayload);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  assert.deepStrictEqual(errors.map((e) => e.property), []);
});

test('the admin route still accepts a negotiated total', async () => {
  const dto = plainToInstance(CreateCashBookingDto, { ...guestPayload, totalAmount: 420, depositPaid: true, depositAmount: 50 });
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  assert.deepStrictEqual(errors.map((e) => e.property), []);
});

test('the cash DTO rejects a non-ObjectId roomId', async () => {
  const dto = plainToInstance(CreateCashBookingDto, { ...guestPayload, roomId: '../../etc/passwd' });
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  assert.deepStrictEqual(errors.map((e) => e.property), ['roomId']);
});

test('an unaccepted guest request does not occupy a room', () => {
  const { occupyingBookingFilter } = require(path.join(DIST, 'availability/availability-rules'));
  const filter = occupyingBookingFilter(new Date('2026-07-01'), new Date('2026-07-05'));
  assert.deepStrictEqual(
    filter.awaitingPropertyConfirmation,
    { $ne: true },
    'availability must skip holds the property has not accepted',
  );
});

test('rows written before the flag existed still occupy', () => {
  // $ne: true matches a missing field, so no historical booking is freed.
  const { occupyingBookingFilter } = require(path.join(DIST, 'availability/availability-rules'));
  const { awaitingPropertyConfirmation } = occupyingBookingFilter(new Date(), new Date());
  const matches = (doc) => doc.awaitingPropertyConfirmation !== awaitingPropertyConfirmation.$ne;
  assert.ok(matches({}), 'a booking with no such field must still hold its room');
  assert.ok(matches({ awaitingPropertyConfirmation: false }), 'an accepted booking must hold its room');
  assert.ok(!matches({ awaitingPropertyConfirmation: true }), 'an unaccepted request must not');
});

// ── NoSQL operator injection ───────────────────────────────────────────────
// Express turns ?status[$ne]=X into a real object, so any handler that drops a
// query value into a filter accepts operators unless something stops them.

const { MongoSanitizePipe } = require(path.join(DIST, 'common/pipes/mongo-sanitize.pipe'));
const sanitize = new MongoSanitizePipe();
const asQuery = (v) => sanitize.transform(v, { type: 'query' });

test('query operators are refused', () => {
  const attacks = [
    { status: { $ne: 'CANCELLED' } },       // invert a filter
    { rating: { $gt: 0 } },                 // walk a range
    { source: { $regex: '.*' } },           // pull a field apart
    { email: { $exists: true } },           // probe for fields
    { x: { y: { $where: '1==1' } } },       // nested
    { items: [{ $ne: null }] },             // inside an array
  ];
  for (const attack of attacks) {
    assert.throws(() => asQuery(attack), /Illegal field name/, JSON.stringify(attack));
  }
});

test('dotted keys are refused', () => {
  assert.throws(() => sanitize.transform({ 'guestInfo.email': 'x' }, { type: 'body' }), /Illegal field name/);
});

test('prototype-pollution keys are refused', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const payload = JSON.parse(`{"${key}": {"polluted": true}}`);
    assert.throws(() => sanitize.transform(payload, { type: 'body' }), /Illegal field name/, key);
  }
});

test('ordinary payloads pass through untouched', () => {
  const ok = {
    status: 'CONFIRMED',
    page: '2',
    guestInfo: { firstName: 'Lee', email: 'lee@example.com' },
    tags: ['a', 'b'],
    when: new Date('2026-07-01'),
    nothing: null,
  };
  assert.strictEqual(asQuery(ok), ok, 'the pipe must not rewrite legitimate input');
});

test('absurdly deep payloads are refused rather than walked', () => {
  let deep = {};
  let cursor = deep;
  for (let i = 0; i < 40; i++) {
    cursor.next = {};
    cursor = cursor.next;
  }
  assert.throws(() => sanitize.transform(deep, { type: 'body' }), /nested too deeply/);
});

// ── Sort fields ────────────────────────────────────────────────────────────

test('sorting is restricted to an allowlist', () => {
  const { safeSort } = require(path.join(DIST, 'common/sort'));
  const allowed = ['createdAt', 'rating'];

  assert.deepStrictEqual(safeSort('rating', allowed, 'createdAt', 'asc'), { rating: 1 });
  assert.deepStrictEqual(safeSort('createdAt', allowed, 'createdAt', 'desc'), { createdAt: -1 });

  // Sorting by a field the caller cannot read still orders the page by it,
  // which leaks ordering information about hidden values.
  assert.deepStrictEqual(safeSort('password', allowed, 'createdAt', 'desc'), { createdAt: -1 });
  assert.deepStrictEqual(safeSort({ $meta: 'x' }, allowed, 'createdAt', 'desc'), { createdAt: -1 });
  assert.deepStrictEqual(safeSort(undefined, allowed, 'createdAt', 'desc'), { createdAt: -1 });
});
