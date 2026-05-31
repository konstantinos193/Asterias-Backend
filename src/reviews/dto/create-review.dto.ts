import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateReviewDto {
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

  @ApiProperty({ enum: ['google', 'bookingcom', 'tripadvisor', 'internal'] })
  @IsEnum(['google', 'bookingcom', 'tripadvisor', 'internal'])
  source: 'google' | 'bookingcom' | 'tripadvisor' | 'internal';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sourceId?: string;

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

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiProperty({ required: false, default: false })
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
}
