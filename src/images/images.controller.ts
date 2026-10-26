import { Public, Authenticated } from '../auth/decorators/access.decorator';
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Response } from 'express';
import { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_COUNT } from './upload.constants';

@ApiTags('images')
@Controller('images')
export class ImagesController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Upload up to 10 images to Cloudinary (admin)' })
  @UseInterceptors(
    FilesInterceptor('images', MAX_IMAGE_UPLOAD_COUNT, {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_IMAGE_UPLOAD_BYTES,
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only image files are allowed'), false);
        }
      },
    }),
  )
  async uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const uploadResults = await this.cloudinaryService.uploadFiles(files);

    return {
      message: 'Files uploaded successfully',
      files: uploadResults.map((result) => ({
        filename: result.public_id,
        originalName: result.original_filename || result.public_id,
        size: result.bytes || 0,
        url: result.secure_url,
      })),
    };
  }

  @Public()
  @Get(':publicId')
  @ApiOperation({ summary: 'Redirect to the Cloudinary URL for an image id' })
  getFile(@Param('publicId') publicId: string, @Res() res: Response) {
    // @Res() is deliberate here: the response is a 302, not a JSON body, so it
    // has to escape the TransformInterceptor's envelope entirely.
    //
    // The id is interpolated into a redirect target, and Express has already
    // percent-decoded it — so `..` segments or a stray CRLF arrive intact.
    // Restrict it to what a Cloudinary public id actually looks like.
    if (!/^[A-Za-z0-9_\-./]{1,255}$/.test(publicId) || publicId.includes('..')) {
      throw new BadRequestException('Invalid image id');
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dguz3xo20';
    const cloudinaryUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
    res.redirect(302, cloudinaryUrl);
  }

  @Delete(':publicId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Delete an image from Cloudinary (admin)' })
  async deleteFile(@Param('publicId') publicId: string) {
    await this.cloudinaryService.deleteFile(publicId);
    return { message: 'Image deleted successfully' };
  }
}
