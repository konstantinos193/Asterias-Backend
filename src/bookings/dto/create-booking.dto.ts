import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsInt,
  IsDate,
  IsOptional,
  IsIn,
  IsMongoId,
  IsObject,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GuestInfoDto } from '../../payments/dto/confirm-payment.dto';
import { IsAfterStayDate, IsStayDate } from '../../common/validators/stay-dates.validator';
import { MAX_ADULTS_PER_BOOKING, MAX_CHILDREN_PER_BOOKING } from '../../common/limits';
import {
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  BookingSource,
  BookingStatus,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PaymentMethod,
  PaymentStatus,
} from '../../common/enums';

export class CreateBookingDto {
  /**
   * Optional, and normally omitted: BookingsService issues the number from the
   * shared counter. It is accepted only so an admin importing a historical
   * booking can preserve its original reference.
   */
  @ApiProperty({ required: false, description: 'Server-generated unless given' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  bookingNumber?: string;

  @ApiProperty()
  @IsMongoId()
  roomId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  // Was a bare @IsObject(), so nothing inside it was checked: a booking could
  // be stored with no guest name and an unparseable email address.
  @ApiProperty({ type: GuestInfoDto })
  @IsObject()
  @ValidateNested()
  @Type(() => GuestInfoDto)
  guestInfo: GuestInfoDto;

  @ApiProperty({ example: '2026-07-04', description: 'First night, YYYY-MM-DD' })
  @IsStayDate()
  checkIn: string;

  @ApiProperty({ example: '2026-07-07', description: 'Departure day, YYYY-MM-DD' })
  @IsStayDate()
  @IsAfterStayDate('checkIn')
  checkOut: string;

  @ApiProperty({ minimum: 1, maximum: MAX_ADULTS_PER_BOOKING })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ADULTS_PER_BOOKING)
  adults: number;

  @ApiProperty({ required: false, minimum: 0, maximum: MAX_CHILDREN_PER_BOOKING })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_CHILDREN_PER_BOOKING)
  children?: number;

  /**
   * An override for a negotiated price. Omitted — which is the normal case —
   * the stay is priced by PricingService, exactly as it is at checkout. This
   * used to be required, and was the only figure available: the route stored
   * whatever arrived here without ever pricing the stay.
   */
  @ApiProperty({ required: false, description: 'Admin override; priced by the server if omitted' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  totalAmount?: number;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  paymentMethod: PaymentMethod;

  @ApiProperty({ required: false, enum: PAYMENT_STATUSES })
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  paymentStatus?: PaymentStatus;

  @ApiProperty({ required: false, enum: BOOKING_STATUSES })
  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  bookingStatus?: BookingStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  stripePaymentIntentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bookingcom_booking_id?: string;

  @ApiProperty({ required: false, enum: BOOKING_SOURCES })
  @IsOptional()
  @IsIn(BOOKING_SOURCES)
  source?: BookingSource;

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