import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  BookingSource,
  BookingStatus,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PaymentMethod,
  PaymentStatus,
} from '../calendar.constants';
import { DAY_KEY_MESSAGE, DAY_KEY_PATTERN } from './grid-query.dto';

export class CreateReservationDto {
  @IsString()
  roomId: string;

  @Matches(DAY_KEY_PATTERN, { message: DAY_KEY_MESSAGE })
  checkIn: string;

  @Matches(DAY_KEY_PATTERN, { message: DAY_KEY_MESSAGE })
  checkOut: string;

  @IsString()
  @MaxLength(80)
  firstName: string;

  @IsString()
  @MaxLength(80)
  lastName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsInt()
  @Min(1)
  adults: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  /** Left out, the stay is priced from the seasonal calendar plus taxes. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsEnum(PAYMENT_METHODS)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsEnum(PAYMENT_STATUSES)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(BOOKING_STATUSES)
  bookingStatus?: BookingStatus;

  @IsOptional()
  @IsEnum(BOOKING_SOURCES)
  source?: BookingSource;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNotes?: string;

  /** Write the stay over a closure or a full night anyway. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class ReassignReservationDto {
  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @Matches(DAY_KEY_PATTERN, { message: DAY_KEY_MESSAGE })
  checkIn?: string;

  @IsOptional()
  @Matches(DAY_KEY_PATTERN, { message: DAY_KEY_MESSAGE })
  checkOut?: string;

  /** Re-quote the stay for its new nights instead of keeping the old total. */
  @IsOptional()
  @IsBoolean()
  reprice?: boolean;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class UpdateGuestDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  adults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNotes?: string;
}

export class UpdateBillingDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsEnum(PAYMENT_STATUSES)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(PAYMENT_METHODS)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @IsOptional()
  @IsBoolean()
  depositPaid?: boolean;
}

export class SetStatusDto {
  @IsEnum(BOOKING_STATUSES)
  status: BookingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellationReason?: string;
}
