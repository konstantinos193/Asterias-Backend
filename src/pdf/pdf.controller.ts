import {
  Controller,
  Get,
  Param,
  Res,
  Request,
  HttpException,
  HttpStatus,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { MongoObjectIdPipe } from '../common/pipes/mongodb-object-id.pipe';

@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  /**
   * Owner or admin. The confirmation carries the guest's name, contact details
   * and what they paid, and the route used to render it for any signed-in
   * caller who knew — or guessed — a booking id.
   */
  @Get('booking-confirmation/:bookingId')
  @UseGuards(JwtAuthGuard)
  // Every call starts a headless Chromium. A handful of concurrent requests is
  // enough to exhaust memory on a small host, so this is kept deliberately low.
  @Throttle({ default: { limit: 3, ttl: 60000 }, strict: { limit: 15, ttl: 900000 } })
  async generateBookingConfirmation(
    @Param('bookingId', MongoObjectIdPipe) bookingId: string,
    @Request() req,
    @Res() res: Response,
  ) {
    try {
      if (req.user.role !== 'ADMIN') {
        const ownerId = await this.pdfService.getBookingOwnerId(bookingId);
        if (!ownerId || ownerId !== String(req.user._id)) {
          throw new NotFoundException('Booking not found');
        }
      }

      const pdfBuffer = await this.pdfService.generateBookingConfirmationPdf(bookingId);

      res.setHeader('Content-Type', 'application/pdf');
      // The id is a validated ObjectId, so it cannot break out of the header.
      res.setHeader('Content-Disposition', `attachment; filename="booking-confirmation-${bookingId}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('PDF generation error:', error);
      // The underlying message can name internal paths or Puppeteer state.
      throw new HttpException(
        { error: 'Failed to generate PDF' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
