import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, NotFoundException, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { MongoObjectIdPipe } from '../common/pipes/mongodb-object-id.pipe';

@ApiTags('rooms')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Create a new room' })
  @ApiResponse({ status: 201, description: 'Room successfully created' })
  create(@Body() createRoomDto: CreateRoomDto) {
    return this.roomsService.create(createRoomDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all rooms' })
  @ApiResponse({ status: 200, description: 'Rooms retrieved successfully' })
  findAll() {
    return this.roomsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room by ID' })
  @ApiResponse({ status: 200, description: 'Room retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async findOne(@Param('id', MongoObjectIdPipe) id: string) {
    const room = await this.roomsService.findOne(id);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return room;
  }

  @Get('available/:checkIn/:checkOut')
  @ApiOperation({ summary: 'Get available rooms for date range' })
  @ApiResponse({ status: 200, description: 'Available rooms retrieved successfully' })
  findAvailable(@Param('checkIn') checkIn: string, @Param('checkOut') checkOut: string) {
    return this.roomsService.findAvailable(checkIn, checkOut);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Update room' })
  @ApiResponse({ status: 200, description: 'Room successfully updated' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async update(@Param('id', MongoObjectIdPipe) id: string, @Body() updateRoomDto: UpdateRoomDto) {
    const room = await this.roomsService.update(id, updateRoomDto);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return room;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Delete room' })
  @ApiResponse({ status: 200, description: 'Room successfully deleted' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async remove(@Param('id', MongoObjectIdPipe) id: string) {
    const room = await this.roomsService.remove(id);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return room;
  }
  
  // Admin endpoints
  @Get('admin/types')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get room types grouped by capacity' })
  @ApiResponse({ status: 200, description: 'Room types retrieved successfully' })
  getRoomTypes() {
    return this.roomsService.getRoomTypes();
  }
  
  @Get('admin/availability/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get room availability calendar' })
  @ApiResponse({ status: 200, description: 'Availability calendar retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  getRoomAvailability(
    @Param('id', MongoObjectIdPipe) id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.roomsService.getRoomAvailability(id, start, end);
  }
  
  @Patch('admin/:id/availability')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Update room availability' })
  @ApiResponse({ status: 200, description: 'Room availability updated successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  updateRoomAvailability(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body('available') available: boolean
  ) {
    return this.roomsService.updateRoomAvailability(id, available);
  }

  @Get('admin/:id/block')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get blocked dates for a room' })
  @ApiResponse({ status: 200, description: 'Blocked dates retrieved successfully' })
  getBlockedDates(@Param('id', MongoObjectIdPipe) id: string) {
    return this.roomsService.getBlockedDates(id);
  }

  @Post('admin/:id/block')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Block dates for a room' })
  @ApiResponse({ status: 200, description: 'Dates blocked successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  blockDates(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() body: { startDate: string; endDate: string; reason?: string }
  ) {
    return this.roomsService.blockDates(id, new Date(body.startDate), new Date(body.endDate), body.reason);
  }

  @Delete('admin/:id/block/:blockId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Unblock dates for a room' })
  @ApiResponse({ status: 200, description: 'Dates unblocked successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  unblockDates(
    @Param('id', MongoObjectIdPipe) id: string,
    @Param('blockId') blockId: string
  ) {
    return this.roomsService.unblockDates(id, blockId);
  }
  
  @Patch('admin/:id/pricing')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Update room pricing' })
  @ApiResponse({ status: 200, description: 'Room pricing updated successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  updateRoomPricing(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() pricingData: {
      basePrice: number;
      pricingByOccupancy?: { guests: number; price: number }[];
      taxes?: {
        vat?: number;
        municipalFees?: number;
        environmentalTax?: number;
      };
    }
  ) {
    return this.roomsService.updateRoomPricing(id, pricingData);
  }
  
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get room statistics' })
  @ApiResponse({ status: 200, description: 'Room statistics retrieved successfully' })
  getRoomStats() {
    return this.roomsService.getRoomStats();
  }
}
