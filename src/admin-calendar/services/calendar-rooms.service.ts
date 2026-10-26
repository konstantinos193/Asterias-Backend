import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomsService } from '../../rooms/rooms.service';
import { UpdateRoomDto } from '../dto/room.dto';
import {
  CalendarRoomsRepository,
  RoomPatch,
  RoomRow,
} from '../repositories/calendar-rooms.repository';

@Injectable()
export class CalendarRoomsService {
  constructor(
    private readonly rooms: CalendarRoomsRepository,
    private readonly roomsService: RoomsService,
  ) {}

  /**
   * The operational half of a room, edited without leaving the calendar.
   * `roomStatus` drives `available`, which is the flag availability reads — the
   * two cannot be set apart, which is how "Συντήρηση" used to come back open.
   */
  async update(roomId: string, dto: UpdateRoomDto): Promise<RoomRow> {
    const patch: RoomPatch = { ...dto };

    if (dto.roomStatus) {
      patch.available = dto.roomStatus === 'available';
    }

    const updated = await this.rooms.updateFields(roomId, patch);
    if (!updated) throw new NotFoundException('Το δωμάτιο δεν βρέθηκε');

    // The public /api/rooms list is cached; a room edit has to drop it.
    this.roomsService.clearRoomsCache();
    return updated;
  }
}
