import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from '../models/room.model';
import { SeasonalPricing, SeasonalPricingDocument } from '../models/seasonal-pricing.model';
import { SettingsService } from '../settings/settings.service';

export type RoomType = '2beds' | '3beds' | '4beds';

export interface PerNight {
  date: string; // YYYY-MM-DD
  price: number;
  source: 'seasonal' | 'occupancy' | 'base';
  periodName?: string;
}

export interface StayQuote {
  nights: number;
  perNight: PerNight[];
  subtotal: number; // PRE-TAX sum of nightly room prices
  currency: 'eur';
  roomType?: RoomType;
  basePrice: number;
}

export interface TaxBreakdown {
  vatRate: number;
  vatAmount: number;
  municipalFee: number;
  environmentalTax: number;
  total: number; // subtotal + taxes/fees
}

/**
 * Single source of truth for room pricing. Computes the nightly price of a stay,
 * applying property-wide seasonal pricing per room type (with per-night
 * resolution so stays that straddle a season boundary are priced correctly).
 */
@Injectable()
export class PricingService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(SeasonalPricing.name)
    private seasonalModel: Model<SeasonalPricingDocument>,
    private settingsService: SettingsService,
  ) {}

  private readonly DAY_MS = 24 * 60 * 60 * 1000;

  /** Normalize any date to midnight UTC of its calendar day. */
  private toUtcMidnight(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  /** Base nightly price from the room: occupancy tier if it matches, else base. */
  private basePerNight(room: any, guests: number): { price: number; source: 'occupancy' | 'base' } {
    if (Array.isArray(room.pricingByOccupancy) && room.pricingByOccupancy.length > 0) {
      const match = room.pricingByOccupancy
        .filter((p: any) => p.guests <= guests)
        .sort((a: any, b: any) => b.guests - a.guests)[0];
      if (match) return { price: match.price, source: 'occupancy' };
    }
    return { price: room.price, source: 'base' };
  }

  /**
   * Quote a stay. `roomOrId` may be a loaded room (document or lean object) or an id.
   * Returns the PRE-TAX nightly breakdown and subtotal.
   */
  async quoteStay(
    roomOrId: RoomDocument | string | Types.ObjectId | any,
    checkIn: Date | string,
    checkOut: Date | string,
    adults: number | string,
    children: number | string = 0,
  ): Promise<StayQuote> {
    const room =
      typeof roomOrId === 'string' || roomOrId instanceof Types.ObjectId
        ? await this.roomModel.findById(roomOrId).lean()
        : roomOrId;
    if (!room) throw new NotFoundException('Room not found');

    const guests = (parseInt(String(adults)) || 0) + (parseInt(String(children)) || 0);
    const start = this.toUtcMidnight(new Date(checkIn));
    const end = this.toUtcMidnight(new Date(checkOut));
    const nights = Math.max(0, Math.round((end.getTime() - start.getTime()) / this.DAY_MS));
    const roomType: RoomType | undefined = room.roomType;

    // Fetch active periods overlapping the stay once, then resolve per night.
    let periods: any[] = [];
    if (nights > 0) {
      const lastNight = new Date(end.getTime() - this.DAY_MS);
      periods = await this.seasonalModel
        .find({
          active: { $ne: false },
          startDate: { $lte: lastNight },
          endDate: { $gte: start },
        })
        .lean();
      // Deterministic overlap winner: priority desc, then newest, then narrowest range.
      periods.sort(
        (a, b) =>
          (b.priority || 0) - (a.priority || 0) ||
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime() ||
          (new Date(a.endDate).getTime() - new Date(a.startDate).getTime()) -
            (new Date(b.endDate).getTime() - new Date(b.startDate).getTime()),
      );
    }

    const fallback = this.basePerNight(room, guests);

    const perNight: PerNight[] = [];
    let subtotal = 0;
    for (let i = 0; i < nights; i++) {
      const night = new Date(start.getTime() + i * this.DAY_MS);
      let price = fallback.price;
      let source: PerNight['source'] = fallback.source;
      let periodName: string | undefined;

      if (roomType) {
        // Highest-priority active period that covers this night AND has a price for this type.
        const covering = periods.find((p) => {
          const typePrice = p.prices ? p.prices[roomType] : undefined;
          if (typeof typePrice !== 'number') return false;
          const ps = this.toUtcMidnight(new Date(p.startDate)).getTime();
          const pe = this.toUtcMidnight(new Date(p.endDate)).getTime();
          return ps <= night.getTime() && night.getTime() <= pe;
        });
        if (covering) {
          price = covering.prices[roomType];
          source = 'seasonal';
          periodName = covering.name;
        }
      }

      subtotal += price;
      perNight.push({
        date: night.toISOString().split('T')[0],
        price,
        source,
        periodName,
      });
    }

    return {
      nights,
      perNight,
      subtotal: Math.round(subtotal * 100) / 100,
      currency: 'eur',
      roomType,
      basePrice: room.price,
    };
  }

  /**
   * Apply VAT + municipal + environmental tax to a pre-tax subtotal, using the
   * same rates/fallbacks as the existing payment flow so card/cash totals agree.
   */
  async applyTaxes(subtotal: number, nights: number, guests: number): Promise<TaxBreakdown> {
    const settings = await this.settingsService.getSettings();
    const vatRate = (settings?.taxRate ?? 13) / 100;
    const municipalFee = (settings?.municipalFee ?? 2.0) * nights;
    const environmentalTax = (settings?.environmentalTax ?? 2.0) * nights * Math.max(guests, 1);
    const vatAmount = subtotal * vatRate;
    const total = subtotal + vatAmount + municipalFee + environmentalTax;
    return { vatRate, vatAmount, municipalFee, environmentalTax, total };
  }
}
