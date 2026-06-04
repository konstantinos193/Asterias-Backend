/**
 * One-off script: recreate the bookings collection without a problematic unique index
 * on bookingcom_booking_id that was accidentally created in a prior deployment.
 *
 * Run ONCE manually when needed — never import this from application code:
 *   npx ts-node scripts/emergency-fix-collection.ts
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri);
  const collection = mongoose.connection.collection('bookings');

  const allDocuments = await collection.find({}).toArray();
  console.log(`Found ${allDocuments.length} booking documents to preserve`);

  const indexes = await collection.indexes();
  const problematic = indexes.find(
    (idx: any) => idx.key?.bookingcom_booking_id === 1 && idx.unique === true,
  );

  if (!problematic) {
    console.log('No problematic unique index found on bookingcom_booking_id — nothing to do.');
    await mongoose.disconnect();
    return;
  }

  console.log('Dropping problematic index:', problematic.name);
  await collection.dropIndex(problematic.name);

  console.log('Confirmed: problematic index removed.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
