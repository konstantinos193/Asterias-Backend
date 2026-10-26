import { PersistenceModule } from '../database/persistence.module';
import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { BrowserPoolService } from './browser-pool.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PersistenceModule,
    AuthModule,
  ],
  controllers: [PdfController],
  providers: [PdfService, BrowserPoolService],
  exports: [PdfService],
})
export class PdfModule {}
