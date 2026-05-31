import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dguz3xo20',
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'asterias-homes'): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder,
        resource_type: 'auto' as const,
        public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9]/g, '_')}`,
        overwrite: true,
      };

      // Create a readable stream from the buffer
      const stream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(new HttpException(
              `Cloudinary upload failed: ${error.message}`,
              HttpStatus.INTERNAL_SERVER_ERROR,
            ));
          } else {
            resolve(result);
          }
        },
      );

      // Write the buffer to the stream
      stream.write(file.buffer);
      stream.end();
    });
  }

  async uploadFiles(files: Express.Multer.File[], folder: string = 'asterias-homes') {
    const uploadPromises = files.map(file => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  async deleteFile(publicId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          reject(new HttpException(
            `Cloudinary delete failed: ${error.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          ));
        } else {
          resolve();
        }
      });
    });
  }

  async deleteFiles(publicIds: string[]): Promise<void> {
    const deletePromises = publicIds.map(publicId => this.deleteFile(publicId));
    await Promise.all(deletePromises);
  }

  extractPublicIdFromUrl(url: string): string {
    // Extract public_id from Cloudinary URL
    // Example: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/public_id.jpg
    const matches = url.match(/\/upload\/v\d+\/(.+?)\.[a-z]+$/);
    return matches ? matches[1] : '';
  }
}
