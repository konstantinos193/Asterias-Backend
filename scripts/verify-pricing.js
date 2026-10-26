/**
 * Regression tests for the stay price, run against the compiled output:
 *
 *   npm run build && node --test scripts/verify-pricing.js
 *
 * PricingService is the only thing allowed to price a stay. These cases cover
 * the two ways that was broken: VAT was multiplied onto rates that already
 * included it, and the room-combination search worked prices out on its own
 * from `room.price`, so the search showed one number and checkout charged
 * another.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const { PricingService } = require(path.join(DIST, 'pricing/pricing.service'));

/** Production's settings document: 13% VAT and the €2 per-night stay fee. */
const settings = (over = {}) => ({
  getSettings: async () => ({ taxRate: 13, municipalFee: 2, environmentalTax: 0, ...over }),
});

/** No seasonal periods, so every night falls back to the room's own rate. */
const noSeasons = { find: () => ({ lean: async () => [] }) };

/** Seasonal periods as activePeriods() reads them. */
const seasons = (periods) => ({ find: () => ({ lean: async () => periods }) });

const room = (over = {}) => ({
  _id: 'r1',
  name: 'A1',
  roomType: '2beds',
  price: 60,
  capacity: 4,
  totalRooms: 1,
  pricingByOccupancy: [
    { guests: 2, price: 60 },
    { guests: 4, price: 80 },
  ],
  ...over,
});

const service = (seasonal = noSeasons, settingsService = settings()) =>
  new PricingService(null, seasonal, null, settingsService);

test('VAT is inside the rate, so only the stay fee is added', async () => {
  // €60 a night for two nights, VAT-inclusive, plus €2 a night. Adding 13% on
  // top instead billed €139.60 for a stay the site advertised at €124.
  const taxes = await service().applyTaxes(120, 2, 2);
  assert.strictEqual(taxes.vatAmount, 0, 'nothing is charged on top');
  assert.strictEqual(taxes.vatIncluded, 13.81, 'the VAT inside €120 at 13%');
  assert.strictEqual(taxes.municipalFee, 4);
  assert.strictEqual(taxes.total, 124);
});

test('the lines of the breakdown add up to the total', async () => {
  const taxes = await service().applyTaxes(187.5, 3, 4);
  assert.strictEqual(
    Math.round((187.5 + taxes.municipalFee + taxes.environmentalTax) * 100) / 100,
    taxes.total,
  );
});

test('a per-guest environmental fee is per guest per night', async () => {
  const taxes = await service(noSeasons, settings({ environmentalTax: 1.5 })).applyTaxes(120, 2, 3);
  assert.strictEqual(taxes.environmentalTax, 9);
  assert.strictEqual(taxes.total, 133);
});

test('with VAT at 0 nothing changes but the reported VAT', async () => {
  const taxes = await service(noSeasons, settings({ taxRate: 0 })).applyTaxes(120, 2, 2);
  assert.strictEqual(taxes.vatIncluded, 0);
  assert.strictEqual(taxes.total, 124);
});

test('a quote is the whole stay, per occupancy tier', async () => {
  const quote = await service().quoteStay(room(), '2026-11-10', '2026-11-12', 2, 0);
  assert.strictEqual(quote.nights, 2);
  assert.strictEqual(quote.subtotal, 120, 'two nights, not one');

  const four = await service().quoteStay(room(), '2026-11-10', '2026-11-12', 4, 0);
  assert.strictEqual(four.subtotal, 160);
});

test('quoteStayByGuests answers exactly as quoteStay does', async () => {
  // The room-combination search prices every occupancy it is considering
  // through this, instead of reading room.price itself.
  const quotes = await service().quoteStayByGuests(room(), '2026-11-10', '2026-11-12', [2, 3, 4]);
  assert.deepStrictEqual(
    [...quotes.keys()].sort(),
    [2, 3, 4],
  );
  for (const guests of [2, 3, 4]) {
    const one = await service().quoteStay(room(), '2026-11-10', '2026-11-12', guests, 0);
    assert.strictEqual(quotes.get(guests).subtotal, one.subtotal, `${guests} guests`);
  }
});

test('a seasonal period beats the base rate, and the search sees it too', async () => {
  const august = [
    {
      name: 'August',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      priority: 1,
      prices: { '2beds': 95 },
      active: true,
    },
  ];
  const quote = await service(seasons(august)).quoteStay(room(), '2026-08-10', '2026-08-12', 2, 0);
  assert.strictEqual(quote.subtotal, 190, 'two nights at the August rate');
  assert.strictEqual(quote.perNight[0].source, 'seasonal');

  const quotes = await service(seasons(august)).quoteStayByGuests(room(), '2026-08-10', '2026-08-12', [2]);
  assert.strictEqual(quotes.get(2).subtotal, 190, 'the search must not fall back to room.price');
});

test('the room premium rides on top of whichever rate won', async () => {
  const quote = await service().quoteStay(room({ priceAdjustment: 10 }), '2026-11-10', '2026-11-11', 2, 0);
  assert.strictEqual(quote.subtotal, 70);
});

test('a stay with no nights costs nothing', async () => {
  const quote = await service().quoteStay(room(), '2026-11-10', '2026-11-10', 2, 0);
  assert.strictEqual(quote.nights, 0);
  assert.strictEqual(quote.subtotal, 0);
});
