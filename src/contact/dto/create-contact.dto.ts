import { IsString, IsEmail, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty({ example: 'John Doe', description: 'Contact name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'john.doe@example.com', description: 'Contact email' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: '+30 123 456 7890', description: 'Contact phone number', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ example: 'Question about booking', description: 'Contact subject' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty({ example: 'I would like to know more about your apartments...', description: 'Contact message' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;
}
