import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  street?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  zipCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;
}

/**
 * Note what is *not* here: `role`. It used to be an accepted field, so
 * `POST /api/auth/register` (and the then-public `POST /api/users`) handed out
 * ADMIN to anyone who asked for it. With `forbidNonWhitelisted` on the global
 * pipe, sending `role` now fails the request outright; AuthService pins the
 * role as well, so neither layer alone has to hold.
 */
export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username may contain only letters, numbers, dots, underscores and hyphens',
  })
  username: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  // Capped because bcrypt silently truncates past 72 bytes, and an uncapped
  // password is a cheap way to make the server burn CPU hashing.
  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  password: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  @Matches(/^[0-9+()\s-]*$/, { message: 'phone contains invalid characters' })
  phone?: string;

  @ApiProperty({ required: false, type: AddressDto })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}
