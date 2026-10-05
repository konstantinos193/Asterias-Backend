import { IsString, IsNumber, IsOptional, IsNotEmpty, IsObject, IsIn, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { GuestInfoDto } from './confirm-payment.dto';

export class CreateCheckoutSessionDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  checkIn: string;

  @IsString()
  @IsNotEmpty()
  checkOut: string;

  @IsNumber()
  @Min(1)
  adults: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  children?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => GuestInfoDto)
  guestInfo: GuestInfoDto;

  @IsString()
  @IsOptional()
  specialRequests?: string;

  /** Language of the Stripe page and of the page the guest returns to. */
  @IsIn(['el', 'en', 'de'])
  @IsOptional()
  language?: 'el' | 'en' | 'de';

  /** Offer the guest booked from. Ignored when it does not fit the stay. */
  @IsString()
  @IsOptional()
  offerId?: string;
}

export class ConfirmCheckoutSessionDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
