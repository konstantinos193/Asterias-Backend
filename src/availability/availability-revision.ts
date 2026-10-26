/**
 * A counter that every write touching availability bumps: a booking, a
 * cancellation, a closure, a room edit. AvailabilityEngine stamps its cached
 * calendars with it and throws them away when it moves.
 *
 * It lives here, outside Nest, because the model files are where the writes
 * actually happen and a schema hook cannot reach an injected provider. Without
 * it the cache was the last place the old bug survived: the owner closed an
 * apartment and the site kept selling those nights until the cache expired.
 */
import { Schema } from 'mongoose';

let revision = 0;

/** Called from the Room, Booking and RoomBlockedDate schema hooks. */
export function bumpAvailabilityRevision(): void {
  revision += 1;
}

export function availabilityRevision(): number {
  return revision;
}

/**
 * Query writes only: matching `find` or `findOne` as well would bump the
 * revision on every read and the cache would never be used.
 */
const QUERY_WRITES =
  /^(findOneAnd(Update|Delete|Replace)|updateOne|updateMany|replaceOne|deleteOne|deleteMany)$/;

/** Bump the revision after every write to this schema. */
export function bumpRevisionOnWrite(schema: Schema): void {
  schema.post('save', bumpAvailabilityRevision);
  schema.post('insertMany', bumpAvailabilityRevision);
  schema.post(QUERY_WRITES, bumpAvailabilityRevision);
}
