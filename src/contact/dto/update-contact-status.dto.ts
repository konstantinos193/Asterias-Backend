import { IsEnum, IsOptional, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateContactStatusDto {
  @ApiProperty({ 
    enum: ['UNREAD', 'READ', 'REPLIED', 'CLOSED'], 
    description: 'Contact status',
    example: 'READ'
  })
  @IsEnum(['UNREAD', 'READ', 'REPLIED', 'CLOSED'])
  @IsOptional()
  status?: 'UNREAD' | 'READ' | 'REPLIED' | 'CLOSED';

  @ApiProperty({ 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], 
    description: 'Contact priority',
    example: 'MEDIUM'
  })
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  @IsOptional()
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @ApiProperty({ 
    description: 'User ID to assign contact to',
    example: '507f1f77bcf86cd799439011'
  })
  @IsMongoId()
  @IsOptional()
  assignedTo?: string;
}
