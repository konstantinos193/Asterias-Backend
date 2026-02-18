import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema } from 'mongoose';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Settings', schema: new Schema() }])],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
