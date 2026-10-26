import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsObject,
  IsISO8601,
  IsMongoId,
  ValidateNested,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OmitType } from '@nestjs/swagger';
import { GuestInfoDto } from './confirm-payment.dto';

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

  @IsISO8601()
  @IsNotEmpty()
  checkIn: string;

  @IsISO8601()
  @IsNotEmpty()
  checkOut: string;

  @IsNumber()
  @Min(1)
  @Max(50)
  adults: number;

  @IsNumber()
  @Min(0)
  @Max(50)
  @IsOptional()
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
