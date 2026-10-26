import { Public, Authenticated } from '../auth/decorators/access.decorator';
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Req,
  Headers,
  HttpCode,
  UseGuards,
  RawBodyRequest,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateCheckoutSessionDto, ConfirmCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CreateCashBookingDto, RequestCashBookingDto } from './dto/create-cash-booking.dto';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

/**
 * Every handler here used to wrap its service call in try/catch and rethrow.
 * Six of the seven flattened the error: a NotFoundException('Room not found')
 * from the service came back as a 500 with `{ error: 'Room not found' }`, and a
 * ConflictException from the duplicate-booking path came back as a 500 too, so
 * the booking wizard could not distinguish "that room just went" from "the
 * server is broken" and showed the generic failure for both.
 *
 * common/filters/http-exception.filter.ts does this correctly for every route,
 * including translating Stripe's own refusals, so the handlers let exceptions
 * through.
 */
@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 }, strict: { limit: 50, ttl: 900000 } })
  @Post('create-payment-intent')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a Stripe PaymentIntent for a stay' })
  createPaymentIntent(@Body() createPaymentIntentDto: CreatePaymentIntentDto) {
    // No @Res() here any more.
    //
    // This handler used @Res() to send a plain JSON body, which opts the route
    // out of Nest's response pipeline entirely — so it was the one payments
    // route whose success response was NOT wrapped by TransformInterceptor,
    // while every other one was. The frontend therefore had to read this
    // response at the root and its siblings under `.data`. It also meant
    // thrown exceptions could not reach the global filter.
    return this.paymentsService.createPaymentIntent(createPaymentIntentDto);
  }

  /** Stripe-hosted payment page for a stay. Returns the URL to send the guest to. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 }, strict: { limit: 50, ttl: 900000 } })
  @Post('create-checkout-session')
  @ApiOperation({ summary: 'Start a Stripe-hosted checkout for a stay' })
  createCheckoutSession(
    @Body() dto: CreateCheckoutSessionDto,
    @Headers('origin') origin?: string,
  ) {
    return this.paymentsService.createCheckoutSession(dto, origin);
  }

  @Public()
  @Post('confirm-checkout-session')
  @ApiOperation({ summary: 'Turn a completed Stripe session into a booking' })
  confirmCheckoutSession(@Body() dto: ConfirmCheckoutSessionDto) {
    return this.paymentsService.confirmCheckoutSession(dto.sessionId);
  }

  /** Books paid stays whose guest never made it back from the Stripe page. */
  @Public()
  @Post('stripe-webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stripe webhook (signature verified over the raw body)' })
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.paymentsService.handleStripeWebhook(req.rawBody, signature);
  }

  @Public()
  @Post('confirm-payment')
  @ApiOperation({ summary: 'Turn a succeeded PaymentIntent into a booking' })
  confirmPayment(@Body() confirmPaymentDto: ConfirmPaymentDto) {
    return this.paymentsService.confirmPayment(confirmPaymentDto);
  }

  /**
   * The owner's manual booking: a negotiated total and deposit are honoured,
   * and the room is held immediately.
   */
  @Post('create-cash-booking')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a cash booking as the owner (admin)' })
  createCashBooking(@Body() createCashBookingDto: CreateCashBookingDto) {
    return this.paymentsService.createCashBooking(createCashBookingDto, { isAdmin: true });
  }

  /**
   * The guest's "pay on arrival" request, from the public booking wizard.
   *
   * Kept apart from the admin route rather than branching inside one handler,
   * so the authorization, the accepted fields and the rate limit are all
   * visible at the route. No money has changed hands at this point, so the
   * stay is recorded as PENDING and the property confirms it; the price is
   * computed server-side and the DTO refuses a caller-supplied total.
   */
  @Public()
  @Post('request-cash-booking')
  @Throttle({ default: { limit: 3, ttl: 60000 }, strict: { limit: 3, ttl: 900000 } })
  @ApiOperation({ summary: 'Request to pay on arrival (public)' })
  requestCashBooking(@Body() requestCashBookingDto: RequestCashBookingDto) {
    return this.paymentsService.createCashBooking(
      requestCashBookingDto as CreateCashBookingDto,
      { isAdmin: false },
    );
  }

  @Public()
  @Get('status/:paymentIntentId')
  @ApiOperation({ summary: 'Status of a PaymentIntent' })
  getPaymentStatus(@Param('paymentIntentId') paymentIntentId: string) {
    return this.paymentsService.getPaymentStatus(paymentIntentId);
  }
}
