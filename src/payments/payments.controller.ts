import { Controller, Post, Body, HttpException, HttpStatus, Get, Param, Res } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { Response } from 'express';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-payment-intent')
  async createPaymentIntent(@Body() createPaymentIntentDto: CreatePaymentIntentDto, @Res() res: Response) {
    console.log('🔍 Payment intent request received:', {
      roomId: createPaymentIntentDto.roomId,
      checkIn: createPaymentIntentDto.checkIn,
      checkOut: createPaymentIntentDto.checkOut,
      adults: createPaymentIntentDto.adults,
      children: createPaymentIntentDto.children,
      currency: createPaymentIntentDto.currency
    });
    
    try {
      const result = await this.paymentsService.createPaymentIntent(createPaymentIntentDto);
      console.log('✅ Payment intent created successfully, sending response:', {
        hasClientSecret: !!result.clientSecret,
        hasPaymentIntentId: !!result.paymentIntentId,
        amount: result.amount,
        currency: result.currency
      });
      return res.status(201).json(result);
    } catch (error) {
      console.error('💥 Payment intent error:', error);
      return res.status(500).json({ error: error.message || 'Failed to create payment intent' });
    }
  }

  @Post('confirm-payment')
  async confirmPayment(@Body() confirmPaymentDto: ConfirmPaymentDto) {
    try {
      return await this.paymentsService.confirmPayment(confirmPaymentDto);
    } catch (error) {
      throw new HttpException(
        { error: error.message || 'Failed to confirm payment' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('create-cash-booking')
  async createCashBooking(@Body() createCashBookingDto: any) {
    try {
      return await this.paymentsService.createCashBooking(createCashBookingDto);
    } catch (error) {
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
    } catch (error) {
      throw new HttpException(
        { error: error.message || 'Failed to get payment status' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
