import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { isDayKey, todayAtProperty } from '../availability/availability-rules';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { MongoObjectIdPipe } from '../common/pipes/mongodb-object-id.pipe';
import { parseListLimit, parsePageNumber } from '../common/limits';
import { UserRole } from '../common/enums';
import { CreateRoomDto } from '../rooms/dto/create-room.dto';
import { UpdateRoomDto } from '../rooms/dto/update-room.dto';
import { CreateOfferDto, UpdateOfferDto } from '../offers/dto/offer.dto';
import {
  BlockRoomDatesDto,
  BulkBookingIdsDto,
  BulkUpdateBookingStatusDto,
  CancelBookingDto,
  RefundBookingDto,
  SeasonalPricingDto,
  UpdateBookingDto,
  UpdateBookingStatusDto,
  UpdateRoomAvailabilityDto,
  UpdateRoomPricingDto,
  UpdateSettingsDto,
} from './dto/admin.dto';

/**
 * The admin API.
 *
 * Two things used to be true of almost every handler here and are no longer:
 *
 * 1. Each one wrapped its service call in try/catch and rethrew a generic 500.
 *    AdminService raises the right exceptions — NotFoundException('Room not
 *    found'), BadRequestException, ConflictException — and all 39 handlers
 *    discarded them, so the panel received `500 Failed to update room` where it
 *    should have had a 404 and could not tell "does not exist" from "server is
 *    broken". That was ~260 lines whose only effect was to defeat
 *    common/filters/http-exception.filter.ts, which already does this job and
 *    already sanitises Mongoose validation and duplicate-key errors. The filter
 *    is registered globally in main.ts; handlers now just let exceptions
 *    through, and Stripe's own refusals are translated by the filter too.
 *
 * 2. Every body was an inline structural type or `any`, which the global
 *    ValidationPipe cannot act on. They are DTO classes now — see dto/admin.dto.ts.
 *
 * The class-level @UseGuards covers all of these routes. The per-route
 * duplicates that used to accompany it were removed: repeating a guard that is
 * already applied suggests the ones without it are somehow different.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: "Today's arrivals, departures, occupancy and revenue" })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Booking and revenue analytics for a period' })
  getAnalytics(
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getAnalytics({ period, startDate, endDate });
  }

  @Get('revenue-reports')
  @ApiOperation({ summary: 'Revenue broken down by period' })
  getRevenueReports(@Query('period') period?: string) {
    return this.adminService.getRevenueReports(period);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List bookings, filtered and paged' })
  getBookings(
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('checkIn') checkIn?: string,
    @Query('checkOut') checkOut?: string,
    @Query('guestEmail') guestEmail?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.adminService.getBookings({
      status,
      paymentStatus,
      checkIn,
      checkOut,
      guestEmail,
      page: parsePageNumber(page),
      // Capped. This was `parseInt(limit) || 20` feeding `.limit()` directly,
      // so ?limit=9999999 returned the whole collection.
      limit: parseListLimit(limit),
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
    });
  }

  @Get('bookings/:bookingId')
  @ApiOperation({ summary: 'One booking in full' })
  getBookingById(@Param('bookingId', MongoObjectIdPipe) bookingId: string) {
    return this.adminService.getBookingById(bookingId);
  }

  @Put('bookings/:bookingId')
  @ApiOperation({ summary: 'Update a booking' })
  updateBooking(
    @Param('bookingId', MongoObjectIdPipe) bookingId: string,
    @Body() body: UpdateBookingDto,
  ) {
    return this.adminService.updateBooking(bookingId, body);
  }

  /** The payment behind a booking, read live from Stripe for card payments. */
  @Get('bookings/:bookingId/payment')
  @ApiOperation({ summary: 'The payment behind a booking, read live from Stripe' })
  getBookingPayment(@Param('bookingId', MongoObjectIdPipe) bookingId: string) {
    return this.adminService.getBookingPayment(bookingId);
  }

  /** Refunds part or all of a booking's payment without cancelling it. */
  @Post('bookings/:bookingId/refund')
  @ApiOperation({ summary: "Refund part or all of a booking's payment" })
  refundBooking(
    @Param('bookingId', MongoObjectIdPipe) bookingId: string,
    @Body() body: RefundBookingDto,
  ) {
    return this.adminService.refundBooking(bookingId, body);
  }

  @Put('bookings/:bookingId/cancel')
  @ApiOperation({ summary: 'Cancel a booking, optionally refunding it' })
  cancelBooking(
    @Param('bookingId', MongoObjectIdPipe) bookingId: string,
    @Body() body: CancelBookingDto,
  ) {
    return this.adminService.cancelBooking(bookingId, body);
  }

  @Put('bookings/bulk/status')
  @ApiOperation({ summary: 'Set the status of several bookings at once' })
  bulkUpdateBookingStatus(@Body() body: BulkUpdateBookingStatusDto) {
    return this.adminService.bulkUpdateBookingStatus(body);
  }

  @Delete('bookings/bulk')
  @ApiOperation({ summary: 'Delete several bookings at once' })
  bulkDeleteBookings(@Body() body: BulkBookingIdsDto) {
    return this.adminService.bulkDeleteBookings(body.bookingIds);
  }

  @Put('bookings/:bookingId/status')
  @ApiOperation({ summary: "Set one booking's status" })
  updateBookingStatus(
    @Param('bookingId', MongoObjectIdPipe) bookingId: string,
    @Body() body: UpdateBookingStatusDto,
  ) {
    return this.adminService.updateBookingStatus(bookingId, body);
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Night-by-night occupancy from a start date' })
  getOccupancy(@Query('from') from?: string, @Query('days') days?: string) {
    const start = from ?? todayAtProperty();
    if (!isDayKey(start)) {
      throw new BadRequestException('from must be a date in YYYY-MM-DD form');
    }
    const n = Math.min(Math.max(parseInt(days, 10) || 30, 1), 92);
    return this.adminService.getOccupancy(start, n);
  }

  @Get('rooms')
  @ApiOperation({ summary: 'List rooms, filtered and paged' })
  getRooms(
    @Query('available') available?: string,
    @Query('roomType') roomType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.adminService.getRooms({
      available: available === 'true',
      roomType,
      page: parsePageNumber(page),
      limit: parseListLimit(limit),
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
    });
  }

  // Declared before 'rooms/:id' so the literal segments are not captured as an
  // id. Nest matches in declaration order.
  @Get('rooms/types')
  @ApiOperation({ summary: 'Distinct room types with aggregate capacity' })
  getRoomTypes() {
    return this.adminService.getRoomTypes();
  }

  @Get('rooms/stats')
  @ApiOperation({ summary: 'Room counts and average price by capacity' })
  getRoomStats() {
    return this.adminService.getRoomStats();
  }

  @Get('rooms/:id')
  @ApiOperation({ summary: 'One room in full' })
  getRoomById(@Param('id', MongoObjectIdPipe) id: string) {
    return this.adminService.getRoomById(id);
  }

  @Post('rooms')
  @ApiOperation({ summary: 'Create a room' })
  createRoom(@Body() body: CreateRoomDto) {
    return this.adminService.createRoom(body);
  }

  @Put('rooms/:id')
  @ApiOperation({ summary: 'Update a room' })
  updateRoom(@Param('id', MongoObjectIdPipe) id: string, @Body() body: UpdateRoomDto) {
    return this.adminService.updateRoom(id, body);
  }

  @Delete('rooms/:id')
  @ApiOperation({ summary: 'Delete a room, if it has no active bookings' })
  deleteRoom(@Param('id', MongoObjectIdPipe) id: string) {
    return this.adminService.deleteRoom(id);
  }

  @Get('rooms/:id/availability')
  @ApiOperation({ summary: 'Night-by-night availability for one room' })
  getRoomAvailability(
    @Param('id', MongoObjectIdPipe) id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!isDayKey(startDate) || !isDayKey(endDate)) {
      throw new BadRequestException('startDate and endDate must be dates in YYYY-MM-DD form');
    }
    return this.adminService.getRoomAvailability(id, startDate, endDate);
  }

  @Patch('rooms/:id/availability')
  @ApiOperation({ summary: 'Put a room on or off sale indefinitely' })
  updateRoomAvailability(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() body: UpdateRoomAvailabilityDto,
  ) {
    return this.adminService.updateRoomAvailability(id, body.available);
  }

  @Patch('rooms/:id/pricing')
  @ApiOperation({ summary: "Set a room's base price and per-occupancy prices" })
  updateRoomPricing(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() pricingData: UpdateRoomPricingDto,
  ) {
    return this.adminService.updateRoomPricing(id, pricingData);
  }

  @Post('rooms/:id/block')
  @ApiOperation({ summary: 'Close a date range for one room' })
  blockRoomDates(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() body: BlockRoomDatesDto,
  ) {
    return this.adminService.blockRoomDates(id, body.startDate, body.endDate, body.reason);
  }

  @Delete('rooms/:id/block/:blockId')
  @ApiOperation({ summary: 'Reopen a closed date range' })
  unblockRoomDates(
    @Param('id', MongoObjectIdPipe) id: string,
    @Param('blockId', MongoObjectIdPipe) blockId: string,
  ) {
    return this.adminService.unblockRoomDates(id, blockId);
  }

  @Get('offers')
  @ApiOperation({ summary: 'List offers, paged' })
  getOffers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('active') active?: string,
  ) {
    return this.adminService.getOffers({
      page: parsePageNumber(page),
      limit: parseListLimit(limit),
      active: active !== undefined ? active === 'true' : undefined,
    });
  }

  @Get('offers/:offerId')
  @ApiOperation({ summary: 'One offer in full' })
  getOfferById(@Param('offerId', MongoObjectIdPipe) offerId: string) {
    return this.adminService.getOfferById(offerId);
  }

  @Post('offers')
  @ApiOperation({ summary: 'Create an offer' })
  createOffer(@Body() body: CreateOfferDto) {
    return this.adminService.createOffer(body);
  }

  @Put('offers/:offerId')
  @ApiOperation({ summary: 'Update an offer' })
  updateOffer(
    @Param('offerId', MongoObjectIdPipe) offerId: string,
    @Body() body: UpdateOfferDto,
  ) {
    return this.adminService.updateOffer(offerId, body);
  }

  @Delete('offers/:offerId')
  @ApiOperation({ summary: 'Delete an offer' })
  deleteOffer(@Param('offerId', MongoObjectIdPipe) offerId: string) {
    return this.adminService.deleteOffer(offerId);
  }

  @Put('offers/:offerId/toggle')
  @ApiOperation({ summary: 'Activate or deactivate an offer' })
  toggleOfferStatus(@Param('offerId', MongoObjectIdPipe) offerId: string) {
    return this.adminService.toggleOfferStatus(offerId);
  }

  // ── Seasonal pricing (property-wide, per room type) ──

  @Get('seasonal')
  @ApiOperation({ summary: 'All seasonal pricing periods' })
  getSeasonalPricing() {
    return this.adminService.getSeasonalPricing();
  }

  // The nightly rate for 2/3/4 guests on each night, as guests are charged it.
  @Get('seasonal/calendar')
  @ApiOperation({ summary: 'Nightly rate per guest tier, as guests are charged it' })
  getRateCalendar(@Query('from') from?: string, @Query('days') days?: string) {
    const start = from ?? todayAtProperty();
    if (!isDayKey(start)) {
      throw new BadRequestException('from must be a date in YYYY-MM-DD form');
    }
    const n = Math.min(Math.max(parseInt(days, 10) || 42, 1), 92);
    return this.adminService.getRateCalendar(start, n);
  }

  @Post('seasonal')
  @ApiOperation({ summary: 'Create a seasonal pricing period' })
  createSeasonalPricing(@Body() body: SeasonalPricingDto) {
    return this.adminService.createSeasonalPricing(body);
  }

  @Put('seasonal/:id')
  @ApiOperation({ summary: 'Update a seasonal pricing period' })
  updateSeasonalPricing(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() body: SeasonalPricingDto,
  ) {
    return this.adminService.updateSeasonalPricing(id, body);
  }

  @Delete('seasonal/:id')
  @ApiOperation({ summary: 'Delete a seasonal pricing period' })
  deleteSeasonalPricing(@Param('id', MongoObjectIdPipe) id: string) {
    return this.adminService.deleteSeasonalPricing(id);
  }

  @Get('users')
  @ApiOperation({ summary: 'List users, filtered and paged' })
  getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers({
      page: parsePageNumber(page),
      limit: parseListLimit(limit),
      role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
    });
  }

  @Get('settings')
  @ApiOperation({ summary: 'Property settings' })
  getSettings() {
    return this.adminService.getSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update property settings' })
  updateSettings(@Body() body: UpdateSettingsDto) {
    return this.adminService.updateSettings(body);
  }
}
