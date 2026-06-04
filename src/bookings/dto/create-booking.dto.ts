import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsDate, IsOptional, IsEnum, IsObject, IsBoolean, Min, IsNotEmpty, MaxLength, Validate, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { Type } from 'class-transformer';

@ValidatorConstraint({ name: 'isAfterCheckIn', async: false })
class IsAfterCheckIn implements ValidatorConstraintInterface {
  validate(checkOut: Date, args: ValidationArguments) {
    const checkIn = (args.object as any).checkIn;
    if (!checkIn || !checkOut) return true;
    return new Date(checkOut) > new Date(checkIn);
  }
  defaultMessage() {
    return 'checkOut must be after checkIn';
  }
}

export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
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
  @Validate(IsAfterCheckIn)
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
  @MaxLength(1000)
  notes?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  bookingcom_booking_id?: string;

  @ApiProperty()
  @IsEnum(['asterias', 'bookingcom'])
  @IsOptional()
  source?: 'asterias' | 'bookingcom';

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  depositAmount?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  depositPaid?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  depositPaidAt?: Date;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  postCheckoutEmailSent?: boolean;
}
