import { 
  Controller, 
  Post, 
  Body, 
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { BookingComWebhookService } from './bookingcom-webhook.service';

@ApiTags('bookingcom-webhook')
@Controller('bookingcom-webhooks')
export class BookingComWebhookController {
  private readonly logger = new Logger(BookingComWebhookController.name);

  constructor(private readonly webhookService: BookingComWebhookService) {}

  @Post('notification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive webhook notifications from Booking.com' })
  @ApiHeader({ name: 'x-bookingcom-signature', description: 'Webhook signature for verification', required: true })
  @ApiResponse({ status: 200, description: 'Webhook received and processed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async handleNotification(
    @Body() notification: any,
    @Headers('x-bookingcom-signature') signature: string
  ) {
    try {
      // Verify the webhook signature
      if (!this.webhookService.verifyWebhookSignature(signature, notification)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }

      // Process the notification
      const result = await this.webhookService.processNotification(notification);

      this.logger.log(`Booking.com webhook processed successfully: ${notification.event}`);

      // Always respond with a 200 OK to Booking.com to acknowledge receipt
      return 'Webhook received successfully';

    } catch (error) {
      this.logger.error('Error processing Booking.com webhook:', error);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Still return 200 OK to avoid retries from Booking.com for processing errors
      return 'Webhook received but processing failed';
    }
  }
}
