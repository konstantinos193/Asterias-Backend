const test = require('node:test');
const assert = require('node:assert/strict');
const { AvailabilityEngine } = require('../dist/availability/availability-engine');
const { AvailabilityController } = require('../dist/availability/availability.controller');

test('range rejects impossible dates and non-integer or out-of-range spans', async () => {
  const controller = new AvailabilityController({ getCalendarRange: async () => 'ok' });
  for (const from of ['2027-02-29', '2027-02-30', '2027-13-01', 'invalid']) {
    await assert.rejects(controller.getCalendarRange(from, '400'), { status: 400 });
  }
  for (const days of ['0', '401', '1.5', '3garbage', '', '-1']) {
    await assert.rejects(controller.getCalendarRange('2027-03-01', days), { status: 400 });
  }
  assert.equal(await controller.getCalendarRange('2028-02-29', '400'), 'ok');
});

test('range finds reopening, preserves closures and reads fresh inventory', async () => {
  const engine = new AvailabilityEngine(null, null, null);
  let reads = 0;
  engine.getOccupancy = async () => {
    reads++;
    return {
      dates: ['2027-03-14', '2027-03-15'],
      rooms: [{ totalRooms: 1, nights: [
        { status: 'closed', unitsFree: 0 },
        { status: reads === 1 ? 'free' : 'booked', unitsFree: reads === 1 ? 1 : 0 },
      ] }],
    };
  };
  const result = await engine.getPropertyRange('2027-03-14', 2);
  assert.equal(result.firstOpenDate, '2027-03-15');
  assert.equal(result.availability['2027-03-14'].isAvailable, false);
  assert.equal(result.availability['2027-03-15'].availableRooms, 1);
  const updated = await engine.getPropertyRange('2027-03-14', 2);
  assert.equal(reads, 2);
  assert.equal(updated.firstOpenDate, null);
  assert.equal(updated.availability['2027-03-15'].isAvailable, false);
});
