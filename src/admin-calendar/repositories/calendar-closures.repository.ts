import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  RoomBlockedDate,
  RoomBlockedDateDocument,
} from '../../models/room-blocked-date.model';
import { closureFilter } from '../../availability/availability-rules';

export interface ClosureRow {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  reason: string;
  active?: boolean;
}

export interface NewClosure {
  roomId: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  reason: string;
  active: boolean;
}

@Injectable()
export class CalendarClosuresRepository {
  constructor(
    @InjectModel(RoomBlockedDate.name)
    private readonly closureModel: Model<RoomBlockedDateDocument>,
  ) {}

  /**
   * Every closure touching [start, end), parked ones included: the owner manages
   * them here, so the grid has to show what is saved and not only what is shut.
   */
  async listOverlapping(start: Date, end: Date): Promise<ClosureRow[]> {
    return this.closureModel
      .find({ startDate: { $lt: end }, endDate: { $gt: start } })
      .sort({ startDate: 1 })
      .lean<ClosureRow[]>();
  }

  /** Only the closures that actually shut nights of one room. */
  async listActiveInRoom(
    roomId: string,
    start: Date,
    end: Date,
    excludeClosureId?: string,
  ): Promise<ClosureRow[]> {
    const filter: Record<string, unknown> = {
      ...closureFilter(start, end, [new Types.ObjectId(roomId)]),
    };
    if (excludeClosureId) {
      filter._id = { $ne: new Types.ObjectId(excludeClosureId) };
    }
    return this.closureModel.find(filter).lean<ClosureRow[]>();
  }

  async findById(closureId: string): Promise<ClosureRow | null> {
    return this.closureModel.findById(closureId).lean<ClosureRow>();
  }

  async create(closure: NewClosure): Promise<ClosureRow> {
    const created = await this.closureModel.create(closure);
    return created.toObject() as unknown as ClosureRow;
  }

  async updateById(closureId: string, patch: Record<string, unknown>): Promise<ClosureRow | null> {
    return this.closureModel
      .findByIdAndUpdate(closureId, { $set: patch }, { new: true, runValidators: true })
      .lean<ClosureRow>();
  }

  async deleteById(closureId: string): Promise<boolean> {
    const deleted = await this.closureModel.findByIdAndDelete(closureId).lean();
    return deleted !== null;
  }
}
