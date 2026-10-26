import { IsIn, IsString, IsOptional, MaxLength } from 'class-validator';

export class SendEmailDto {
  // Constrained to what the service actually switches on, so a bad value is a
  // 400 from the pipe rather than something the handler has to catch.
  @IsIn(['confirmation', 'reminder', 'custom'])
  emailType: 'confirmation' | 'reminder' | 'custom';

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  customMessage?: string;
}
