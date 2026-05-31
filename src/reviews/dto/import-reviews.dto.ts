import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsBoolean, Min, Max, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

export class ImportReviewDataDto {
  @ApiProperty()
  @IsString()
  reviewerName: string;

  @ApiProperty()
  @IsString()
  reviewText: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sourceId?: string;

  @ApiProperty({ enum: ['LOCAL_GUIDE', 'USER', 'OWNER', 'VERIFIED'], required: false })
  @IsOptional()
  @IsEnum(['LOCAL_GUIDE', 'USER', 'OWNER', 'VERIFIED'])
  reviewerType?: 'LOCAL_GUIDE' | 'USER' | 'OWNER' | 'VERIFIED';

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : null)
  reviewDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reviewerProfileUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  helpfulCount?: number;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  photoUrls?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  language?: string;
}

export class ImportReviewsDto {
  @ApiProperty({ type: [ImportReviewDataDto] })
  @IsArray()
  reviews: ImportReviewDataDto[];

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  overwriteExisting?: boolean;
}
