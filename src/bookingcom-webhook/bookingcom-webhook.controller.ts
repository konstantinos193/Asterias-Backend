import { Public, Authenticated } from '../auth/decorators/access.decorator';
import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
  RawBodyRequest,
  UnauthorizedException,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { BookingComWebhookService } from './bookingcom-webhook.service';
import { BookingComNotificationDto } from './dto/notification.dto';

@ApiTags('bookingcom-webhook')
@Controller('bookingcom-webhooks')
export class BookingComWebhookController {
  private readonly logger = new Logger(BookingComWebhookController.name);

  constructor(private readonly webhookService: BookingComWebhookService) {}

  @Public()
  @Post('notification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive webhook notifications from Booking.com' })
  @ApiHeader({ name: 'x-bookingcom-signature', description: 'Webhook signature for verification', required: true })
  @ApiResponse({ status: 200, description: 'Webhook received and processed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async handleNotification(
    @Req() req: RawBodyRequest<Request>,
    @Body() notification: BookingComNotificationDto,
    @Headers('x-bookingcom-signature') signature?: string,
  ) {
    // The signature is verified against req.rawBody — the exact bytes that were
    // signed — not against the parsed body. See verifyWebhookSignature.
    if (!this.webhookService.verifyWebhookSignature(signature, req.rawBody)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    try {
      await this.webhookService.processNotification(notification);
      this.logger.log(`Booking.com webhook processed successfully: ${notification.event}`);
      return 'Webhook received successfully';
    } catch (error) {
      // 200 on a processing failure is deliberate: the stay exists at the
      // channel either way, and a retry storm from Booking.com would not fix
      // whatever went wrong here. The error is logged for us to act on.
      this.logger.error(
        `Error processing Booking.com webhook ${notification?.event}: ` +
          `${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      return 'Webhook received but processing failed';
    }
  }
}
