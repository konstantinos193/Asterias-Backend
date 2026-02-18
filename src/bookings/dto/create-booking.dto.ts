import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsDate, IsOptional, IsEnum, IsObject, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bookingNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty()
  @IsObject()
  @IsNotEmpty()
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    specialRequests?: string;
    language?: 'el' | 'en' | 'de';
  };

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  checkIn: Date;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  checkOut: Date;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  adults: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @IsOptional()
  children?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  totalAmount: number;

  @ApiProperty()
  @IsEnum(['CARD', 'CASH'])
  @IsNotEmpty()
  paymentMethod: 'CARD' | 'CASH';

  @ApiProperty()
  @IsEnum(['PENDING', 'PAID', 'FAILED', 'REFUNDED'])
  @IsOptional()
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

  @ApiProperty()
  @IsEnum(['CONFIRMED', 'PENDING', 'CANCELLED', 'CHECKED_IN', 'CHECKED_OUT'])
  @IsOptional()
  bookingStatus?: 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT';

  @ApiProperty()
  @IsString()
  @IsOptional()
  stripePaymentIntentId?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  bookingcom_booking_id?: string;

  @ApiProperty()
  @IsEnum(['asterias', 'bookingcom'])
  @IsOptional()
  source?: 'asterias' | 'bookingcom';
}
