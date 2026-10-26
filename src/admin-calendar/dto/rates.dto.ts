import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { DAY_KEY_MESSAGE, DAY_KEY_PATTERN } from './grid-query.dto';

/** A price per guest tier. null clears that tier and the night falls back. */
export class TierPricesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  '2beds'?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  '3beds'?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  '4beds'?: number | null;
}

export class UpdateRatesDto {
  @Matches(DAY_KEY_PATTERN, { message: DAY_KEY_MESSAGE })
  from: string;

  /** Inclusive: the last night the price applies to. One night sends from === to. */
  @Matches(DAY_KEY_PATTERN, { message: DAY_KEY_MESSAGE })
  to: string;

  @ValidateNested()
  @Type(() => TierPricesDto)
  prices: TierPricesDto;
}
