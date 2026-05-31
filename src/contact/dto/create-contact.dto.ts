import { IsString, IsEmail, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty({ example: 'John Doe', description: 'Contact name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'john.doe@example.com', description: 'Contact email' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+30 123 456 7890', description: 'Contact phone number', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Question about booking', description: 'Contact subject' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'I would like to know more about your apartments...', description: 'Contact message' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
