import {
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { GuestInfoDto } from './confirm-payment.dto';
import { IsAfterStayDate, IsStayDate } from '../../common/validators/stay-dates.validator';
import { MAX_ADULTS_PER_BOOKING, MAX_CHILDREN_PER_BOOKING } from '../../common/limits';
import { GUEST_LANGUAGES, GuestLanguage } from '../../common/enums';

export class CreateCheckoutSessionDto {
  @ApiProperty()
  @IsMongoId()
  roomId: string;

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

  /** Language of the Stripe page and of the page the guest returns to. */
  @ApiProperty({ required: false, enum: GUEST_LANGUAGES })
  @IsOptional()
  @IsIn(GUEST_LANGUAGES)
  language?: GuestLanguage;

  /** Offer the guest booked from. Ignored when it does not fit the stay. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  offerId?: string;
}

export class ConfirmCheckoutSessionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sessionId: string;
}
