import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DAY_KEY_MESSAGE, DAY_KEY_PATTERN } from './grid-query.dto';

export class CreateClosureDto {
  @IsString()
  roomId: string;

  @Matches(DAY_KEY_PATTERN, { message: DAY_KEY_MESSAGE })
  startDate: string;

  /** Exclusive: the first morning the room is open again. */
  @Matches(DAY_KEY_PATTERN, { message: DAY_KEY_MESSAGE })
  endDate: string;

  @IsString()
  @MaxLength(200)
  reason: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** Close nights a guest already holds. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class UpdateClosureDto {
  @IsOptional()
  @Matches(DAY_KEY_PATTERN, { message: DAY_KEY_MESSAGE })
  startDate?: string;

  @IsOptional()
  @Matches(DAY_KEY_PATTERN, { message: DAY_KEY_MESSAGE })
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
