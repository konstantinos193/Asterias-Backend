/**
 * Read-only diagnosis: why a seasonal price does not show up on the site.
 *
 * A seasonal period only takes effect when BOTH hold:
 *   1. the room document has `roomType` set to '2beds' | '3beds' | '4beds'
 *   2. the covering period defines a price for that exact type
 * (see PricingService.quoteStay). A period can therefore be saved perfectly and
 * still change nothing — which reads to the owner as "the price did not save".
 *
 * `roomType` is required in the schema but was added after the rooms existed,
 * and every room edit goes through findByIdAndUpdate, which does not enforce
 * required fields on documents that never had one.
 *
 * WRITES NOTHING.
 *   npx ts-node scripts/diagnose-seasonal-pricing.ts
 *   npx ts-node scripts/diagnose-seasonal-pricing.ts --on 2026-08-10
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const VALID_TYPES = ['2beds', '3beds', '4beds'] as const;
type RoomType = (typeof VALID_TYPES)[number];

const eur = (n: number) => `€${Number(n).toFixed(2)}`;

function toUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseOnArg(): Date {
  const i = process.argv.indexOf('--on');
  if (i === -1) return toUtcMidnight(new Date());
  const d = new Date(process.argv[i + 1]);
  if (Number.isNaN(d.getTime())) throw new Error('--on needs a date like 2026-08-10');
  return toUtcMidnight(d);
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  const night = parseOnArg();

  await mongoose.connect(uri);
  const rooms = await mongoose.connection.collection('rooms').find({}).toArray();
  const periods = await mongoose.connection
    .collection('seasonalpricings')
    .find({})
    .sort({ startDate: 1 })
    .toArray();

  console.log(`\nChecking the night of ${night.toISOString().slice(0, 10)}\n`);

  // ── Rooms ────────────────────────────────────────────────────────────────
  console.log('ROOMS');
  const broken: string[] = [];
  console.table(
    rooms.map((r: any) => {
      const type = r.roomType;
      const ok = VALID_TYPES.includes(type);
      if (!ok) broken.push(r.name || String(r._id));
      return {
        Room: r.name || String(r._id),
        roomType: type ?? '(MISSING)',
        Valid: ok ? 'yes' : 'NO — seasonal pricing can never apply',
        BasePrice: r.price != null ? eur(r.price) : '(none)',
        Units: r.totalRooms ?? 1,
      };
    }),
  );

  // ── Periods ──────────────────────────────────────────────────────────────
  console.log('\nSEASONAL PERIODS');
  if (periods.length === 0) {
    console.log('  (none defined)');
  } else {
    console.table(
      periods.map((p: any) => ({
        Name: p.name,
        From: new Date(p.startDate).toISOString().slice(0, 10),
        To: new Date(p.endDate).toISOString().slice(0, 10),
        '2beds': p.prices?.['2beds'] != null ? eur(p.prices['2beds']) : '—',
        '3beds': p.prices?.['3beds'] != null ? eur(p.prices['3beds']) : '—',
        '4beds': p.prices?.['4beds'] != null ? eur(p.prices['4beds']) : '—',
        Priority: p.priority ?? 0,
        Active: p.active === false ? 'NO' : 'yes',
      })),
    );
  }

  // ── What each room would actually be priced at, that night ───────────────
  // Mirrors PricingService: highest priority wins, then newest, then narrowest.
  const covering = periods
    .filter((p: any) => p.active !== false)
    .filter((p: any) => {
      const ps = toUtcMidnight(new Date(p.startDate)).getTime();
      const pe = toUtcMidnight(new Date(p.endDate)).getTime();
      return ps <= night.getTime() && night.getTime() <= pe;
    })
    .sort(
      (a: any, b: any) =>
        (b.priority || 0) - (a.priority || 0) ||
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime() ||
        new Date(a.endDate).getTime() -
          new Date(a.startDate).getTime() -
          (new Date(b.endDate).getTime() - new Date(b.startDate).getTime()),
    );

  console.log('\nEFFECTIVE PRICE THAT NIGHT');
  console.table(
    rooms.map((r: any) => {
      const type: RoomType | undefined = VALID_TYPES.includes(r.roomType) ? r.roomType : undefined;
      const hit = type
        ? covering.find((p: any) => typeof p.prices?.[type] === 'number')
        : undefined;
      return {
        Room: r.name || String(r._id),
        Price: hit ? eur(hit.prices[type as RoomType]) : r.price != null ? eur(r.price) : '(none)',
        Source: hit ? `seasonal — ${hit.name}` : type ? 'base price (no period covers it)' : 'base price (roomType MISSING)',
      };
    }),
  );

  // ── Verdict ──────────────────────────────────────────────────────────────
  console.log('');
  if (broken.length > 0) {
    console.log(
      `PROBLEM: ${broken.length} room(s) have no valid roomType: ${broken.join(', ')}`,
    );
    console.log(
      'Seasonal prices will NEVER apply to these, however correctly the periods are set.',
    );
    console.log('Fix: open each room in the admin panel, set the room type, save.');
  } else if (covering.length === 0) {
    console.log('All rooms have a valid roomType, but no active period covers that night.');
    console.log('Check the period dates — endDate is the LAST priced night, inclusive.');
  } else {
    console.log('Rooms and periods look consistent for that night.');
  }
  console.log('');
}

run()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
