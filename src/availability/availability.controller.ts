import { Public, Authenticated } from '../auth/decorators/access.decorator';
import { 
  Controller, 
  Get, 
  Param, 
  Query,
  BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { MAX_RANGE_DAYS } from './availability-engine';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Public()
  @Get('room/:roomId')
  @ApiOperation({ summary: 'Get availability for a specific room on a specific date' })
  @ApiParam({ name: 'roomId', description: 'Room ID' })
  @ApiQuery({ name: 'date', description: 'Date to check (YYYY-MM-DD format)', required: true })
  @ApiResponse({ status: 200, description: 'Room availability retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - date parameter required' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getRoomAvailability(@Param('roomId') roomId: string, @Query('date') date: string) {
    if (!date) {
      throw new BadRequestException('Date parameter is required');
    }

    return await this.availabilityService.getRoomAvailability(roomId, date);
  }

  @Public()
  @Get('date/:date')
  @ApiOperation({ summary: 'Get availability for all rooms on a specific date' })
  @ApiParam({ name: 'date', description: 'Date to check (YYYY-MM-DD format)' })
  @ApiResponse({ status: 200, description: 'Date availability retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getDateAvailability(@Param('date') date: string) {
    return await this.availabilityService.getDateAvailability(date);
  }

  @Public()
  @Get('monthly/:roomId')
  @ApiOperation({ summary: 'Get monthly availability for a specific room' })
  @ApiParam({ name: 'roomId', description: 'Room ID' })
  @ApiQuery({ name: 'month', description: 'Month (1-12)', required: false })
  @ApiQuery({ name: 'year', description: 'Year', required: false })
  @ApiResponse({ status: 200, description: 'Monthly availability retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getMonthlyAvailability(
    @Param('roomId') roomId: string,
    @Query('month') month?: string,
    @Query('year') year?: string
  ) {
    const monthNum = month ? parseInt(month) : undefined;
    const yearNum = year ? parseInt(year) : undefined;
    
    return await this.availabilityService.getMonthlyAvailability(roomId, monthNum, yearNum);
  }

  @Public()
  @Get('calendar')
  @ApiOperation({ summary: 'Get calendar availability data for frontend calendar component (aggregated across all rooms)' })
  @ApiQuery({ name: 'month', description: 'Month (1-12)', required: false })
  @ApiQuery({ name: 'year', description: 'Year', required: false })
  @ApiResponse({ status: 200, description: 'Calendar availability retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getCalendarAvailability(
    @Query('month') month?: string,
    @Query('year') year?: string
  ) {
    const monthNum = month ? parseInt(month) : undefined;
    const yearNum = year ? parseInt(year) : undefined;
    
    return await this.availabilityService.getCalendarAvailability(monthNum, yearNum);
  }

  @Public()
  @Get('calendar-range')
  @ApiOperation({
    summary:
      'Get many months of calendar availability in one request, with the first bookable date',
  })
  @ApiQuery({ name: 'from', description: 'First night (YYYY-MM-DD), defaults to today', required: false })
  @ApiQuery({ name: 'days', description: `Nights to return (1-${MAX_RANGE_DAYS})`, required: false })
  @ApiResponse({ status: 200, description: 'Calendar range retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - malformed from or days' })
  async getCalendarRange(@Query('from') from?: string, @Query('days') days?: string) {
    if (from !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !Number.isFinite(Date.parse(from)) || new Date(from).toISOString().slice(0, 10) !== from)) {
      throw new BadRequestException('from must be a YYYY-MM-DD date');
    }

    let nights: number | undefined;
    if (days !== undefined) {
      nights = Number(days);
      if (!/^\d+$/.test(days) || !Number.isInteger(nights) || nights < 1 || nights > MAX_RANGE_DAYS) {
        throw new BadRequestException(`days must be a whole number between 1 and ${MAX_RANGE_DAYS}`);
      }
    }

    return await this.availabilityService.getCalendarRange(from, nights);
  }

  @Public()
  @Get('overview')
  @ApiOperation({ summary: 'Get availability overview for dashboard' })
  @ApiResponse({ status: 200, description: 'Availability overview retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getAvailabilityOverview() {
    return await this.availabilityService.getAvailabilityOverview();
  }
}
