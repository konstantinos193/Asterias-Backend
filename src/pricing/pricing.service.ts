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
  roomType?: RoomType; // what the room document declares
  rateTier?: RoomType; // the seasonal rate this stay was actually priced at
  basePrice: number;
}

/**
 * Fallbacks used only when a rate is missing from the settings document.
 * These MUST stay in sync with the defaults in settings.module.ts — a mismatch
 * silently charges guests a different amount than the admin panel shows.
 *
 * Room rates here are quoted VAT-inclusive (the owner's price list is what the
 * guest pays), so `taxRate` is 0: adding VAT on top would overcharge. The only
 * extra a guest owes is the €2 per-night stay fee, which lives in
 * `municipalFee`; there is no separate per-guest charge.
 */
export const TAX_DEFAULTS = {
  taxRate: 0, // % — rates are VAT-inclusive
  municipalFee: 2.0, // € per night
  environmentalTax: 0, // € per guest per night
} as const;

/** Seasonal rate tiers, cheapest first. */
const RATE_TIERS: readonly RoomType[] = ['2beds', '3beds', '4beds'] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

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

  /**
   * Which seasonal rate a stay pays. Every room is the same layout — one main
   * bedroom plus a small one with two beds — and is sold as a 2-, 3- or 4-bed,
   * so the rate follows the GUEST COUNT, not any fixed type on the room.
   *
   * Keying off `room.roomType` (as this used to) was wrong twice over: rooms
   * marked '4beds' charged the 4-bed rate to a couple, and rooms left without a
   * type could never match a period at all and silently stayed on base price.
   */
  private rateTierFor(guests: number): RoomType {
    if (guests >= 4) return '4beds';
    if (guests === 3) return '3beds';
    return '2beds';
  }

  /**
   * The price a period charges for `tier`, falling back down the ladder when the
   * exact tier is undefined — a period that only prices 2beds should still apply
   * to a 3-guest stay rather than reverting to the room's base price.
   */
  private seasonalPrice(period: any, tier: RoomType): number | undefined {
    if (!period?.prices) return undefined;
    for (let i = RATE_TIERS.indexOf(tier); i >= 0; i--) {
      const value = period.prices[RATE_TIERS[i]];
      if (typeof value === 'number') return value;
    }
    return undefined;
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
    const rateTier = this.rateTierFor(guests);
    const adjustment = Number(room.priceAdjustment) || 0;

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

      // Highest-priority active period that covers this night AND prices this tier.
      const covering = periods.find((p) => {
        if (this.seasonalPrice(p, rateTier) === undefined) return false;
        const ps = this.toUtcMidnight(new Date(p.startDate)).getTime();
        const pe = this.toUtcMidnight(new Date(p.endDate)).getTime();
        return ps <= night.getTime() && night.getTime() <= pe;
      });
      if (covering) {
        price = this.seasonalPrice(covering, rateTier)!;
        source = 'seasonal';
        periodName = covering.name;
      }

      // The room premium rides on top of whichever rate won, never below zero.
      price = Math.max(0, round2(price + adjustment));

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
      roomType: room.roomType,
      rateTier,
      basePrice: room.price,
    };
  }

  /**
   * Apply VAT + municipal + environmental tax to a pre-tax subtotal, using the
   * same rates/fallbacks as the existing payment flow so card/cash totals agree.
   */
  async applyTaxes(subtotal: number, nights: number, guests: number): Promise<TaxBreakdown> {
    const settings = await this.settingsService.getSettings();
    const vatRate = (settings?.taxRate ?? TAX_DEFAULTS.taxRate) / 100;
    const municipalFee = (settings?.municipalFee ?? TAX_DEFAULTS.municipalFee) * nights;
    const environmentalTax =
      (settings?.environmentalTax ?? TAX_DEFAULTS.environmentalTax) * nights * Math.max(guests, 1);
    const vatAmount = round2(subtotal * vatRate);
    const total = round2(subtotal + vatAmount + municipalFee + environmentalTax);
    return {
      vatRate,
      vatAmount,
      municipalFee: round2(municipalFee),
      environmentalTax: round2(environmentalTax),
      total,
    };
  }
}
