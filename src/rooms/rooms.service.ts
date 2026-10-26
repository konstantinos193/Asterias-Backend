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
import { AvailabilityEngine } from '../availability/availability-engine';
import { dayKey } from '../availability/availability-rules';

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
    private readonly availability: AvailabilityEngine,
  ) {}

  /**
   * Public because admin edits do not go through this service.
   *
   * AdminService.updateRoom writes to the Room model directly, so the 60-second
   * findAll() cache here kept serving the pre-edit list: the owner would save a
   * room, reload the site, and see no change for up to a minute. AdminService
   * now calls this after every room write.
   */
  clearRoomsCache() {
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

  /** Rooms a guest can book for these dates. One rule set: AvailabilityEngine. */
  async findAvailable(checkIn: string, checkOut: string): Promise<Room[]> {
    return this.availability.getSellableRooms(new Date(checkIn), new Date(checkOut));
  }

  async getRoomAvailability(roomId: string, startDate: Date, endDate: Date): Promise<any> {
    const result = await this.availability.getRoomNights(
      roomId,
      dayKey(startDate),
      dayKey(endDate),
    );
    if (!result.room) {
      throw new NotFoundException('Room not found');
    }
    return result;
  }

  async blockDates(roomId: string, startDate: Date, endDate: Date, reason?: string): Promise<any> {
    const rid = new Types.ObjectId(roomId);
    const room = await this.roomModel.findById(rid).lean();
    if (!room) throw new NotFoundException('Room not found');
    if (!(endDate > startDate)) {
      throw new BadRequestException('endDate must be after startDate');
    }
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

  async getBlockedDates(roomId: string): Promise<any[]> {
    return this.roomBlockedDateModel
      .find({ roomId: new Types.ObjectId(roomId) })
      .sort({ startDate: 1 })
      .lean();
  }

  /** The room on or off sale indefinitely. Off sale closes every night of it. */
  async updateRoomAvailability(roomId: string, available: boolean): Promise<Room> {
    const room = await this.roomModel.findByIdAndUpdate(
      roomId,
      { $set: { available } },
      { new: true, runValidators: false }
    );
    if (!room) throw new NotFoundException('Room not found');
    this.clearRoomsCache();
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
