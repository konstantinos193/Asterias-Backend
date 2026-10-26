import { Public, Authenticated } from '../auth/decorators/access.decorator';
import {
  Controller,
  Get,
  Param,
  Res,
  Request,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { MongoObjectIdPipe } from '../common/pipes/mongodb-object-id.pipe';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { USER_ROLE } from '../common/enums';

@ApiTags('pdf')
@ApiBearerAuth()
@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  /**
   * Owner or admin. The confirmation carries the guest's name, contact details
   * and what they paid, and the route used to render it for any signed-in
   * caller who knew — or guessed — a booking id.
   */
  @Authenticated()
  @Get('booking-confirmation/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Booking confirmation PDF (owner or admin)' })
  // Renders now share one Chromium with a concurrency limit of 2
  // (BrowserPoolService), rather than each starting their own, so this limit
  // is no longer the only thing standing between a few concurrent requests and
  // the container's memory. It is kept because rendering is still the most
  // expensive thing this API does per request.
  @Throttle({ default: { limit: 3, ttl: 60000 }, strict: { limit: 15, ttl: 900000 } })
  async generateBookingConfirmation(
    @Param('bookingId', MongoObjectIdPipe) bookingId: string,
    @Request() req,
    @Res() res: Response,
  ) {
    if (req.user.role !== USER_ROLE.ADMIN) {
      const ownerId = await this.pdfService.getBookingOwnerId(bookingId);
      if (!ownerId || ownerId !== String(req.user._id)) {
        throw new NotFoundException('Booking not found');
      }
    }

    // @Res() is deliberate: the response body is PDF bytes, so it must escape
    // the TransformInterceptor's JSON envelope.
    //
    // The try/catch that used to wrap this is gone. It caught everything
    // non-HttpException and rethrew a generic 500 with the reason only in
    // console.error, which hid a NotFoundException raised inside the service
    // and, more importantly, hid the one failure worth seeing: Chromium
    // failing to launch. The global filter logs the stack with a level and
    // still returns the same sanitised "Internal server error" to the caller,
    // so nothing about the response leaks more than before.
    const pdfBuffer = await this.pdfService.generateBookingConfirmationPdf(bookingId);

    res.setHeader('Content-Type', 'application/pdf');
    // The id is a validated ObjectId, so it cannot break out of the header.
    res.setHeader('Content-Disposition', `attachment; filename="booking-confirmation-${bookingId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  }
}
