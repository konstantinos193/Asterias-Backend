import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SeasonalPricing,
  SeasonalPricingDocument,
} from '../../models/seasonal-pricing.model';
import { dayKey, dayStart } from '../../availability/availability-rules';
import { DayKey } from '../calendar.types';
import { ExistingOverride, OverridePlan, TierPrices } from '../lib/rate-overrides';

/** Calendar overrides outrank the seasons they sit inside. */
const OVERRIDE_PRIORITY = 100;
const CALENDAR_ORIGIN = 'calendar' as const;

interface OverrideRow {
  _id: Types.ObjectId;
  startDate: Date;
  prices?: TierPrices;
}

function overrideName(date: DayKey): string {
  const [year, month, day] = date.split('-');
  return `Τιμή ${day}/${month}/${year}`;
}

@Injectable()
export class CalendarRatesRepository {
  constructor(
    @InjectModel(SeasonalPricing.name)
    private readonly seasonalModel: Model<SeasonalPricingDocument>,
  ) {}

  /** The calendar's own single-night periods covering [from, to]. */
  async listOverrides(from: DayKey, to: DayKey): Promise<ExistingOverride[]> {
    const rows = await this.seasonalModel
      .find({
        origin: CALENDAR_ORIGIN,
        startDate: { $gte: dayStart(from), $lte: dayStart(to) },
      })
      .select('startDate prices')
      .lean<OverrideRow[]>();

    return rows.map((row) => ({
      id: String(row._id),
      date: dayKey(row.startDate),
      prices: row.prices ?? {},
    }));
  }

  /** One round trip for a plan, however many nights it touches. */
  async apply(plan: OverridePlan): Promise<void> {
    const operations = [
      ...plan.writes.map(({ date, prices }) => ({
        updateOne: {
          filter: { origin: CALENDAR_ORIGIN, startDate: dayStart(date) },
          update: {
            $set: {
              name: overrideName(date),
              startDate: dayStart(date),
              endDate: dayStart(date),
              prices,
              priority: OVERRIDE_PRIORITY,
              active: true,
              origin: CALENDAR_ORIGIN,
            },
          },
          upsert: true,
        },
      })),
      ...plan.deletes.map((id) => ({
        deleteOne: { filter: { _id: new Types.ObjectId(id) } },
      })),
    ];

    if (!operations.length) return;
    await this.seasonalModel.bulkWrite(operations);
  }
}
