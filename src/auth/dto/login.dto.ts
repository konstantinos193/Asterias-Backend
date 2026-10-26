import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  // Bounded so a login attempt cannot be used to make the server hash a
  // megabyte-long string.
  @ApiProperty()
  @IsString()
  @MaxLength(72)
  password: string;
}
