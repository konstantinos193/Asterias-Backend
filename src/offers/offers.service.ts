import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Offer, OfferDocument, OfferModel } from '../models/offer.model';
import { Room } from '../models/room.model';

export interface CreateOfferDto {
  title: string;
  description: string;
  discount: number;
  startDate: Date;
  endDate: Date;
  applicableRooms?: Types.ObjectId[];
  minStay?: number;
  maxStay?: number;
  conditions?: string;
  code?: string;
}

export interface UpdateOfferDto {
  title?: string;
  description?: string;
  discount?: number;
  startDate?: Date;
  endDate?: Date;
  applicableRooms?: Types.ObjectId[];
  minStay?: number;
  maxStay?: number;
  conditions?: string;
  active?: boolean;
}

export interface ApplicableOffersDto {
  checkIn: Date;
  checkOut: Date;
  roomId?: Types.ObjectId;
}

export interface ValidateCodeDto {
  code: string;
  checkIn: Date;
  checkOut: Date;
  roomId?: Types.ObjectId;
}

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(@InjectModel(Offer.name) private offerModel: OfferModel) {}

  async getActiveOffers(): Promise<OfferDocument[]> {
    return await this.offerModel.getActiveOffers();
  }

  async getOfferById(id: string): Promise<OfferDocument> {
    const offer = await this.offerModel.findById(id).populate('applicableRooms');
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return offer;
  }

  async createOffer(createOfferDto: CreateOfferDto): Promise<OfferDocument> {
    const { startDate, endDate, code } = createOfferDto;

    // Check if end date is after start date
    if (new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check if code is unique (if provided)
    if (code) {
      const existingOffer = await this.offerModel.findByCode(code);
      if (existingOffer) {
        throw new BadRequestException('Offer code already exists');
      }
    }

    const offer = new this.offerModel({
      ...createOfferDto,
      code: code?.toUpperCase()
    });

    return await offer.save();
  }

  async updateOffer(id: string, updateOfferDto: UpdateOfferDto): Promise<OfferDocument> {
    const { startDate, endDate } = updateOfferDto;

    // Check if end date is after start date (if both are provided)
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestException('End date must be after start date');
    }

    const offer = await this.offerModel.findByIdAndUpdate(
      id,
      updateOfferDto,
      { new: true, runValidators: true }
    ).populate('applicableRooms');

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    return offer;
  }

  async deleteOffer(id: string): Promise<void> {
    const offer = await this.offerModel.findByIdAndDelete(id);
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
  }

  async getAllOffers(page = 1, limit = 20, active?: boolean): Promise<{ offers: OfferDocument[]; pagination: any }> {
    const filter: any = {};
    if (active !== undefined) filter.active = active === true;

    const skip = (page - 1) * limit;

    const offers = await this.offerModel.find(filter)
      .populate('applicableRooms')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await this.offerModel.countDocuments(filter);

    return {
      offers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async toggleOfferStatus(id: string): Promise<OfferDocument> {
    const offer = await this.offerModel.findById(id);
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    offer.active = !offer.active;
    await offer.save();

    return offer;
  }

  async getApplicableOffers(applicableOffersDto: ApplicableOffersDto): Promise<OfferDocument[]> {
    const { checkIn, checkOut, roomId } = applicableOffersDto;

    // Get all active offers
    const allOffers = await this.offerModel.getActiveOffers();
    
    // Filter offers that are applicable for the given dates and room
    const applicableOffers = allOffers.filter(offer => {
      // Check if offer is valid for the dates
      if (!offer.isValidForDates(checkIn, checkOut)) {
        return false;
      }

      // Check if room is applicable (if roomId is provided)
      if (roomId && offer.applicableRooms.length > 0) {
        const isRoomApplicable = offer.applicableRooms.some(room => 
          room.toString() === roomId.toString()
        );
        if (!isRoomApplicable) {
          return false;
        }
      }

      // Check minimum stay requirement
      const nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));
      if (offer.minStay && nights < offer.minStay) {
        return false;
      }

      // Check maximum stay requirement
      if (offer.maxStay && nights > offer.maxStay) {
        return false;
      }

      return true;
    });

    return applicableOffers;
  }

  async validateOfferCode(validateCodeDto: ValidateCodeDto): Promise<OfferDocument> {
    const { code, checkIn, checkOut, roomId } = validateCodeDto;

    const offer = await this.offerModel.findByCode(code);
    if (!offer) {
      throw new NotFoundException('Invalid offer code');
    }

    if (!offer.active) {
      throw new BadRequestException('Offer is not active');
    }

    // Check if offer is valid for the dates
    const isValidForDates = offer.isValidForDates(checkIn, checkOut);
    if (!isValidForDates) {
      throw new BadRequestException('Offer is not valid for the selected dates');
    }

    // Check if room is applicable (if roomId is provided)
    if (roomId && offer.applicableRooms.length > 0) {
      const isRoomApplicable = offer.applicableRooms.some(room => 
        room.toString() === roomId.toString()
      );
      if (!isRoomApplicable) {
        throw new BadRequestException('Offer is not valid for this room');
      }
    }

    // Check minimum stay requirement
    const nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));
    if (offer.minStay && nights < offer.minStay) {
      throw new BadRequestException(`Minimum stay requirement is ${offer.minStay} nights`);
    }

    // Check maximum stay requirement
    if (offer.maxStay && nights > offer.maxStay) {
      throw new BadRequestException(`Maximum stay allowed is ${offer.maxStay} nights`);
    }

    return offer;
  }
}
