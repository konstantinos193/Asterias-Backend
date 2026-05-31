import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { join, extname } from 'path';
import { existsSync, unlinkSync, statSync, readdirSync } from 'fs';
import { Express } from 'express';

export interface UploadedFile {
  filename: string;
  originalName: string;
  size: number;
  url: string;
}

export interface ImageFileInfo {
  filename: string;
  url: string;
  size: number;
  created: Date;
}

@Injectable()
export class ImagesService {
  private readonly uploadsDir: string;

  constructor() {
    this.uploadsDir = join(process.cwd(), 'uploads');
  }

  async processUploadedFiles(files: Express.Multer.File[]): Promise<UploadedFile[]> {
    return files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      url: `/api/images/${file.filename}`,
    }));
  }

  async getFile(filename: string) {
    const filePath = join(this.uploadsDir, filename);

    if (!existsSync(filePath)) {
      throw new HttpException('Image not found', HttpStatus.NOT_FOUND);
    }

    const ext = extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    
    return {
      filePath,
      mimeType,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000', // 1 year cache
      },
    };
  }

  async deleteFile(filename: string): Promise<void> {
    const filePath = join(this.uploadsDir, filename);

    if (!existsSync(filePath)) {
      throw new HttpException('Image not found', HttpStatus.NOT_FOUND);
    }

    unlinkSync(filePath);
  }

  async listFiles(): Promise<ImageFileInfo[]> {
    if (!existsSync(this.uploadsDir)) {
      return [];
    }

    const files = readdirSync(this.uploadsDir);
    const imageFiles = files
      .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
      .map(file => {
        const filePath = join(this.uploadsDir, file);
        const stats = statSync(filePath);
        return {
          filename: file,
          url: `/api/images/${file}`,
          size: stats.size,
          created: stats.birthtime,
        };
      });

    return imageFiles;
  }
}
