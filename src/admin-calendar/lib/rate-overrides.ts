import { DayKey } from '../calendar.types';

export const RATE_TIERS = ['2beds', '3beds', '4beds'] as const;
export type RateTier = (typeof RATE_TIERS)[number];

/** A price per guest tier. `null` clears that tier on the nights it is sent for. */
export type TierPriceInput = Partial<Record<RateTier, number | null>>;
export type TierPrices = Partial<Record<RateTier, number>>;

export interface ExistingOverride {
  id: string;
  date: DayKey;
  prices: TierPrices;
}

export interface OverrideWrite {
  date: DayKey;
  prices: TierPrices;
}

export interface OverridePlan {
  /** Nights whose override should end up holding exactly these prices. */
  writes: OverrideWrite[];
  /** Overrides left with no price at all, so the night falls back to the season. */
  deletes: string[];
}

function hasPrice(prices: TierPrices): boolean {
  return RATE_TIERS.some((tier) => typeof prices[tier] === 'number');
}

/**
 * What to write so each of `nights` carries `requested` on top of whatever it
 * already had. Tiers the request leaves out keep their price, which is what
 * makes typing a 3-guest rate over a range safe for the 2-guest one.
 *
 * Pure, because this is the whole rule: the repository only executes the plan.
 */
export function planRateOverrides(
  nights: DayKey[],
  requested: TierPriceInput,
  existing: ExistingOverride[],
): OverridePlan {
  const byDate = new Map(existing.map((o) => [o.date, o]));
  const plan: OverridePlan = { writes: [], deletes: [] };

  for (const date of nights) {
    const current = byDate.get(date);
    const merged: TierPrices = { ...current?.prices };

    for (const tier of RATE_TIERS) {
      const value = requested[tier];
      if (value === undefined) continue;
      if (value === null) delete merged[tier];
      else merged[tier] = value;
    }

    if (hasPrice(merged)) plan.writes.push({ date, prices: merged });
    else if (current) plan.deletes.push(current.id);
  }

  return plan;
}
