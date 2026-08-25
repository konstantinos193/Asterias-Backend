import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsArray, IsObject, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class OccupancyPriceDto {
  @IsNumber()
  @Min(1)
  guests: number;

  @IsNumber()
  @Min(0)
  price: number;
}

class RoomTranslationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

/**
 * Per-locale copy. Omitted locales fall back to the English `name`/
 * `description`, which is what every locale used to render verbatim — the
 * duplicate-content problem this exists to fix. See Room.translations.
 */
class RoomTranslationsDto {
  @ValidateNested()
  @Type(() => RoomTranslationDto)
  @IsOptional()
  el?: RoomTranslationDto;

  @ValidateNested()
  @Type(() => RoomTranslationDto)
  @IsOptional()
  en?: RoomTranslationDto;

  @ValidateNested()
  @Type(() => RoomTranslationDto)
  @IsOptional()
  de?: RoomTranslationDto;
}

export class CreateRoomDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false, type: RoomTranslationsDto })
  @ValidateNested()
  @Type(() => RoomTranslationsDto)
  @IsOptional()
  translations?: RoomTranslationsDto;

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
  @IsEnum(['2beds', '3beds', '4beds'])
  @IsOptional()
  roomType?: '2beds' | '3beds' | '4beds';

  @ApiProperty()
  @IsEnum(['ground', 'upper'])
  @IsOptional()
  floor?: 'ground' | 'upper';

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  available?: boolean;

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
  @IsOptional()
  priceAdjustment?: number;

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
