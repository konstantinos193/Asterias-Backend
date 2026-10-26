import { Schema } from 'mongoose';

/** Durable revision for calendar polling, updated in the writer's transaction.
 * Kept below the models: schema hooks have a connection, not a Nest provider.
 */
export function bumpRevisionOnWrite(schema: Schema): void {
  async function bump(this: any) {
    const model = this.db ? this : this.model?.db ? this.model : this.constructor;
    const session = this.getOptions?.().session ?? this.$session?.();
    await model.db.collection('counters').updateOne(
      { _id: 'availability' }, { $inc: { seq: 1 } }, { upsert: true, session },
    );
  }
  schema.post('save', bump);
  schema.post('insertMany', bump);
  schema.post('bulkWrite', bump);
  schema.post(/^(findOneAnd(Update|Delete|Replace)|updateOne|updateMany|replaceOne|deleteOne|deleteMany)$/, bump);
}
