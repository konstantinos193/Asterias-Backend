import { PersistenceModule } from '../database/persistence.module';
import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PersistenceModule,
    AuthModule
  ],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
