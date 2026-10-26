import {
  IsArray,
  IsBoolean,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsAfterStayDate, IsStayDate } from '../../common/validators/stay-dates.validator';

/**
 * Offer DTOs.
 *
 * These were TypeScript `interface` declarations exported from offers.service,
 * used as the `@Body()` type on four routes. An interface does not survive
 * compilation, so ValidationPipe had no metatype to work with: `whitelist`
 * stripped nothing and `forbidNonWhitelisted` rejected nothing, and the raw
 * body reached the service — including `discount`, which goes straight into
 * the price a guest is charged.
 */
export class CreateOfferDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  /** Percent off the room subtotal. Bounded: this multiplies a real price. */
  @ApiProperty({ minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  discount: number;

  @ApiProperty({ example: '2026-06-01' })
  @IsStayDate()
  startDate: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsStayDate()
  @IsAfterStayDate('startDate')
  endDate: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  applicableRooms?: string[];

  @ApiProperty({ required: false, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  minStay?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  maxStay?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  conditions?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;
}

export class UpdateOfferDto extends PartialType(CreateOfferDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ApplicableOffersDto {
  @ApiProperty({ example: '2026-07-04' })
  @IsStayDate()
  checkIn: string;

  @ApiProperty({ example: '2026-07-07' })
  @IsStayDate()
  @IsAfterStayDate('checkIn')
  checkOut: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  roomId?: string;
}

export class ValidateCodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: '2026-07-04' })
  @IsStayDate()
  checkIn: string;

  @ApiProperty({ example: '2026-07-07' })
  @IsStayDate()
  @IsAfterStayDate('checkIn')
  checkOut: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  roomId?: string;
}
