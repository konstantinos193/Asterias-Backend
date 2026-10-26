import { PersistenceModule } from '../database/persistence.module';
import { Module } from '@nestjs/common';
import { AvailabilityEngine } from './availability-engine';

/**
 * Standalone on purpose: it depends on nothing but the models, so every module
 * that needs to know what is for sale can import it without a cycle.
 */
@Module({
  imports: [
    PersistenceModule,
  ],
  providers: [AvailabilityEngine],
  exports: [AvailabilityEngine],
})
export class AvailabilityEngineModule {}
