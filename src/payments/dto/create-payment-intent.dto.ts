import { IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsAfterStayDate, IsStayDate } from '../../common/validators/stay-dates.validator';
import { MAX_ADULTS_PER_BOOKING, MAX_CHILDREN_PER_BOOKING } from '../../common/limits';

export class CreatePaymentIntentDto {
  @ApiProperty({ description: 'Room to price the stay against' })
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

  @ApiProperty({ required: false, description: 'Offer to apply to the stay' })
  @IsOptional()
  @IsMongoId()
  offerId?: string;

  // `currency` is deliberately absent.
  //
  // This route is public — no guard — and the amount is computed by
  // PricingService in euro cents. The field used to be an unvalidated
  // `@IsString() @IsOptional()` passed straight to Stripe as the charge
  // currency, so a caller could ask to be charged the euro figure in a
  // cheaper unit. The property charges in euro only; PaymentsService now
  // uses the CURRENCY constant and ignores anything the caller sends.
  //
  // ValidationPipe runs with forbidNonWhitelisted, so a request that still
  // sends `currency` is rejected with a 400 rather than silently ignored.
}
