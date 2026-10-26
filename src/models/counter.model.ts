import { Schema as MongooseSchema, Document } from 'mongoose';

/**
 * An atomically incrementing sequence, keyed by name.
 *
 * The `counters` collection was already in use for booking numbers, but it had
 * no model, no schema and no module registration: two services reached past
 * Mongoose into `bookingModel.db.collection('counters')` directly. That worked,
 * and it meant the one collection whose correctness a unique booking number
 * depends on was the only one with no declared shape.
 *
 * `_id` is the sequence name — `booking:2026` for the 2026 booking series — so
 * the schema is written out rather than built by SchemaFactory: a custom
 * string `_id` needs `_id: false` in the options (to stop Mongoose adding its
 * own ObjectId) together with an explicit `_id` path, which the decorator form
 * cannot express.
 */
export interface CounterDocument extends Document<string> {
  _id: string;
  seq: number;
}

export const Counter = { name: 'Counter' } as const;

export const CounterSchema = new MongooseSchema<CounterDocument>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false, _id: false, collection: 'counters' },
);
