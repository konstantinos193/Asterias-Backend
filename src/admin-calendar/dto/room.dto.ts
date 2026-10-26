import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const ROOM_STATUSES = ['available', 'closed', 'maintenance'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const ROOM_TYPES = ['2beds', '3beds', '4beds'] as const;
export const ROOM_FLOORS = ['ground', 'upper'] as const;

export class OccupancyPriceDto {
  @IsInt()
  @Min(1)
  guests: number;

  @IsNumber()
  @Min(0)
  price: number;
}

/**
 * What the owner changes about a room while looking at the calendar: whether it
 * sells, how many units, what it costs. Text, photos and amenities stay on the
 * room page — the calendar never holds them, so it cannot overwrite them.
 */
export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  /** Drives `available` too, so "Συντήρηση" actually takes the room off sale. */
  @IsOptional()
  @IsEnum(ROOM_STATUSES)
  roomStatus?: RoomStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalRooms?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsEnum(ROOM_TYPES)
  roomType?: (typeof ROOM_TYPES)[number];

  @IsOptional()
  @IsEnum(ROOM_FLOORS)
  floor?: (typeof ROOM_FLOORS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  /** The room's premium, added on top of whichever seasonal rate wins. */
  @IsOptional()
  @IsNumber()
  priceAdjustment?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => OccupancyPriceDto)
  pricingByOccupancy?: OccupancyPriceDto[];
}
