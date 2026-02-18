import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from '../models/room.model';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(@InjectModel(Room.name) private roomModel: Model<RoomDocument>) {}

  async create(createRoomDto: CreateRoomDto): Promise<Room> {
    const room = new this.roomModel(createRoomDto);
    return room.save();
  }

  async findAll(): Promise<Room[]> {
    const rooms = await this.roomModel.find().exec();
    console.log('🔥 Public rooms service returning:', rooms.length, 'rooms');
    if (rooms.length > 0) {
      console.log('🔥 First room sample:', {
        id: rooms[0]._id,
        name: rooms[0].name,
        image: rooms[0].image,
        images: rooms[0].images,
        imagesLength: rooms[0].images?.length
      });
    }
    return rooms;
  }

  async findOne(id: string): Promise<Room | null> {
    return this.roomModel.findById(id).exec();
  }

  async findAvailable(checkIn: string, checkOut: string): Promise<Room[]> {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    return this.roomModel.find({
      $and: [
        { totalRooms: { $gt: 0 } },
        {
          $or: [
            { bookingcom_room_id: { $exists: false } },
            { bookingcom_room_id: null }
          ]
        }
      ]
    }).exec();
  }

  async update(id: string, updateRoomDto: UpdateRoomDto): Promise<Room | null> {
    return this.roomModel.findByIdAndUpdate(id, updateRoomDto, { returnDocument: 'after' }).exec();
  }

  async remove(id: string): Promise<Room | null> {
    return this.roomModel.findByIdAndDelete(id).exec();
  }
}
