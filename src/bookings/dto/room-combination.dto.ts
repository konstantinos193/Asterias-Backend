import { IsNumber, IsDate, IsOptional, IsArray, IsString, Min, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RoomCombinationRequestDto {
  @ApiProperty({ description: 'Number of adults', example: 4 })
  @IsNumber()
  @Min(1)
  adults: number;

  @ApiProperty({ description: 'Number of children', example: 0 })
  @IsNumber()
  @Min(0)
  children: number;

  @ApiProperty({ description: 'Check-in date', example: '2024-06-15' })
  @IsDate()
  @Type(() => Date)
  checkIn: Date;

  @ApiProperty({ description: 'Check-out date', example: '2024-06-18' })
  @IsDate()
  @Type(() => Date)
  checkOut: Date;

  @ApiProperty({ description: 'Maximum combinations to return', example: 5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxCombinations?: number;

  @ApiProperty({ description: 'Prefer multi-room combinations to avoid expensive single rooms', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  preferMultiRoom?: boolean = true;
}

export class RoomDetailsDto {
  @ApiProperty({ description: 'Room ID' })
  @IsString()
  roomId: string;

  @ApiProperty({ description: 'Room name' })
  @IsString()
  roomName: string;

  @ApiProperty({ description: 'Number of rooms of this type' })
  @IsNumber()
  @Min(1)
  count: number;

  @ApiProperty({ description: 'Occupancy per room' })
  @IsNumber()
  @Min(1)
  occupancy: number;

  @ApiProperty({ description: 'Price per room' })
  @IsNumber()
  @Min(0)
  pricePerRoom: number;

  @ApiProperty({ description: 'Total price for this room type' })
  @IsNumber()
  @Min(0)
  totalPrice: number;
}

export class RoomCombinationDto {
  @ApiProperty({ description: 'Array of rooms in this combination', type: [RoomDetailsDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomDetailsDto)
  rooms: RoomDetailsDto[];

  @ApiProperty({ description: 'Total capacity of the combination' })
  @IsNumber()
  @Min(1)
  totalCapacity: number;

  @ApiProperty({ description: 'Total price for the combination' })
  @IsNumber()
  @Min(0)
  totalPrice: number;

  @ApiProperty({ description: 'Number of unused beds' })
  @IsNumber()
  @Min(0)
  unusedBeds: number;

  @ApiProperty({ description: 'Internal score (lower is better)' })
  @IsNumber()
  score: number;

  @ApiProperty({ description: 'Type of combination', enum: ['cheapest', 'best_value', 'most_comfortable'] })
  @IsString()
  combinationType: 'cheapest' | 'best_value' | 'most_comfortable';
}

export class MultiRoomBookingDto {
  @ApiProperty({ description: 'Selected room combination', type: RoomCombinationDto })
  @ValidateNested()
  @Type(() => RoomCombinationDto)
  combination: RoomCombinationDto;

  @ApiProperty({ description: 'Check-in date', example: '2024-06-15' })
  @IsDate()
  @Type(() => Date)
  checkIn: Date;

  @ApiProperty({ description: 'Check-out date', example: '2024-06-18' })
  @IsDate()
  @Type(() => Date)
  checkOut: Date;

  @ApiProperty({ description: 'Guest information' })
  @IsString()
  guestFirstName: string;

  @ApiProperty({ description: 'Guest information' })
  @IsString()
  guestLastName: string;

  @ApiProperty({ description: 'Guest email' })
  @IsString()
  guestEmail: string;

  @ApiProperty({ description: 'Guest phone' })
  @IsString()
  guestPhone: string;

  @ApiProperty({ description: 'Special requests', required: false })
  @IsOptional()
  @IsString()
  specialRequests?: string;

  @ApiProperty({ description: 'Guest language', enum: ['el', 'en', 'de'], default: 'en' })
  @IsOptional()
  @IsString()
  language?: 'el' | 'en' | 'de';

  @ApiProperty({ description: 'Payment method', enum: ['CARD', 'CASH'] })
  @IsString()
  paymentMethod: 'CARD' | 'CASH';

  @ApiProperty({ description: 'Total amount', example: 180.00 })
  @IsNumber()
  @Min(0)
  totalAmount: number;
}

export class QuickRoomSearchDto {
  @ApiProperty({ description: 'Number of adults', example: 4 })
  @IsNumber()
  @Min(1)
  adults: number;

  @ApiProperty({ description: 'Number of children', example: 0 })
  @IsNumber()
  @Min(0)
  children: number;

  @ApiProperty({ description: 'Check-in date', example: '2024-06-15' })
  @IsDate()
  @Type(() => Date)
  checkIn: Date;

  @ApiProperty({ description: 'Check-out date', example: '2024-06-18' })
  @IsDate()
  @Type(() => Date)
  checkOut: Date;
}
