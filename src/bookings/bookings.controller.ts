import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, NotFoundException, BadRequestException, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ApiKeyAuthGuard } from '../auth/guards/api-key-auth.guard';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { SendEmailDto } from './dto/send-email.dto';
import { RoomCombinationRequestDto, MultiRoomBookingDto, QuickRoomSearchDto } from './dto/room-combination.dto';
import { MongoObjectIdPipe } from '../common/pipes/mongodb-object-id.pipe';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * Admin only. It takes `totalAmount` and `bookingStatus` straight from the
   * body, so while it was public anyone could create a CONFIRMED booking at any
   * price and hold the apartment. Guests book through the payment endpoints
   * (which price the stay server-side) and the owner books through
   * POST /payments/create-cash-booking.
   */
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Create a new booking (admin)' })
  @ApiResponse({ status: 201, description: 'Booking successfully created' })
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.create(createBookingDto);
  }

  /**
   * Admin only. Any signed-in account used to be able to page through every
   * booking in the system — guest names, emails, phone numbers, stay dates and
   * amounts. Guests list their own stays via GET /bookings/my-bookings.
   */
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get all bookings (admin, paginated)' })
  @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.bookingsService.findAllPaginated({
      page: page ? parseInt(page, 10) : 1,
      limit: Math.min(limit ? parseInt(limit, 10) : 50, 200),
      status,
    });
  }

  @Get('availability')
  @ApiOperation({ summary: 'Check room availability' })
  @ApiResponse({ status: 200, description: 'Availability checked successfully' })
  async checkAvailability(@Query('roomId') roomId: string, @Query('checkIn') checkIn: string, @Query('checkOut') checkOut: string) {
    if (!roomId || !checkIn || !checkOut) {
      throw new BadRequestException('roomId, checkIn, and checkOut are required');
    }
    return this.bookingsService.checkAvailability(roomId, new Date(checkIn), new Date(checkOut));
  }

  @Get('stats/summary')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get booking statistics (admin)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  getStats() {
    return this.bookingsService.getStats();
  }

  @Get('my-bookings')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get bookings for the current user' })
  @ApiResponse({ status: 200, description: 'User bookings retrieved successfully' })
  async getMyBookings(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const userId = req.user._id;
    const role = req.user.role;
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = Math.min(page ? parseInt(limit, 10) : 10, 100);

    if (role === 'ADMIN') {
      return this.bookingsService.findAllPaginated({ page: parsedPage, limit: parsedLimit, status });
    }
    return this.bookingsService.findMyBookings(userId, { page: parsedPage, limit: parsedLimit, status });
  }

  /**
   * Signed in only. With OptionalAuthGuard a request without a token arrived as
   * `req.user = null`, which made `userId` undefined — the same value an admin
   * gets — so anyone holding a booking id could cancel anyone's booking. The
   * guest flow is /my-bookings, which is behind the login already; a cancel link
   * for guests who are not signed in needs a signed token, not an open route.
   */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiResponse({ status: 200, description: 'Booking cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async cancelBooking(@Param('id', MongoObjectIdPipe) id: string, @Request() req) {
    const userId = req.user?.role === 'ADMIN' ? undefined : req.user?._id;
    const booking = await this.bookingsService.cancelBooking(id, userId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  /**
   * Owner or admin. It used to return any booking to any signed-in user, and
   * booking ids are handed out to guests, so one account was enough to walk
   * the whole table.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get booking by ID (owner or admin)' })
  @ApiResponse({ status: 200, description: 'Booking retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async findOne(@Param('id', MongoObjectIdPipe) id: string, @Request() req) {
    const booking = await this.bookingsService.findOne(id);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (req.user.role !== 'ADMIN') {
      // findOne populates userId, so this is either a document or an id.
      const owner = (booking as any).userId;
      const ownerId = owner?._id ? String(owner._id) : owner ? String(owner) : null;
      // A 404 rather than a 403: a 403 would confirm the booking exists.
      if (!ownerId || ownerId !== String(req.user._id)) {
        throw new NotFoundException('Booking not found');
      }
    }

    return booking;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Update booking (admin)' })
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
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Delete booking (admin)' })
  @ApiResponse({ status: 200, description: 'Booking successfully deleted' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async remove(@Param('id', MongoObjectIdPipe) id: string) {
    const booking = await this.bookingsService.remove(id);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  /**
   * Admin only. Open to every signed-in user this was a way to send mail from
   * the property's address to a guest, with an attacker-supplied message body.
   */
  @Post(':id/send-email')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Send email to guest (admin)' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async sendEmail(@Param('id', MongoObjectIdPipe) id: string, @Body() sendEmailDto: SendEmailDto) {
    return this.bookingsService.sendEmail(id, sendEmailDto);
  }

  @Post('room-combinations')
  @ApiOperation({ summary: 'Get optimal room combinations for guests' })
  @ApiResponse({ status: 200, description: 'Room combinations calculated successfully' })
  async getRoomCombinations(@Body() request: RoomCombinationRequestDto) {
    return this.bookingsService.getRoomCombinations(request);
  }

  /**
   * Admin only, and priced server-side: the combination in the body is treated
   * as a choice of apartments, never as a price.
   */
  @Post('multi-room-booking')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Create multi-room booking (admin)' })
  @ApiResponse({ status: 201, description: 'Multi-room booking created successfully' })
  async createMultiRoomBooking(@Body() multiRoomBookingDto: MultiRoomBookingDto) {
    return this.bookingsService.createMultiRoomBooking(multiRoomBookingDto);
  }

  @Post('quick-room-search')
  @ApiOperation({ summary: 'Quick room search for backward compatibility' })
  @ApiResponse({ status: 200, description: 'Best room found successfully' })
  async quickRoomSearch(@Body() searchDto: QuickRoomSearchDto) {
    return this.bookingsService.findBestRoom(
      searchDto.adults, 
      searchDto.children, 
      searchDto.checkIn, 
      searchDto.checkOut
    );
  }
}
