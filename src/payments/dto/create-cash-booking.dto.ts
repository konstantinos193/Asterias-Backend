import {
  IsString,
  IsNumber,
  IsInt,
  IsOptional,
  IsBoolean,
  IsObject,
  IsMongoId,
  ValidateNested,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OmitType } from '@nestjs/swagger';
import { GuestInfoDto } from './confirm-payment.dto';
import { IsAfterStayDate, IsStayDate } from '../../common/validators/stay-dates.validator';
import { MAX_ADULTS_PER_BOOKING, MAX_CHILDREN_PER_BOOKING } from '../../common/limits';

/**
 * Fields taken straight from what PaymentsService.createCashBooking destructures.
 *
 * The handler used to type its body as `any`, which meant the global
 * ValidationPipe had no metatype to work with: `whitelist` stripped nothing and
 * `forbidNonWhitelisted` rejected nothing, so the whole body reached the
 * service unchecked — including extra keys that then flowed into `new
 * this.bookingModel({...})`.
 */
export class CreateCashBookingDto {
  @IsMongoId()
  roomId: string;

  @IsStayDate()
  checkIn: string;

  @IsStayDate()
  @IsAfterStayDate('checkIn')
  checkOut: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ADULTS_PER_BOOKING)
  adults: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_CHILDREN_PER_BOOKING)
  children?: number;

  /**
   * Honoured only for admins, who may enter a negotiated price. Omitted, the
   * service prices the stay itself.
   */
  @IsNumber()
  @Min(0)
  @Max(1000000)
  @IsOptional()
  totalAmount?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => GuestInfoDto)
  guestInfo: GuestInfoDto;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  specialRequests?: string;

  @IsNumber()
  @Min(0)
  @Max(1000000)
  @IsOptional()
  depositAmount?: number;

  @IsBoolean()
  @IsOptional()
  depositPaid?: boolean;
}

/**
 * The guest-facing subset. Price and deposit are the property's to decide, so
 * they are not merely ignored here — `forbidNonWhitelisted` rejects the request
 * outright if a guest sends them, which fails loudly instead of quietly
 * dropping a number the guest thinks they set.
 */
export class RequestCashBookingDto extends OmitType(CreateCashBookingDto, [
  'totalAmount',
  'depositAmount',
  'depositPaid',
] as const) {}
