import { Controller, Post, Body, HttpException, HttpStatus, Get, Param, Res, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { Response } from 'express';
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
