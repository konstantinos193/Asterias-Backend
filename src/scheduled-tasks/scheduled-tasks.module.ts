import { Module } from '@nestjs/common';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { EmailModule } from '../email/email.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from '../models/booking.model';
import { Room, RoomSchema } from '../models/room.model';
import { ChannelManagerModule } from '../channel-manager/channel-manager.module';

@Module({
  imports: [
    EmailModule,
    ChannelManagerModule,
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Room.name, schema: RoomSchema }
    ])
  ],
  providers: [ScheduledTasksService],
  exports: [ScheduledTasksService],
})
export class ScheduledTasksModule {}
