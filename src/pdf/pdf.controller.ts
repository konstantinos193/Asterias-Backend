import { Controller, Get, Param, Res, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';

@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Get('booking-confirmation/:bookingId')
  async generateBookingConfirmation(
    @Param('bookingId') bookingId: string,
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.pdfService.generateBookingConfirmationPdf(bookingId);
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="booking-confirmation-${bookingId}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Send the PDF
      res.send(pdfBuffer);
    } catch (error) {
      console.error('PDF generation error:', error);
      throw new HttpException(
        { error: error.message || 'Failed to generate PDF' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
