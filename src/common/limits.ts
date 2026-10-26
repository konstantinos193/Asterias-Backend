/**
 * Numeric ceilings for caller-supplied values.
 *
 * Two classes of bug motivated these:
 *
 *   - guest counts arrived as a bare `@IsNumber()` with no bounds, so `adults:
 *     0` reached PricingService (a stay priced for nobody) and a huge value
 *     reached the room-combination search, which is combinatorial in the number
 *     of guests;
 *   - `limit` arrived as `@Query('limit') limit?: string` and went straight
 *     into `.limit(parseInt(limit))` with no ceiling on four admin list
 *     routes, so `?limit=9999999` returned the whole collection. Two other
 *     controllers already capped theirs by hand, at two different numbers.
 */

/** Guests on one booking. Capacity for a specific room is checked separately. */
export const MAX_ADULTS_PER_BOOKING = 20;
export const MAX_CHILDREN_PER_BOOKING = 20;

/** Rows one list request may return, and what it returns when unasked. */
export const MAX_LIST_LIMIT = 200;
export const DEFAULT_LIST_LIMIT = 20;

/**
 * Parses a caller-supplied page size into a bounded integer.
 *
 * The one place this is decided. `parseInt` on its own returns NaN for
 * "abc" — which Mongo's `.limit()` treats as "no limit" — and a negative
 * number throws, so both are folded into the default here.
 */
export function parseListLimit(
  raw: unknown,
  { max = MAX_LIST_LIMIT, fallback = DEFAULT_LIST_LIMIT }: { max?: number; fallback?: number } = {},
): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

/** Same, for a 1-based page number. */
export function parsePageNumber(raw: unknown, fallback = 1): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}