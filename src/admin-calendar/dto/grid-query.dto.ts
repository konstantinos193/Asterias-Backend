import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { DEFAULT_GRID_NIGHTS, MAX_GRID_NIGHTS } from '../calendar.constants';

export const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DAY_KEY_MESSAGE = 'Η ημερομηνία πρέπει να είναι σε μορφή YYYY-MM-DD';

export class GridQueryDto {
  @IsOptional()
  @Matches(DAY_KEY_PATTERN, { message: DAY_KEY_MESSAGE })
  from?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_GRID_NIGHTS)
  days?: number = DEFAULT_GRID_NIGHTS;
}
