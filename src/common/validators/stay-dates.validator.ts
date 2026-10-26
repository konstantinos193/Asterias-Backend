import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Date validation for anything that carries a stay.
 *
 * No DTO in the codebase validated a date: every checkIn/checkOut crossed the
 * boundary as a bare `@IsString()` and was turned into a Date deep inside a
 * service. `new Date('garbage')` is an Invalid Date rather than a throw, and it
 * propagates into a Mongo query as a silent non-match — so a malformed date
 * read as "nothing is booked" instead of as a 400.
 */

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in YYYY-MM-DD form. Rejects 2026-02-30. */
function parseDayKey(value: unknown): Date | null {
  if (typeof value !== 'string' || !DAY_KEY_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Round-trip check: Date rolls 2026-02-30 forward to 2026-03-02 rather than
  // rejecting it, so compare the formatted result against the input.
  return date.toISOString().slice(0, 10) === value ? date : null;
}

@ValidatorConstraint({ name: 'isStayDate', async: false })
class IsStayDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return parseDayKey(value) !== null;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a calendar date in YYYY-MM-DD form`;
  }
}

/**
 * A stay boundary: a calendar date, not a timestamp.
 *
 * Deliberately stricter than `@IsDateString()`, which also accepts a full
 * instant like 2026-07-04T22:00:00Z. Accepting those is what allowed a stay to
 * carry a non-midnight boundary, and every availability and pricing rule in the
 * system is written against UTC-midnight day keys — one timestamp an hour off
 * put a night in a different bucket for pricing than for availability.
 */
export function IsStayDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStayDateConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'isAfterStayDate', async: false })
class IsAfterStayDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const [otherProperty] = args.constraints as [string];
    const start = parseDayKey((args.object as Record<string, unknown>)[otherProperty]);
    const end = parseDayKey(value);
    // If either side is malformed, IsStayDate on that field reports it. Saying
    // so twice for one mistake only makes the 400 harder to read.
    if (!start || !end) return true;
    return end.getTime() > start.getTime();
  }

  defaultMessage(args: ValidationArguments): string {
    const [otherProperty] = args.constraints as [string];
    return `${args.property} must be after ${otherProperty}`;
  }
}

/**
 * Checkout strictly after check-in, so a zero- or negative-night stay is a 400
 * at the boundary. A zero-night stay used to reach PricingService, where it
 * priced at 0 and still passed the availability check, because no night was
 * examined.
 */
export function IsAfterStayDate(property: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: IsAfterStayDateConstraint,
    });
  };
}
