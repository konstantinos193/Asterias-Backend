import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from '../models/room.model';
import { SeasonalPricing, SeasonalPricingDocument } from '../models/seasonal-pricing.model';
import { Offer, OfferDocument } from '../models/offer.model';
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

export interface RateNight {
  date: string; // YYYY-MM-DD
  rates: Record<RoomType, { price: number; periodId: string; periodName: string } | null>;
}

export interface RateCalendar {
  from: string;
  days: number;
  nights: RateNight[];
  base: Record<RoomType, { min: number; max: number } | null>;
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

export interface AppliedOffer {
  id: string;
  title: string;
  titleKey?: string;
  discount: number; // % off the room subtotal
}

/** Why a requested offer was left off the price. */
export type OfferRejection = 'not_found' | 'inactive' | 'dates' | 'room' | 'min_stay' | 'max_stay';

export interface OfferPricing {
  offer: AppliedOffer | null;
  offerRejected?: OfferRejection;
  originalSubtotal: number;
  discountAmount: number;
  subtotal: number; // PRE-TAX room subtotal after the discount
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
    @InjectModel(Offer.name) private offerModel: Model<OfferDocument>,
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

  /**
   * Active periods touching [firstNight, lastNight], in the order they win a
   * night: explicit priority first, then the SHORTER period, then the newer.
   * Shorter-first is what lets a special date (15 August) override the season
   * around it; ordering by creation date let a season added later swallow it.
   */
  private async activePeriods(firstNight: Date, lastNight: Date): Promise<any[]> {
    const periods = await this.seasonalModel
      .find({
        active: { $ne: false },
        startDate: { $lte: lastNight },
        endDate: { $gte: firstNight },
      })
      .lean();
    const span = (p: any) => new Date(p.endDate).getTime() - new Date(p.startDate).getTime();
    return periods.sort(
      (a: any, b: any) =>
        (b.priority || 0) - (a.priority || 0) ||
        span(a) - span(b) ||
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
  }

  /** The first of the (sorted) periods that covers `night` and prices `tier`. */
  private winningPeriod(periods: any[], night: Date, tier: RoomType): any | undefined {
    return periods.find((p) => {
      if (this.seasonalPrice(p, tier) === undefined) return false;
      const ps = this.toUtcMidnight(new Date(p.startDate)).getTime();
      const pe = this.toUtcMidnight(new Date(p.endDate)).getTime();
      return ps <= night.getTime() && night.getTime() <= pe;
    });
  }

  /**
   * The nightly rate for 2, 3 and 4 guests on each of `days` nights from
   * `from` (YYYY-MM-DD), resolved exactly as quoteStay resolves them. A null
   * rate means no period applies and each room charges its own base price;
   * `base` gives the range of those base prices across the rooms.
   */
  async rateCalendar(from: string, days: number): Promise<RateCalendar> {
    const first = new Date(`${from}T00:00:00.000Z`);
    const last = new Date(first.getTime() + (days - 1) * this.DAY_MS);
    const [periods, rooms] = await Promise.all([
      this.activePeriods(first, last),
      this.roomModel.find().select('price pricingByOccupancy priceAdjustment').lean(),
    ]);

    const nights: RateNight[] = [];
    for (let i = 0; i < days; i++) {
      const night = new Date(first.getTime() + i * this.DAY_MS);
      const rates = {} as RateNight['rates'];
      for (const tier of RATE_TIERS) {
        const p = this.winningPeriod(periods, night, tier);
        rates[tier] = p
          ? { price: this.seasonalPrice(p, tier)!, periodId: String(p._id), periodName: p.name }
          : null;
      }
      nights.push({ date: night.toISOString().slice(0, 10), rates });
    }

    const base = {} as RateCalendar['base'];
    RATE_TIERS.forEach((tier, i) => {
      const prices = rooms.map(
        (r: any) => this.basePerNight(r, i + 2).price + (Number(r.priceAdjustment) || 0),
      );
      base[tier] = prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null;
    });

    return { from, days, nights, base };
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
    const periods =
      nights > 0 ? await this.activePeriods(start, new Date(end.getTime() - this.DAY_MS)) : [];

    const fallback = this.basePerNight(room, guests);

    const perNight: PerNight[] = [];
    let subtotal = 0;
    for (let i = 0; i < nights; i++) {
      const night = new Date(start.getTime() + i * this.DAY_MS);
      let price = fallback.price;
      let source: PerNight['source'] = fallback.source;
      let periodName: string | undefined;

      const covering = this.winningPeriod(periods, night, rateTier);
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
   * Take an offer's percentage off a stay's pre-tax room subtotal. The quote the
   * guest is shown and the amount Stripe charges both come through here, so they
   * agree. Taxes and the per-night stay fee go on the discounted subtotal and are
   * never discounted themselves.
   *
   * An offer that does not fit the stay is left off with the reason, not thrown:
   * the guest is quoted, and charged, the full price. The rules match
   * OffersService.validateOfferCode, so the offer pages and the price agree too.
   */
  async applyOffer(
    subtotal: number,
    roomId: string | Types.ObjectId,
    checkIn: Date | string,
    checkOut: Date | string,
    offerId?: string | null,
  ): Promise<OfferPricing> {
    const none = (offerRejected?: OfferRejection): OfferPricing => ({
      offer: null,
      offerRejected,
      originalSubtotal: subtotal,
      discountAmount: 0,
      subtotal,
    });
    if (!offerId) return none();
    if (!Types.ObjectId.isValid(offerId)) return none('not_found');

    const offer: any = await this.offerModel.findById(offerId).lean();
    if (!offer) return none('not_found');
    if (!offer.active) return none('inactive');

    const start = this.toUtcMidnight(new Date(checkIn));
    const end = this.toUtcMidnight(new Date(checkOut));
    if (
      this.toUtcMidnight(new Date(offer.startDate)) > start ||
      this.toUtcMidnight(new Date(offer.endDate)) < end
    ) {
      return none('dates');
    }

    const rooms: any[] = offer.applicableRooms || [];
    if (rooms.length > 0 && !rooms.some((r) => String(r) === String(roomId))) {
      return none('room');
    }

    const nights = Math.round((end.getTime() - start.getTime()) / this.DAY_MS);
    if (offer.minStay && nights < offer.minStay) return none('min_stay');
    if (offer.maxStay && nights > offer.maxStay) return none('max_stay');

    const percent = Math.min(100, Math.max(0, Number(offer.discount) || 0));
    const discountAmount = round2((subtotal * percent) / 100);
    return {
      offer: {
        id: String(offer._id),
        title: offer.title,
        titleKey: offer.titleKey || undefined,
        discount: percent,
      },
      originalSubtotal: subtotal,
      discountAmount,
      subtotal: round2(subtotal - discountAmount),
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
