import { PersistenceModule } from '../database/persistence.module';
import { Module } from '@nestjs/common';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { EmailModule } from '../email/email.module';
import { SettingsModule } from '../settings/settings.module';
@Module({
  imports: [
    EmailModule,
    SettingsModule,
    PersistenceModule
  ],
  providers: [ScheduledTasksService],
  exports: [ScheduledTasksService],
})
export class ScheduledTasksModule {}
