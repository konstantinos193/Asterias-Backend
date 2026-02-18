import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BypassAuthGuard } from '../auth/guards/bypass-auth.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { MongoObjectIdPipe } from '../common/pipes/mongodb-object-id.pipe';

@ApiTags('rooms')
@Controller('rooms')
@UseGuards(BypassAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
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
}
