require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { Reflector } = require('@nestjs/core');
const { validate } = require('class-validator');
const { plainToInstance } = require('class-transformer');
const { ValidationPipe, BadRequestException, ForbiddenException } = require('@nestjs/common');
const { SettingsService } = require('../dist/settings/settings.service');
const { UpdateSettingsDto } = require('../dist/admin/dto/admin.dto');
const { SETTINGS_DEFAULTS } = require('../dist/models/settings.model');
const { CreatePaymentIntentDto } = require('../dist/payments/dto/create-payment-intent.dto');
const { BookingSchema } = require('../dist/models/booking.model');
const { ScheduledTasksService } = require('../dist/scheduled-tasks/scheduled-tasks.service');
const { MaintenanceModeGuard } = require('../dist/common/guards/maintenance-mode.guard');
const { DefaultAccessGuard } = require('../dist/auth/guards/default-access.guard');
const { Public, Authenticated } = require('../dist/auth/decorators/access.decorator');
const { RequireAdmin } = require('../dist/auth/decorators/require-admin.decorator');
const { BookingComWebhookService } = require('../dist/bookingcom-webhook/bookingcom-webhook.service');
const { HealthController } = require('../dist/health/health.controller');
const { isDayKey } = require('../dist/availability/availability-rules');
const { AuthGuard } = require('@nestjs/passport');
const crypto = require('node:crypto');
const ctx = (handler, user) => ({ getHandler: () => handler, getClass: () => class {}, switchToHttp: () => ({ getRequest: () => ({ user }) }) });

test('payment DTO refuses client currency, malformed dates and invalid occupancy', async () => {
  const valid = { roomId: '507f1f77bcf86cd799439011', checkIn: '2027-06-01', checkOut: '2027-06-03', adults: 2 };
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const metadata = { type: 'body', metatype: CreatePaymentIntentDto };
  await pipe.transform(valid, metadata);
  for (const extra of [{ currency: 'jpy' }, { adults: 0 }, { adults: 1.5 }, { checkIn: 'bad' }, { checkIn: '2027-02-30' }, { checkOut: '2027-05-01' }]) {
    await assert.rejects(pipe.transform({ ...valid, ...extra }, metadata), BadRequestException);
  }
});

test('all writable settings validate and invalid clock values fail', async () => {
  assert.equal((await validate(plainToInstance(UpdateSettingsDto, SETTINGS_DEFAULTS), { whitelist: true, forbidNonWhitelisted: true })).length, 0);
  for (const value of ['25:00', '12:99', 'bad', '1:30']) {
    assert.ok((await validate(plainToInstance(UpdateSettingsDto, { checkInTime: value }))).length);
  }
});

test('invalid dates return rule errors rather than throwing RangeError', async () => {
  const service = new SettingsService({ findOne: () => ({ lean: async () => null }) });
  assert.equal((await service.validateBookingRules('garbage', '2027-01-01')).valid, false);
  assert.equal(isDayKey('2027-99-99'), false);
  assert.equal(isDayKey('2027-02-30'), false);
  assert.equal(isDayKey('2028-02-29'), true);
});

test('settings edits are read across instances and inverted windows are rejected', async () => {
  let state = { ...SETTINGS_DEFAULTS };
  const model = { findOne: () => ({ lean: async () => ({ ...state }) }), findOneAndUpdate: async (_, update) => (state = { ...state, ...update.$set }) };
  const first = new SettingsService(model), second = new SettingsService(model);
  assert.equal(await second.get('maintenanceMode'), false);
  await first.upsertSettings({ maintenanceMode: true });
  assert.equal(await second.get('maintenanceMode'), true);
  await assert.rejects(first.upsertSettings({ minAdvanceBooking: 10, maxAdvanceBooking: 2 }), BadRequestException);
});

test('only real payment IDs participate in booking uniqueness, so cash nulls do not collide', () => {
  const [, options] = BookingSchema.indexes().find(([keys]) => keys.stripePaymentIntentId);
  assert.equal(options.unique, true);
  assert.deepEqual(options.partialFilterExpression, { stripePaymentIntentId: { $type: 'string' } });
  assert.equal(options.sparse, undefined);
});

