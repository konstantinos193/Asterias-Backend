import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The shape of a Booking.com webhook delivery.
 *
 * Deliberately loose about `data`: the payload belongs to the channel, so
 * pinning every field here would make a harmless addition on their side into a
 * 400 and a lost booking. What is validated is the envelope — enough for
 * `whitelist` to strip unknown top-level keys and for `event` to be a string
 * the switch in processNotification can be trusted to compare.
 *
 * The handler took `@Body() notification: any` before, which left the global
 * ValidationPipe nothing to act on.
 */
export class BookingComNotificationDto {
  @ApiProperty({ example: 'booking.created' })
  @IsString()
  @MaxLength(100)
  event: string;

  @ApiProperty({ description: "The channel's own payload for this event" })
  @IsObject()
  data: Record<string, any>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timestamp?: string;
}
