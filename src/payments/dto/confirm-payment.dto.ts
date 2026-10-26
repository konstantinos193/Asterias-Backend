import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { GUEST_LANGUAGES, GuestLanguage } from '../../common/enums';

/**
 * Guest details as they arrive from the booking wizard.
 *
 * Every string here is length-bounded. They are written to the Booking document
 * and several of them are interpolated into confirmation emails and into the
 * Puppeteer-rendered PDF, so an unbounded field is both a storage and a
 * render-time cost paid on a public, unauthenticated route.
 */
export class GuestInfoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  // Was a bare @IsString(): "not an email" was accepted and stored, and the
  // confirmation email then failed to send to it with no indication why.
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  specialRequests: string;

  @ApiProperty({ required: false, enum: GUEST_LANGUAGES })
  @IsOptional()
  @IsIn(GUEST_LANGUAGES)
  language?: GuestLanguage;
}

export class ConfirmPaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  paymentIntentId: string;

  @ApiProperty({ type: GuestInfoDto })
  @IsObject()
  @ValidateNested()
  @Type(() => GuestInfoDto)
  guestInfo: GuestInfoDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  specialRequests?: string;
}