test('email claims are exclusive, expire after a crash, and cannot be released by an old owner', async () => {
  const state = { sent: false, claim: null };
  const model = { updateOne: async (filter, update) => {
    if (filter['emailClaims.reminderSent.token'] && filter['emailClaims.reminderSent.token'] !== state.claim?.token) return { modifiedCount: 0 };
    if (filter.$or && (state.sent || (state.claim && state.claim.at.getTime() >= Date.now() - 600000))) return { modifiedCount: 0 };
    if (update.$set?.['emailClaims.reminderSent']) state.claim = update.$set['emailClaims.reminderSent'];
    if (update.$set?.reminderSent) state.sent = true;
    if (update.$unset) state.claim = null;
    return { modifiedCount: 1 };
  } };
  const service = new ScheduledTasksService({}, {}, {}, model, {}, {});
  const first = await service.claimEmail('b1', 'reminderSent');
  assert.ok(first);
  assert.equal(state.sent, false);
  assert.equal(await service.claimEmail('b1', 'reminderSent'), null);
  state.claim.at = new Date(Date.now() - 601000);
  const second = await service.claimEmail('b1', 'reminderSent');
  assert.ok(second);
  await service.releaseEmailClaim('b1', 'reminderSent', first);
  assert.equal(state.claim.token, second);
  await service.completeEmailClaim('b1', 'reminderSent', second);
  assert.equal(state.sent, true);
  assert.equal(await service.claimEmail('b1', 'reminderSent'), null);
});

test('maintenance mode allows already-paid confirmations and refuses new checkout', async () => {
  const guard = new MaintenanceModeGuard({ get: async () => true });
  const context = url => ({ getType: () => 'http', switchToHttp: () => ({ getRequest: () => ({ method: 'POST', originalUrl: url }) }) });
  for (const path of ['confirm-payment', 'confirm-checkout-session', 'stripe-webhook']) {
    assert.equal(await guard.canActivate(context('/api/payments/' + path)), true);
  }
  await assert.rejects(guard.canActivate(context('/api/payments/create-checkout-session')));
});

test('RequireAdmin alone installs both guards', () => {
  class Controller {}
  RequireAdmin()(Controller);
  const guards = Reflect.getMetadata('__guards__', Controller).map(guard => guard.name);
  assert.deepEqual(guards, ['JwtAuthGuard', 'AdminGuard']);
});

test('global access guard defaults to admin, with explicit public and authenticated exceptions', async () => {
  const Base = Object.getPrototypeOf(DefaultAccessGuard.prototype);
  const original = Base.canActivate;
  Base.canActivate = async () => true;
  try {
    const guard = new DefaultAccessGuard(new Reflector());
    const privateHandler = () => {};
    await assert.rejects(guard.canActivate(ctx(privateHandler, { role: 'USER' })), ForbiddenException);
    assert.equal(await guard.canActivate(ctx(privateHandler, { role: 'ADMIN' })), true);
    const publicHandler = () => {};
    Public()(null, null, { value: publicHandler });
    assert.equal(await guard.canActivate(ctx(publicHandler)), true);
    const ownHandler = () => {};
    Authenticated()(null, null, { value: ownHandler });
    assert.equal(await guard.canActivate(ctx(ownHandler, { role: 'USER' })), true);
  } finally { Base.canActivate = original; }
});

test('webhook verifies the signed bytes including whitespace and rejects malformed signatures', () => {
  const previous = process.env.BOOKINGCOM_WEBHOOK_SECRET;
  process.env.BOOKINGCOM_WEBHOOK_SECRET = 'local-test-secret';
  try {
    const service = new BookingComWebhookService({}, {}, {});
    const raw = Buffer.from('{  "event": "booking.created", "data": {} }');
    const signature = 'sha256=' + crypto.createHmac('sha256', 'local-test-secret').update(raw).digest('hex');
    assert.equal(service.verifyWebhookSignature(signature, raw), true);
    assert.equal(service.verifyWebhookSignature(signature, Buffer.from(JSON.stringify(JSON.parse(raw)))), false);
    assert.equal(service.verifyWebhookSignature('short', raw), false);
  } finally {
    if (previous === undefined) delete process.env.BOOKINGCOM_WEBHOOK_SECRET;
    else process.env.BOOKINGCOM_WEBHOOK_SECRET = previous;
  }
});

test('health reports missing Stripe credentials without constructing a dummy client', async () => {
  const health = new HealthController({}, null);
  assert.equal((await health.getStripeHealth()).error, 'Stripe is not configured');
});
