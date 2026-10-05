import { Controller, Post, Body, HttpException, HttpStatus, Get, Param, Res, Req, Headers, HttpCode, UseGuards, RawBodyRequest } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateCheckoutSessionDto, ConfirmCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RequireAdmin } from '../auth/decorators/require-admin.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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

  @Post('create-cash-booking')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @RequireAdmin()
  async createCashBooking(@Body() createCashBookingDto: any) {
    try {
      return await this.paymentsService.createCashBooking(createCashBookingDto);
    } catch (error: any) {
      throw new HttpException(
        { error: error.message || 'Failed to create cash booking' },
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
