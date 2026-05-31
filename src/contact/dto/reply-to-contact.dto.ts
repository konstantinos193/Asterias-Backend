import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReplyToContactDto {
  @ApiProperty({ 
    example: 'Thank you for your inquiry. We have received your message and will respond shortly.',
    description: 'Reply message to send to the contact'
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}
