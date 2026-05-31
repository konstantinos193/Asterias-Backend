import { IsString, IsNumber, IsOptional, IsNotEmpty } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  checkIn: string;

  @IsString()
  @IsNotEmpty()
  checkOut: string;

  @IsNumber()
  adults: number;

  @IsNumber()
  @IsOptional()
  children?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  offerId?: string;
}
