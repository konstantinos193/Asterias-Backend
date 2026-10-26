import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireAdmin } from '../auth/decorators/require-admin.decorator';
import { MongoObjectIdPipe } from '../common/pipes/mongodb-object-id.pipe';
import { todayAtProperty } from '../availability/availability-rules';
import { DEFAULT_GRID_NIGHTS } from './calendar.constants';
import { GridQueryDto } from './dto/grid-query.dto';
import { CreateClosureDto, UpdateClosureDto } from './dto/closure.dto';
import { UpdateRatesDto } from './dto/rates.dto';
import { UpdateRoomDto } from './dto/room.dto';
import {
  CreateReservationDto,
  ReassignReservationDto,
  SetStatusDto,
  UpdateBillingDto,
  UpdateGuestDto,
} from './dto/reservation.dto';
import { CalendarGridService } from './services/calendar-grid.service';
import { CalendarReservationsService } from './services/calendar-reservations.service';
import { CalendarClosuresService } from './services/calendar-closures.service';
import { CalendarRatesService } from './services/calendar-rates.service';
import { CalendarRoomsService } from './services/calendar-rooms.service';

@Controller('admin/calendar')
@UseGuards(JwtAuthGuard, AdminGuard)
@RequireAdmin()
export class AdminCalendarController {
  constructor(
    private readonly grid: CalendarGridService,
    private readonly reservations: CalendarReservationsService,
    private readonly closures: CalendarClosuresService,
    private readonly rates: CalendarRatesService,
    private readonly rooms: CalendarRoomsService,
  ) {}

  @Get()
  getGrid(@Query() query: GridQueryDto) {
    return this.grid.getGrid(query.from ?? todayAtProperty(), query.days ?? DEFAULT_GRID_NIGHTS);
  }

  @Get('revision')
  getRevision() {
    return this.grid.revision();
  }

  @Post('reservations')
  createReservation(@Body() dto: CreateReservationDto) {
    return this.reservations.create(dto);
  }

  @Put('reservations/:id/assignment')
  reassignReservation(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: ReassignReservationDto,
  ) {
    return this.reservations.reassign(id, dto);
  }

  @Put('reservations/:id/guest')
  updateGuest(@Param('id', MongoObjectIdPipe) id: string, @Body() dto: UpdateGuestDto) {
    return this.reservations.updateGuest(id, dto);
  }

  @Put('reservations/:id/billing')
  updateBilling(@Param('id', MongoObjectIdPipe) id: string, @Body() dto: UpdateBillingDto) {
    return this.reservations.updateBilling(id, dto);
  }

  @Put('reservations/:id/status')
  setStatus(@Param('id', MongoObjectIdPipe) id: string, @Body() dto: SetStatusDto) {
    return this.reservations.setStatus(id, dto);
  }

  @Delete('reservations/:id')
  removeReservation(@Param('id', MongoObjectIdPipe) id: string) {
    return this.reservations.remove(id);
  }

  @Get('reservations/:id/group')
  getGroup(@Param('id', MongoObjectIdPipe) id: string) {
    return this.reservations.getGroup(id);
  }

  @Post('closures')
  createClosure(@Body() dto: CreateClosureDto) {
    return this.closures.create(dto);
  }

  @Put('closures/:id')
  updateClosure(@Param('id', MongoObjectIdPipe) id: string, @Body() dto: UpdateClosureDto) {
    return this.closures.update(id, dto);
  }

  @Delete('closures/:id')
  removeClosure(@Param('id', MongoObjectIdPipe) id: string) {
    return this.closures.remove(id);
  }

  @Put('rates')
  updateRates(@Body() dto: UpdateRatesDto) {
    return this.rates.update(dto);
  }

  @Put('rooms/:id')
  updateRoom(@Param('id', MongoObjectIdPipe) id: string, @Body() dto: UpdateRoomDto) {
    return this.rooms.update(id, dto);
  }
}
