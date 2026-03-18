import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsArray, IsObject, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class OccupancyPriceDto {
  @IsNumber()
  @Min(1)
  guests: number;

  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateRoomDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  nameKey: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsString()
  descriptionKey: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  capacity: number;

  @ApiProperty()
  @IsString()
  @IsOptional()
  size?: string;

  @ApiProperty()
  @IsString()
  bedType: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  view?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  bathroom?: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  features: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  featureKeys: string[];

  @ApiProperty()
  @IsOptional()
  amenities?: {
    wifi: boolean;
    ac: boolean;
    tv: boolean;
    minibar: boolean;
    balcony: boolean;
    seaView: boolean;
    roomService: boolean;
    safe: boolean;
  };

  @ApiProperty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OccupancyPriceDto)
  @IsOptional()
  pricingByOccupancy?: OccupancyPriceDto[];

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @IsOptional()
  totalRooms?: number;

  @ApiProperty()
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  rating?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @IsOptional()
  reviewCount?: number;

  @ApiProperty()
  @IsString()
  @IsOptional()
  bookingcom_room_id?: string;

  @ApiProperty()
  @IsEnum(['asterias', 'bookingcom'])
  @IsOptional()
  source?: 'asterias' | 'bookingcom';
}
