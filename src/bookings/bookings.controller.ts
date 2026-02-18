import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, NotFoundException, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BypassAuthGuard } from '../auth/guards/bypass-auth.guard';
import { ApiKeyAuthGuard } from '../auth/guards/api-key-auth.guard';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { SendEmailDto } from './dto/send-email.dto';
import { MongoObjectIdPipe } from '../common/pipes/mongodb-object-id.pipe';

@ApiTags('bookings')
@Controller('bookings')
@UseGuards(BypassAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({ status: 201, description: 'Booking successfully created' })
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.create(createBookingDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all bookings' })
  @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
  findAll() {
    return this.bookingsService.findAll();
  }

  @Get('availability')
  @ApiOperation({ summary: 'Check room availability' })
  @ApiResponse({ status: 200, description: 'Availability checked successfully' })
  async checkAvailability(@Query('roomId') roomId: string, @Query('checkIn') checkIn: string, @Query('checkOut') checkOut: string) {
    if (!roomId || !checkIn || !checkOut) {
      throw new Error('roomId, checkIn, and checkOut are required');
    }
    return this.bookingsService.checkAvailability(roomId, new Date(checkIn), new Date(checkOut));
  }

  @Get('stats/summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get booking statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  getStats() {
    return this.bookingsService.getStats();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiResponse({ status: 200, description: 'Booking retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async findOne(@Param('id', MongoObjectIdPipe) id: string) {
    const booking = await this.bookingsService.findOne(id);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update booking' })
  @ApiResponse({ status: 200, description: 'Booking successfully updated' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async update(@Param('id', MongoObjectIdPipe) id: string, @Body() updateBookingDto: UpdateBookingDto) {
    const booking = await this.bookingsService.update(id, updateBookingDto);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete booking' })
  @ApiResponse({ status: 200, description: 'Booking successfully deleted' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async remove(@Param('id', MongoObjectIdPipe) id: string) {
    const booking = await this.bookingsService.remove(id);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  @Post(':id/send-email')
  @ApiOperation({ summary: 'Send email to guest' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async sendEmail(@Param('id', MongoObjectIdPipe) id: string, @Body() sendEmailDto: SendEmailDto) {
    return this.bookingsService.sendEmail(id, sendEmailDto);
  }
}
