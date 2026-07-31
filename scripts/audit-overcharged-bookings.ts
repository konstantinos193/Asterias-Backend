/**
 * Read-only audit: find card bookings that were charged more than the guest was
 * shown, and report the refund owed for each.
 *
 * The booking wizard used to display the PRE-TAX room subtotal while the Stripe
 * PaymentIntent charged the TAX-INCLUSIVE total. Every CARD booking taken before
 * that was fixed is affected; the refund owed is the tax/fee portion the guest
 * never agreed to:
 *
 *   shown  = room subtotal
 *   paid   = subtotal + VAT + municipal fee + climate fee
 *   refund = paid - shown
 *
 * This script WRITES NOTHING. It prints a table and a CSV you can hand to
 * accounting or use to issue Stripe refunds.
 *
 *   npx ts-node scripts/audit-overcharged-bookings.ts
 *   npx ts-node scripts/audit-overcharged-bookings.ts --before 2026-07-31
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const DAY_MS = 24 * 60 * 60 * 1000;

type Rates = { taxRate: number; municipalFee: number; environmentalTax: number };

/** Same fallbacks as PricingService.TAX_DEFAULTS. */
const DEFAULT_RATES: Rates = { taxRate: 13, municipalFee: 0.5, environmentalTax: 2.0 };

const eur = (n: number) => `€${n.toFixed(2)}`;

function toUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.max(
    0,
    Math.round((toUtcMidnight(checkOut).getTime() - toUtcMidnight(checkIn).getTime()) / DAY_MS),
  );
}

/**
 * Recover the pre-tax subtotal from the amount actually charged.
 *
 * paid = subtotal * (1 + vat) + municipal * nights + climate * nights * guests
 * so   subtotal = (paid - fees) / (1 + vat)
 */
function inferSubtotal(paid: number, nights: number, guests: number, rates: Rates): number {
  const fees = rates.municipalFee * nights + rates.environmentalTax * nights * Math.max(guests, 1);
  return (paid - fees) / (1 + rates.taxRate / 100);
}

function parseBeforeArg(): Date | null {
  const i = process.argv.indexOf('--before');
  if (i === -1) return null;
  const d = new Date(process.argv[i + 1]);
  if (Number.isNaN(d.getTime())) throw new Error('--before needs a date like 2026-07-31');
  return d;
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  const before = parseBeforeArg();

  await mongoose.connect(uri);
  const settingsCollection = mongoose.connection.collection('settings');
  const bookingsCollection = mongoose.connection.collection('bookings');

  const settings = await settingsCollection.findOne({});
  const rates: Rates = {
    taxRate: settings?.taxRate ?? DEFAULT_RATES.taxRate,
    municipalFee: settings?.municipalFee ?? DEFAULT_RATES.municipalFee,
    environmentalTax: settings?.environmentalTax ?? DEFAULT_RATES.environmentalTax,
  };

  console.log('Rates used (from settings, falling back to defaults):');
  console.log(
    `  VAT ${rates.taxRate}%  |  municipal ${eur(rates.municipalFee)}/night  |  climate ${eur(rates.environmentalTax)}/guest/night\n`,
  );

  const filter: any = {
    paymentMethod: 'CARD',
    paymentStatus: 'PAID',
    bookingStatus: { $nin: ['CANCELLED'] },
    // Bookings written after the fix carry the breakdown; those were quoted
    // correctly and are not affected.
    roomSubtotal: { $in: [null, undefined] },
  };
  if (before) filter.createdAt = { $lt: before };

  const bookings = await bookingsCollection.find(filter).sort({ createdAt: 1 }).toArray();

  if (bookings.length === 0) {
    console.log('No affected card bookings found.');
    return;
  }

  const rows: Array<Record<string, string | number>> = [];
  let totalOwed = 0;

  for (const b of bookings) {
    const paid = Number(b.totalAmount) || 0;
    const nights = nightsBetween(new Date(b.checkIn), new Date(b.checkOut));
    const guests = (Number(b.adults) || 0) + (Number(b.children) || 0);
    const shown = inferSubtotal(paid, nights, guests, rates);
    const refund = Math.round((paid - shown) * 100) / 100;

    // A non-positive or absurd refund means this booking was not priced by the
    // affected formula (legacy import, manual edit). Flag rather than guess.
    const suspect = refund <= 0 || refund > paid;

    totalOwed += suspect ? 0 : refund;

    rows.push({
      booking: b.bookingNumber || String(b._id),
      guest: `${b.guestInfo?.firstName ?? ''} ${b.guestInfo?.lastName ?? ''}`.trim(),
      email: b.guestInfo?.email ?? '',
      checkIn: new Date(b.checkIn).toISOString().slice(0, 10),
      nights,
      guests,
      shown: Math.round(shown * 100) / 100,
      paid,
      refund: suspect ? 0 : refund,
      stripePaymentIntentId: b.stripePaymentIntentId ?? '',
      note: suspect ? 'CHECK MANUALLY — figures do not fit the formula' : '',
    });
  }

  console.table(
    rows.map(r => ({
      Booking: r.booking,
      Guest: r.guest,
      'Check-in': r.checkIn,
      N: r.nights,
      G: r.guests,
      Shown: eur(Number(r.shown)),
      Paid: eur(Number(r.paid)),
      Refund: eur(Number(r.refund)),
      Note: r.note,
    })),
  );

  const flagged = rows.filter(r => r.note).length;
  console.log(`\n${rows.length} affected card bookings.`);
  if (flagged) console.log(`${flagged} need a manual look (excluded from the total).`);
  console.log(`Total to refund: ${eur(Math.round(totalOwed * 100) / 100)}\n`);

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  console.log('--- CSV ---');
  console.log(csv);
}

run()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
