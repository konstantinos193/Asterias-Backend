import { PersistenceModule } from '../database/persistence.module';
import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';

/**
 * The schema used to be declared inline here — the only model in the codebase
 * not defined in models/. It now lives in models/settings.model.ts with the
 * interface, the defaults and the writable-key list all derived from the same
 * declaration.
 */
@Module({
  imports: [
    PersistenceModule,
  ],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
