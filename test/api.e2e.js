require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { Module, Global, ValidationPipe } = require('@nestjs/common');
const { getConnectionToken } = require('@nestjs/mongoose');
const { ConfigModule } = require('@nestjs/config');
const { ScheduleModule } = require('@nestjs/schedule');
const { TransformInterceptor } = require('../dist/common/interceptors/transform.interceptor');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const { DefaultAccessGuard } = require('../dist/auth/guards/default-access.guard');
const { Reflector } = require('@nestjs/core');
const { PaymentsService } = require('../dist/payments/payments.service');

// Boot every feature module without contacting production services. Real
// guards, controllers, pipes and interceptors run; Mongo and Stripe are doubles.
function query(value = null) {
  const chain = { then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
  for (const name of ['lean', 'select', 'sort', 'limit', 'skip', 'populate', 'session']) chain[name] = () => chain;
  chain.exec = () => Promise.resolve(value);
  return chain;
}
const connection = { models: {}, readyState: 1, model(name) {
  if (!this.models[name]) {
    const model = function Model(data) { Object.assign(this, data); };
    model.findOne = () => query(null);
    model.findById = () => query(null);
    this.models[name] = model;
  }
  return this.models[name];
} };
class TestDatabase {}
Global()(TestDatabase);
Module({ providers: [{ provide: getConnectionToken(), useValue: connection }], exports: [getConnectionToken()] })(TestDatabase);

const features = [
  ['admin/admin.module', 'AdminModule'], ['admin-calendar/admin-calendar.module', 'AdminCalendarModule'],
  ['auth/auth.module', 'AuthModule'], ['availability/availability.module', 'AvailabilityModule'],
  ['bookings/bookings.module', 'BookingsModule'], ['bookingcom-webhook/bookingcom-webhook.module', 'BookingComWebhookModule'],
  ['contact/contact.module', 'ContactModule'], ['email/email.module', 'EmailModule'],
  ['health/health.module', 'HealthModule'], ['images/images.module', 'ImagesModule'],
  ['offers/offers.module', 'OffersModule'], ['payments/payments.module', 'PaymentsModule'],
  ['pdf/pdf.module', 'PdfModule'], ['reviews/reviews.module', 'ReviewsModule'],
  ['rooms/rooms.module', 'RoomsModule'], ['scheduled-tasks/scheduled-tasks.module', 'ScheduledTasksModule'],
  ['users/users.module', 'UsersModule'], ['stripe/stripe.module', 'StripeModule'],
].map(([file, name]) => require('../dist/' + file)[name]);

test('all feature modules boot and HTTP boundaries enforce access, validation and response contracts', async () => {
  const module = await Test.createTestingModule({ imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ JWT_SECRET: 'test-only-'.repeat(5) })] }),
    TestDatabase, ScheduleModule.forRoot({ cronJobs: false, intervals: false, timeouts: false }), ...features,
  ] }).compile();
  const app = module.createNestApplication();
  app.useLogger(false);
  app.setGlobalPrefix('api');
  app.useGlobalGuards(new DefaultAccessGuard(app.get(Reflector)));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  try {
    await app.init();
    const server = app.getHttpServer();
    const health = await request(server).get('/api/health').expect(200);
    assert.equal(health.body.data.status, 'OK');
    await request(server).get('/api/admin/settings').expect(401);
    await request(server).get('/api/auth/profile').expect(401);
    await request(server).post('/api/payments/create-cash-booking').send({}).expect(401);
    const bad = await request(server).post('/api/payments/create-payment-intent').send({ currency: 'jpy' }).expect(400);
    assert.ok(Array.isArray(bad.body.message));
    const payments = app.get(PaymentsService);
    payments.createPaymentIntent = async () => ({ clientSecret: 'test-secret', currency: 'eur' });
    const good = await request(server).post('/api/payments/create-payment-intent').send({
      roomId: '507f1f77bcf86cd799439011', checkIn: '2027-06-01', checkOut: '2027-06-03', adults: 2,
    }).expect(201);
    assert.equal(good.body.data.currency, 'eur');
    assert.equal(good.body.data.clientSecret, 'test-secret');
  } finally { await app.close(); }
});
