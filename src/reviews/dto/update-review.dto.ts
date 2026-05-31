import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateReviewDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reviewerName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reviewText?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reviewerProfileUrl?: string;

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
  responseText?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : null)
  responseDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  helpfulCount?: number;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  photoUrls?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(['positive', 'neutral', 'negative'])
  sentiment?: 'positive' | 'neutral' | 'negative';
}
