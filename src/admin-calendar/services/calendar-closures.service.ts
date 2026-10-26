import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { dayKey, dayStart, nightsBetween } from '../../availability/availability-rules';
import { CONFLICT_CODES, CONFLICT_MESSAGES, MAX_GRID_NIGHTS } from '../calendar.constants';
import { CalendarClosure, DayKey } from '../calendar.types';
import { toClosure } from '../lib/calendar-mappers';
import { CreateClosureDto, UpdateClosureDto } from '../dto/closure.dto';
import { CalendarBookingsRepository } from '../repositories/calendar-bookings.repository';
import { CalendarClosuresRepository, ClosureRow } from '../repositories/calendar-closures.repository';
import { CalendarRoomsRepository } from '../repositories/calendar-rooms.repository';

/** A closure may run longer than one screen, but not unboundedly. */
const MAX_CLOSURE_NIGHTS = MAX_GRID_NIGHTS * 4;

@Injectable()
export class CalendarClosuresService {
  constructor(
    private readonly closures: CalendarClosuresRepository,
    private readonly bookings: CalendarBookingsRepository,
    private readonly rooms: CalendarRoomsRepository,
  ) {}

  async create(dto: CreateClosureDto): Promise<CalendarClosure> {
    this.assertSpan(dto.startDate, dto.endDate);
    const room = await this.requireRoom(dto.roomId);

    if (!dto.force) {
      await this.assertNoGuests(dto.roomId, dto.startDate, dto.endDate);
    }

    const created = await this.closures.create({
      roomId: new Types.ObjectId(dto.roomId),
      startDate: dayStart(dto.startDate),
      endDate: dayStart(dto.endDate),
      reason: dto.reason.trim(),
      active: dto.active ?? true,
    });

    return toClosure(created, new Map([[dto.roomId, room.name]]));
  }

  async update(closureId: string, dto: UpdateClosureDto): Promise<CalendarClosure> {
    const existing = await this.requireClosure(closureId);
    const roomId = String(existing.roomId);

    const startDate = dto.startDate ?? dayKey(existing.startDate);
    const endDate = dto.endDate ?? dayKey(existing.endDate);
    this.assertSpan(startDate, endDate);

    const willBeActive = dto.active ?? existing.active !== false;
    const datesMoved = startDate !== dayKey(existing.startDate) || endDate !== dayKey(existing.endDate);
    if (willBeActive && (datesMoved || existing.active === false) && !dto.force) {
      await this.assertNoGuests(roomId, startDate, endDate);
    }

    const patch: Record<string, unknown> = {
      startDate: dayStart(startDate),
      endDate: dayStart(endDate),
      active: willBeActive,
    };
    if (dto.reason !== undefined) patch.reason = dto.reason.trim();

    const updated = await this.closures.updateById(closureId, patch);
    if (!updated) throw new NotFoundException('Το κλείσιμο δεν βρέθηκε');

    const room = await this.rooms.findById(roomId);
    return toClosure(updated, new Map(room ? [[roomId, room.name]] : []));
  }

  async remove(closureId: string): Promise<{ removed: boolean }> {
    const removed = await this.closures.deleteById(closureId);
    if (!removed) throw new NotFoundException('Το κλείσιμο δεν βρέθηκε');
    return { removed };
  }

  private assertSpan(startDate: DayKey, endDate: DayKey): void {
    const nights = nightsBetween(startDate, endDate);
    if (nights < 1) {
      throw new BadRequestException('Η ημερομηνία λήξης πρέπει να είναι μετά την έναρξη');
    }
    if (nights > MAX_CLOSURE_NIGHTS) {
      throw new BadRequestException(`Το κλείσιμο δεν μπορεί να ξεπερνά τις ${MAX_CLOSURE_NIGHTS} νύχτες`);
    }
  }

  private async requireRoom(roomId: string) {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException('Το δωμάτιο δεν βρέθηκε');
    return room;
  }

  private async requireClosure(closureId: string): Promise<ClosureRow> {
    const closure = await this.closures.findById(closureId);
    if (!closure) throw new NotFoundException('Το κλείσιμο δεν βρέθηκε');
    return closure;
  }

  /** Closing nights a guest holds hides the stay behind a block, so it is refused. */
  private async assertNoGuests(roomId: string, startDate: DayKey, endDate: DayKey): Promise<void> {
    const occupants = await this.bookings.listOccupantsOfRoom(
      roomId,
      dayStart(startDate),
      dayStart(endDate),
    );
    if (!occupants.length) return;

    const first = occupants
      .map((o) => dayKey(o.checkIn))
      .sort()
      .find(() => true);

    throw new ConflictException({
      message: CONFLICT_MESSAGES[CONFLICT_CODES.nightBooked],
      details: { code: CONFLICT_CODES.nightBooked, date: first },
    });
  }
}
