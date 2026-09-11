import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ImagesController } from './images.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    }),
    CloudinaryModule,
    AuthModule,
  ],
  controllers: [ImagesController],
})
export class ImagesModule {}
