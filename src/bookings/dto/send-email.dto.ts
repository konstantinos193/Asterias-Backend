import { IsString, IsOptional } from 'class-validator';

export class SendEmailDto {
  @IsString()
  emailType: string;

  @IsString()
  @IsOptional()
  customMessage?: string;
}
