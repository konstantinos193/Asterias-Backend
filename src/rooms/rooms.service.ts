import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from '../models/room.model';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Booking, BookingDocument } from '../models/booking.model';

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel('Booking') private bookingModel: Model<BookingDocument>
  ) {}

  async create(createRoomDto: CreateRoomDto): Promise<Room> {
    const room = new this.roomModel(createRoomDto);
    return room.save();
  }

  async findAll(): Promise<Room[]> {
    return this.roomModel.find().exec();
  }

  async findOne(id: string): Promise<Room | null> {
    return this.roomModel.findById(id).exec();
  }

  async findAvailable(checkIn: string, checkOut: string): Promise<Room[]> {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    const allRooms = await this.roomModel.find({ available: true }).exec();
    if (!allRooms.length) return [];

    // Filter blocked rooms in-memory (no DB query needed)
    const notBlocked = allRooms.filter(room =>
      !(room as any).blockedDates?.some((block: any) =>
        checkInDate < new Date(block.endDate) && checkOutDate > new Date(block.startDate)
      )
    );
    if (!notBlocked.length) return [];

    // Single aggregate instead of N countDocuments calls
    const roomIds = notBlocked.map(r => (r as any)._id);
    const conflicts = await this.bookingModel.aggregate([
      {
        $match: {
          roomId: { $in: roomIds },
          bookingStatus: { $nin: ['CANCELLED'] },
          checkIn: { $lt: checkOutDate },
          checkOut: { $gt: checkInDate },
        },
      },
      { $group: { _id: '$roomId', count: { $sum: 1 } } },
    ]);

    const conflictMap = new Map(conflicts.map(c => [c._id.toString(), c.count as number]));

    return notBlocked.filter(room =>
      (conflictMap.get((room as any)._id.toString()) ?? 0) < room.totalRooms
    );
  }
  
  async getRoomAvailability(roomId: string, startDate: Date, endDate: Date): Promise<any> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const bookings = await this.bookingModel.find({
      roomId: room._id,
      bookingStatus: { $nin: ['CANCELLED'] },
      $or: [
        { checkIn: { $lte: endDate }, checkOut: { $gte: startDate } },
      ]
    }).sort({ checkIn: 1 });

    const blockedDates = (room as any).blockedDates || [];

    const availability = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const isBooked = bookings.some(booking =>
        current >= booking.checkIn && current < booking.checkOut
      );
      const blockEntry = blockedDates.find((b: any) => {
        const bs = new Date(b.startDate);
        const be = new Date(b.endDate);
        return current >= bs && current < be;
      });

      availability.push({
        date: dateStr,
        available: !isBooked && !blockEntry,
        bookedCount: isBooked ? 1 : 0,
        blocked: !!blockEntry,
        blockReason: blockEntry?.reason || null,
        blockId: blockEntry?._id || null,
        totalRooms: room.totalRooms
      });

      current.setDate(current.getDate() + 1);
    }

    return {
      room,
      availability
    };
  }
  
  async blockDates(roomId: string, startDate: Date, endDate: Date, reason?: string): Promise<Room> {
    const blockId = new Date().getTime().toString();
    const room = await this.roomModel.findByIdAndUpdate(
      roomId,
      { $push: { blockedDates: { _id: blockId, startDate, endDate, reason: reason || '' } } },
      { new: true, runValidators: false }
    );
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async unblockDates(roomId: string, blockId: string): Promise<Room> {
    const room = await this.roomModel.findByIdAndUpdate(
      roomId,
      { $pull: { blockedDates: { _id: blockId } } },
      { new: true, runValidators: false }
    );
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async updateRoomAvailability(roomId: string, available: boolean): Promise<Room> {
    const room = await this.roomModel.findByIdAndUpdate(
      roomId,
      { $set: { available } },
      { new: true, runValidators: false }
    );
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }
  
  async getRoomTypes(): Promise<any[]> {
    const roomTypes = await this.roomModel.aggregate([
      {
        $group: {
          _id: '$nameKey',
          name: { $first: '$name' },
          description: { $first: '$description' },
          capacity: { $first: '$capacity' },
          bedType: { $first: '$bedType' },
          price: { $first: '$price' },
          totalRooms: { $sum: '$totalRooms' },
          images: { $first: '$images' },
          amenities: { $first: '$amenities' },
          floor: { $first: '$floor' }
        }
      },
      {
        $sort: { capacity: 1 }
      }
    ]);
    
    return roomTypes.map(type => ({
      id: type._id,
      name: type.name,
      description: type.description,
      capacity: type.capacity,
      bedType: type.bedType,
      price: type.price,
      totalRooms: type.totalRooms,
      images: type.images,
      amenities: type.amenities,
      floor: type.floor || 'ground'
    }));
  }

  async update(id: string, updateRoomDto: UpdateRoomDto): Promise<Room | null> {
    return this.roomModel.findByIdAndUpdate(id, updateRoomDto, { returnDocument: 'after' }).exec();
  }

  async remove(id: string): Promise<Room | null> {
    return this.roomModel.findByIdAndDelete(id).exec();
  }
  
  async updateRoomPricing(roomId: string, pricingData: {
    basePrice: number;
    pricingByOccupancy?: { guests: number; price: number }[];
    taxes?: {
      vat?: number;
      municipalFees?: number;
      environmentalTax?: number;
    };
  }): Promise<Room> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    
    room.price = pricingData.basePrice;
    if (pricingData.pricingByOccupancy) {
      room.pricingByOccupancy = pricingData.pricingByOccupancy;
    }
    
    return room.save();
  }
  
  async getRoomStats(): Promise<any> {
    const [totalRooms, availableRooms, roomTypes] = await Promise.all([
      this.roomModel.countDocuments(),
      this.roomModel.countDocuments({ available: true }),
      this.roomModel.aggregate([
        { $group: { _id: '$capacity', count: { $sum: '$totalRooms' }, avgPrice: { $avg: '$price' } } },
      ]),
    ]);

    return {
      totalRooms,
      availableRooms,
      occupiedRooms: totalRooms - availableRooms,
      roomTypes: roomTypes.map(type => ({
        capacity: type._id,
        count: type.count,
        avgPrice: type.avgPrice,
      })),
    };
  }
}
