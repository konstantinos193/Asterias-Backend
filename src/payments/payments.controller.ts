import { Controller, Post, Body, HttpException, HttpStatus, Get, Param, Res, Req, Headers, HttpCode, UseGuards, RawBodyRequest } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateCheckoutSessionDto, ConfirmCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CreateCashBookingDto, RequestCashBookingDto } from './dto/create-cash-booking.dto';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RequireAdmin } from '../auth/decorators/require-admin.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 }, strict: { limit: 50, ttl: 900000 } })
  @Post('create-payment-intent')
  async createPaymentIntent(@Body() createPaymentIntentDto: CreatePaymentIntentDto, @Res() res: Response) {
    try {
      const result = await this.paymentsService.createPaymentIntent(createPaymentIntentDto);
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message || 'Failed to create payment intent' });
    }
  }

  /** Stripe-hosted payment page for a stay. Returns the URL to send the guest to. */
  @Throttle({ default: { limit: 10, ttl: 60000 }, strict: { limit: 50, ttl: 900000 } })
  @Post('create-checkout-session')
  async createCheckoutSession(@Body() dto: CreateCheckoutSessionDto, @Headers('origin') origin?: string) {
    try {
      return await this.paymentsService.createCheckoutSession(dto, origin);
    } catch (error: any) {
      throw new HttpException(
        { error: error.message || 'Failed to start payment' },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('confirm-checkout-session')
  async confirmCheckoutSession(@Body() dto: ConfirmCheckoutSessionDto) {
    try {
      return await this.paymentsService.confirmCheckoutSession(dto.sessionId);
    } catch (error: any) {
      throw new HttpException(
        { error: error.message || 'Failed to confirm payment' },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Books paid stays whose guest never made it back from the Stripe page. */
  @Post('stripe-webhook')
  @HttpCode(200)
  async stripeWebhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    return this.paymentsService.handleStripeWebhook(req.rawBody, signature);
  }

  @Post('confirm-payment')
  async confirmPayment(@Body() confirmPaymentDto: ConfirmPaymentDto) {
    try {
      return await this.paymentsService.confirmPayment(confirmPaymentDto);
    } catch (error: any) {
      throw new HttpException(
        { error: error.message || 'Failed to confirm payment' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * The owner's manual booking: a negotiated total and deposit are honoured,
   * and the room is held immediately.
   */
  @Post('create-cash-booking')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @RequireAdmin()
  async createCashBooking(@Body() createCashBookingDto: CreateCashBookingDto) {
    try {
      return await this.paymentsService.createCashBooking(createCashBookingDto, { isAdmin: true });
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { error: error.message || 'Failed to create cash booking' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
  @Post('request-cash-booking')
  @Throttle({ default: { limit: 3, ttl: 60000 }, strict: { limit: 3, ttl: 900000 } })
  async requestCashBooking(@Body() requestCashBookingDto: RequestCashBookingDto) {
    try {
      return await this.paymentsService.createCashBooking(
        requestCashBookingDto as CreateCashBookingDto,
        { isAdmin: false },
      );
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { error: error.message || 'Failed to request cash booking' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('status/:paymentIntentId')
  async getPaymentStatus(@Param('paymentIntentId') paymentIntentId: string) {
    try {
      return await this.paymentsService.getPaymentStatus(paymentIntentId);
    } catch (error: any) {
      throw new HttpException(
        { error: error.message || 'Failed to get payment status' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
