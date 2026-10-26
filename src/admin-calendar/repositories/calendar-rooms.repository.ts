import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from '../../models/room.model';

export interface RoomRow {
  _id: Types.ObjectId;
  name: string;
  roomType: string;
  floor: string;
  price: number;
  available: boolean;
  roomStatus?: 'available' | 'closed' | 'maintenance';
  totalRooms: number;
  capacity: number;
}

/** The fields the calendar is allowed to write on a room. */
export interface RoomPatch {
  name?: string;
  roomStatus?: 'available' | 'closed' | 'maintenance';
  available?: boolean;
  totalRooms?: number;
  capacity?: number;
  roomType?: string;
  floor?: string;
  price?: number;
  priceAdjustment?: number;
  pricingByOccupancy?: { guests: number; price: number }[];
}

const GRID_FIELDS =
  'name roomType floor price available roomStatus totalRooms capacity sortOrder';

@Injectable()
export class CalendarRoomsRepository {
  constructor(@InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>) {}

  async listForGrid(): Promise<RoomRow[]> {
    return this.roomModel
      .find({})
      .select(GRID_FIELDS)
      .sort({ sortOrder: 1, name: 1 })
      .lean<RoomRow[]>();
  }

  async findById(roomId: string): Promise<RoomRow | null> {
    return this.roomModel.findById(roomId).select(GRID_FIELDS).lean<RoomRow>();
  }

  async updateFields(roomId: string, patch: RoomPatch): Promise<RoomRow | null> {
    return this.roomModel
      .findByIdAndUpdate(roomId, { $set: patch }, { new: true, runValidators: true })
      .select(GRID_FIELDS)
      .lean<RoomRow>();
  }
}
