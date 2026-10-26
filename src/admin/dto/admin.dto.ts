import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsAfterStayDate, IsStayDate } from '../../common/validators/stay-dates.validator';
import {
  BOOKING_STATUSES,
  BookingStatus,
  PAYMENT_STATUSES,
  PaymentStatus,
} from '../../common/enums';
import { REFUND_REASONS, RefundReason } from '../../payments/stripe-refunds';
import { SETTING_KEYS } from '../../models/settings.model';

/**
 * Request bodies for the admin API.
 *
 * None of the 39 routes on AdminController had a DTO: 16 took `@Body()` with
 * either an inline structural type or `any`. The global
 * `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` only acts
 * on DTO *classes*, so across this whole controller it was a no-op — an inline
 * `@Body() body: { status?: string }` annotation is erased at compile time and
 * leaves nothing to validate against.
 *
 * The consequence was not theoretical: `createRoom(roomData: any)` handed the
 * raw request body to `new this.roomModel(roomData)`.
 */

const MAX_BULK_IDS = 200;

export class UpdateBookingDto {
  @ApiProperty({ required: false, enum: BOOKING_STATUSES })
  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  bookingStatus?: BookingStatus;

  @ApiProperty({ required: false, enum: PAYMENT_STATUSES })
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  paymentStatus?: PaymentStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000000)
  totalAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000000)
  depositAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  depositPaid?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  depositPaidAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  postCheckoutEmailSent?: boolean;
}

export class RefundBookingDto {
  /** Omitted refunds the whole refundable amount. */
  @ApiProperty({ required: false, description: 'Omit to refund everything refundable' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(1000000)
  amount?: number;

  @ApiProperty({ required: false, enum: REFUND_REASONS })
  @IsOptional()
  @IsIn(REFUND_REASONS)
  reason?: RefundReason;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CancelBookingDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cancellationReason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000000)
  refundAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}

export class BulkBookingIdsDto {
  @ApiProperty({ type: [String], maxItems: MAX_BULK_IDS })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_BULK_IDS)
  @IsMongoId({ each: true })
  bookingIds: string[];
}

export class BulkUpdateBookingStatusDto extends BulkBookingIdsDto {
  @ApiProperty({ enum: BOOKING_STATUSES })
  @IsIn(BOOKING_STATUSES)
  status: BookingStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: BOOKING_STATUSES })
  @IsIn(BOOKING_STATUSES)
  status: BookingStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}

export class UpdateRoomAvailabilityDto {
  @ApiProperty({ description: 'On sale indefinitely, or off sale for every night' })
  @IsBoolean()
  available: boolean;
}

export class PricingByOccupancyDto {
  @ApiProperty({ minimum: 1, maximum: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  guests: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  price: number;
}

export class RoomTaxesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  vat?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  municipalFees?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  environmentalTax?: number;
}

export class UpdateRoomPricingDto {
  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  basePrice: number;

  @ApiProperty({ required: false, type: [PricingByOccupancyDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PricingByOccupancyDto)
  pricingByOccupancy?: PricingByOccupancyDto[];

  @ApiProperty({ required: false, type: RoomTaxesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RoomTaxesDto)
  taxes?: RoomTaxesDto;
}

export class BlockRoomDatesDto {
  @ApiProperty({ example: '2026-07-04' })
  @IsStayDate()
  startDate: string;

  @ApiProperty({ example: '2026-07-10' })
  @IsStayDate()
  @IsAfterStayDate('startDate')
  endDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SeasonalPricesDto {
  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  '2beds'?: number;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  '3beds'?: number;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  '4beds'?: number;
}

export class SeasonalPricingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsStayDate()
  startDate: string;

  /**
   * Inclusive, unlike a stay's checkOut — a season that ends on the 30th covers
   * the 30th. So this is not `IsAfterStayDate`: equal dates are a one-day
   * season, which the service accepts.
   */
  @ApiProperty({ example: '2026-09-30', description: 'Inclusive last day of the period' })
  @IsStayDate()
  endDate: string;

  @ApiProperty({ type: SeasonalPricesDto })
  @IsObject()
  @ValidateNested()
  @Type(() => SeasonalPricesDto)
  prices: SeasonalPricesDto;

  @ApiProperty({ required: false, description: 'Higher wins where periods overlap' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/**
 * Settings, generated from the field declarations.
 *
 * Written out as explicit properties rather than derived at runtime because
 * class-validator needs decorator metadata per property. SETTING_KEYS is used
 * in the test that asserts the two lists have not drifted apart.
 */
export class UpdateSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  bookingConfirmations?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  reminderNotifications?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  newBookingAlerts?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  lowInventoryAlerts?: boolean;

  @ApiProperty({ required: false, minimum: 1, maximum: 336 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(336)
  reminderHours?: number;

  @ApiProperty({ required: false, example: '15:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  checkInTime?: string;

  @ApiProperty({ required: false, example: '11:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  checkOutTime?: string;

  @ApiProperty({ required: false, minimum: 0, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  minAdvanceBooking?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 1095 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1095)
  maxAdvanceBooking?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 8760 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(8760)
  cancellationPolicy?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  municipalFee?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  environmentalTax?: number;
}

/** Exported so a test can assert this DTO covers every writable setting. */
export const UPDATE_SETTINGS_KEYS = SETTING_KEYS;
