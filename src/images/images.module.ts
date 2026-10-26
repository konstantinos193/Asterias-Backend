import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ImagesController } from './images.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AuthModule } from '../auth/auth.module';
import { MAX_IMAGE_UPLOAD_BYTES } from './upload.constants';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: MAX_IMAGE_UPLOAD_BYTES,
      },
    }),
    CloudinaryModule,
    AuthModule,
  ],
  controllers: [ImagesController],
})
export class ImagesModule {}
