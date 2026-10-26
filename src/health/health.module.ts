import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  // Needed for the JwtAuthGuard/AdminGuard on the diagnostic routes.
  imports: [AuthModule],
  controllers: [HealthController],
})
export class HealthModule {}
