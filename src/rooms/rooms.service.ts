import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Room, RoomDocument } from '../models/room.model';
import { RoomBlockedDate, RoomBlockedDateDocument } from '../models/room-blocked-date.model';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Booking, BookingDocument } from '../models/booking.model';
import { ChannelConfig, ChannelConfigDocument } from '../models/channel-config.model';
import { Offer, OfferDocument } from '../models/offer.model';

@Injectable()
export class RoomsService {
  private roomsCache: { data: Room[]; timestamp: number } | null = null;
  private readonly ROOMS_CACHE_TTL_MS = 60_000;

  constructor(
    @InjectConnection() private connection: Connection,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(RoomBlockedDate.name) private roomBlockedDateModel: Model<RoomBlockedDateDocument>,
    @InjectModel('Booking') private bookingModel: Model<BookingDocument>,
    @InjectModel(ChannelConfig.name) private channelConfigModel: Model<ChannelConfigDocument>,
    @InjectModel(Offer.name) private offerModel: Model<OfferDocument>,
  ) {}

  private clearRoomsCache() {
    this.roomsCache = null;
  }

  async create(createRoomDto: CreateRoomDto): Promise<Room> {
    const room = new this.roomModel(createRoomDto);
    const saved = await room.save();
    this.clearRoomsCache();
    return saved;
  }

  async findAll(): Promise<Room[]> {
    if (this.roomsCache && Date.now() - this.roomsCache.timestamp < this.ROOMS_CACHE_TTL_MS) {
      return this.roomsCache.data;
    }
    const rooms = await this.roomModel.find().sort({ sortOrder: 1 }).lean().exec() as unknown as Room[];
    this.roomsCache = { data: rooms, timestamp: Date.now() };
    return rooms;
  }

  async findOne(id: string): Promise<Room | null> {
    return this.roomModel.findById(id).lean().exec() as Promise<Room | null>;
  }

  async findAvailable(checkIn: string, checkOut: string): Promise<Room[]> {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Find room IDs with overlapping block entries
    const blockedRoomIds = await this.roomBlockedDateModel.distinct('roomId', {
      startDate: { $lt: checkOutDate },
      endDate: { $gt: checkInDate },
    });

    const notBlocked = await this.roomModel.find({
      available: true,
      _id: { $nin: blockedRoomIds },
    }).lean();
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
    ) as unknown as Room[];
  }
  
  async getRoomAvailability(roomId: string, startDate: Date, endDate: Date): Promise<any> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const [bookings, blockedDateEntries] = await Promise.all([
      this.bookingModel.find({
        roomId: room._id,
        bookingStatus: { $nin: ['CANCELLED'] },
        checkIn: { $lte: endDate },
        checkOut: { $gte: startDate },
      }).lean(),
      this.roomBlockedDateModel.find({
        roomId: room._id,
        startDate: { $lt: endDate },
        endDate: { $gt: startDate },
      }).lean(),
    ]);

    // Pre-build O(1) lookup structures instead of scanning arrays per date
    const bookedDateSet = new Set<string>();
    for (const booking of bookings) {
      const d = new Date(booking.checkIn);
      while (d < booking.checkOut) {
        bookedDateSet.add(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
      }
    }

    const blockedDateMap = new Map<string, { reason: string | null; _id: string }>();
    for (const b of blockedDateEntries) {
      const d = new Date(b.startDate);
      const be = new Date(b.endDate);
      while (d < be) {
        blockedDateMap.set(d.toISOString().split('T')[0], { reason: b.reason || null, _id: (b as any)._id.toString() });
        d.setDate(d.getDate() + 1);
      }
    }

    const availability = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const isBooked = bookedDateSet.has(dateStr);
      const blockEntry = blockedDateMap.get(dateStr) ?? null;

      availability.push({
        date: dateStr,
        available: !isBooked && !blockEntry,
        bookedCount: isBooked ? 1 : 0,
        blocked: !!blockEntry,
        blockReason: blockEntry ? blockEntry.reason : null,
        blockId: blockEntry ? blockEntry._id : null,
        totalRooms: room.totalRooms
      });

      current.setDate(current.getDate() + 1);
    }

    return {
      room,
      availability
    };
  }
  
  async blockDates(roomId: string, startDate: Date, endDate: Date, reason?: string): Promise<any> {
    const rid = new Types.ObjectId(roomId);
    const room = await this.roomModel.findById(rid).lean();
    if (!room) throw new NotFoundException('Room not found');
    await this.roomBlockedDateModel.create({ roomId: rid, startDate, endDate, reason: reason || '' });
    const blockedDates = await this.roomBlockedDateModel.find({ roomId: rid }).sort({ startDate: 1 }).lean();
    return { ...room, blockedDates };
  }

  async unblockDates(roomId: string, blockId: string): Promise<any> {
    const rid = new Types.ObjectId(roomId);
    const room = await this.roomModel.findById(rid).lean();
    if (!room) throw new NotFoundException('Room not found');
    await this.roomBlockedDateModel.findByIdAndDelete(blockId);
    const blockedDates = await this.roomBlockedDateModel.find({ roomId: rid }).sort({ startDate: 1 }).lean();
    return { ...room, blockedDates };
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
    const updated = await this.roomModel.findByIdAndUpdate(id, updateRoomDto, { returnDocument: 'after' }).exec();
    if (updated) this.clearRoomsCache();
    return updated;
  }

  async remove(id: string): Promise<Room | null> {
    const oid = new Types.ObjectId(id);
    const hasActiveBookings = await this.bookingModel.exists({
      roomId: oid,
      bookingStatus: { $nin: ['CANCELLED', 'CHECKED_OUT'] },
    });
    if (hasActiveBookings) {
      throw new BadRequestException('Cannot delete a room with active bookings. Cancel or check-out all bookings first.');
    }

    let room: Room | null = null;
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        room = await this.roomModel.findByIdAndDelete(id, { session }).exec();
        if (room) {
          await Promise.all([
            this.bookingModel.updateMany({ roomId: oid }, { $set: { roomId: null } }, { session }),
            this.roomBlockedDateModel.deleteMany({ roomId: oid }, { session }),
            this.channelConfigModel.deleteMany({ roomId: oid }, { session }),
            this.offerModel.updateMany({}, { $pull: { applicableRooms: oid } }, { session }),
          ]);
        }
      });
    } finally {
      await session.endSession();
    }
    if (room) this.clearRoomsCache();
    return room;
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
