import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpException,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RequireAdmin } from '../auth/decorators/require-admin.decorator';
import { Response } from 'express';

@Controller('images')
export class ImagesController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'), false);
        }
      },
    }),
  )
  async uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    try {
      if (!files || files.length === 0) {
        throw new HttpException('No files uploaded', HttpStatus.BAD_REQUEST);
      }

      const uploadResults = await this.cloudinaryService.uploadFiles(files);

      const uploadedFiles = uploadResults.map(result => ({
        filename: result.public_id,
        originalName: result.original_filename || result.public_id,
        size: result.bytes || 0,
        url: result.secure_url,
      }));

      return {
        message: 'Files uploaded successfully',
        files: uploadedFiles,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to upload files',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':publicId')
  getFile(@Param('publicId') publicId: string, @Res() res: Response) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dguz3xo20';
    const cloudinaryUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
    res.redirect(302, cloudinaryUrl);
  }

  @Delete(':publicId')
  async deleteFile(@Param('publicId') publicId: string) {
    try {
      await this.cloudinaryService.deleteFile(publicId);
      return { message: 'Image deleted successfully' };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to delete image',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
